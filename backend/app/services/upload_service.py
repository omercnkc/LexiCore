import io
import re
import uuid
from datetime import datetime, timezone

from fastapi import UploadFile, HTTPException, status
from pypdf import PdfReader

from app.core.firebase_admin import get_firestore_client, get_storage_bucket
from app.schemas.upload import UploadResponse, CandidateTerm, GenerateCardsRequest
from app.schemas.deck import DeckCreateRequest, DeckSourceType
from app.schemas.card import CardCreateRequest
from app.services.deck_service import get_deck_service
from app.services.card_service import get_card_service
from app.services.gemini_service import extract_terms_from_pdf_bytes, enrich_terms_with_details


class UploadService:
    collection_name = "uploads"

    def __init__(self, firestore_client, storage_bucket):
        self.firestore_client = firestore_client
        self.storage_bucket = storage_bucket

    @property
    def collection(self):
        return self.firestore_client.collection(self.collection_name)

    async def process_upload(self, user_id: str, file: UploadFile) -> UploadResponse:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are currently supported for MVP.")

        upload_id = str(uuid.uuid4())
        safe_filename = file.filename
        storage_path = f"uploads/{user_id}/{upload_id}_{safe_filename}"

        try:
            # Upload to Firebase Storage
            blob = self.storage_bucket.blob(storage_path)
            content = await file.read()
            blob.upload_from_string(content, content_type="application/pdf")

        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Storage error: {e}")

        # Store metadata in Firestore
        doc_data = {
            "user_id": user_id,
            "file_name": safe_filename,
            "file_type": "application/pdf",
            "storage_path": storage_path,
            "created_at": datetime.now(timezone.utc),
            "extraction_status": "pending"
        }

        self.collection.document(upload_id).set(doc_data)

        return UploadResponse(id=upload_id, file_name=safe_filename, status="pending")

    def extract_terms(self, user_id: str, upload_id: str) -> list[CandidateTerm]:
        doc_ref = self.collection.document(upload_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Upload not found")

        data = doc.to_dict()
        if data.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        # Check if we already have cached AI terms
        cached_terms = data.get("ai_terms")
        if cached_terms and isinstance(cached_terms, list) and len(cached_terms) > 0:
            return [
                CandidateTerm(
                    term=t.get("term", ""),
                    translation=t.get("translation"),
                    example_sentence=t.get("example_sentence"),
                    hint=t.get("hint"),
                    context=t.get("context"),
                )
                for t in cached_terms
                if t.get("term")
            ]

        storage_path = data.get("storage_path")

        try:
            blob = self.storage_bucket.blob(storage_path)
            content = blob.download_as_bytes()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read file from storage: {e}")

        # Use Gemini AI for intelligent term extraction directly from PDF bytes
        try:
            ai_terms = extract_terms_from_pdf_bytes(content, max_terms=50)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"AI term extraction failed: {e}")

        # Cache AI terms (just the list of strings) in Firestore
        doc_ref.update({
            "extraction_status": "completed",
            "ai_terms": ai_terms,
        })

        results = [
            CandidateTerm(term=t)
            for t in ai_terms
        ]

        return results

    def generate_cards(self, user_id: str, payload: GenerateCardsRequest) -> str:
        doc_ref = self.collection.document(payload.upload_id)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Upload not found")

        data = doc.to_dict()
        if data.get("user_id") != user_id:
            raise HTTPException(status_code=403, detail="Not authorized")

        deck_service = get_deck_service()
        card_service = get_card_service()

        deck_id = payload.deck_id or data.get("generated_deck_id")
        if not deck_id:
            if not payload.deck_title or not payload.course_name or not payload.topic_name:
                raise HTTPException(status_code=400, detail="Missing new deck information")

            req = DeckCreateRequest(
                title=payload.deck_title,
                course_name=payload.course_name,
                topic_name=payload.topic_name
            )
            deck = deck_service.create_deck(
                user_id=user_id,
                payload=req,
                source_type=DeckSourceType.FILE,
                source_file_name=data.get("file_name"),
            )
            deck_id = deck.id

            doc_ref.update({"generated_deck_id": deck_id})
        else:
            existing_deck = deck_service.get_user_deck(user_id=user_id, deck_id=deck_id)
            if existing_deck is None:
                raise HTTPException(status_code=404, detail="Deck not found")

        existing_cards = card_service.list_deck_cards(user_id=user_id, deck_id=deck_id)
        existing_terms = {
            self._normalize_term(card.term)
            for card in existing_cards
            if self._normalize_term(card.term)
        }

        # Enrich the selected terms with AI details (Step 2)
        enriched_data = enrich_terms_with_details(payload.terms)
        enriched_lookup = {self._normalize_term(item["term"]): item for item in enriched_data}

        # We will use a batch to write all cards efficiently
        batch = self.firestore_client.batch()
        cards_added_count = 0
        timestamp = datetime.now(timezone.utc)

        for term_str in payload.terms:
            normalized_term = self._normalize_term(term_str)
            if not normalized_term or normalized_term in existing_terms:
                continue

            # Look up rich data from enrichment step
            ai_data = enriched_lookup.get(normalized_term, {})

            card_ref = card_service.collection.document()
            card_data = {
                "deck_id": deck_id,
                "user_id": user_id,
                "term": term_str.strip(),
                "translation": ai_data.get("translation") or "—",
                "pronunciation": None,
                "example_sentence": ai_data.get("example_sentence"),
                "example_translation": ai_data.get("example_translation"),
                "hint": ai_data.get("hint"),
                "source_reference": data.get("file_name"),
                "created_at": timestamp,
                "updated_at": timestamp,
                "next_review_at": timestamp,
                "interval": 0,
                "ease_factor": 2.5,
                "review_count": 0,
            }
            batch.set(card_ref, card_data)
            existing_terms.add(normalized_term)
            cards_added_count += 1

        # Only update deck and commit batch if new cards were added
        if cards_added_count > 0:
            deck_ref = deck_service.collection.document(deck_id)
            # Increment deck card_count by cards_added_count
            deck_snapshot = deck_ref.get()
            if deck_snapshot.exists:
                current_count = deck_snapshot.to_dict().get("card_count", 0)
                batch.update(deck_ref, {
                    "card_count": current_count + cards_added_count,
                    "updated_at": timestamp
                })
            batch.commit()

        return deck_id

    def _extract_text_from_pdf(self, content: bytes) -> str:
        reader = PdfReader(io.BytesIO(content))
        pages: list[str] = []
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                pages.append(extracted)
        return "\n".join(pages)

    def _normalize_term(self, value: str | None) -> str:
        if not value:
            return ""

        normalized = re.sub(r"\s+", " ", value).strip().lower()
        return normalized


def get_upload_service() -> UploadService:
    return UploadService(get_firestore_client(), get_storage_bucket())
