import io
import re
import uuid
from collections import Counter
from datetime import datetime, timezone

from fastapi import UploadFile, HTTPException, status
from pypdf import PdfReader

from app.core.firebase_admin import get_firestore_client, get_storage_bucket
from app.schemas.upload import UploadResponse, CandidateTerm, GenerateCardsRequest
from app.schemas.deck import DeckCreateRequest, DeckSourceType
from app.schemas.card import CardCreateRequest
from app.services.deck_service import get_deck_service
from app.services.card_service import get_card_service


class UploadService:
    collection_name = "uploads"
    max_candidate_terms = 50
    academic_suffixes = (
        "tion",
        "sion",
        "ment",
        "ness",
        "ity",
        "ism",
        "ist",
        "ology",
        "logy",
        "graphy",
        "pathy",
        "osis",
        "emia",
        "scope",
        "meter",
        "lysis",
        "genesis",
        "phobia",
        "philia",
        "cyte",
        "genic",
        "ative",
        "ence",
        "ance",
    )
    blocked_suffixes = (
        "able",
        "ible",
        "al",
        "ary",
        "ful",
        "ic",
        "ical",
        "ish",
        "ive",
        "less",
        "like",
        "ous",
        "y",
    )
    protected_short_terms = {
        "acid",
        "cell",
        "gene",
        "host",
        "mass",
        "rate",
        "soil",
        "atom",
        "mole",
    }
    stopwords = {
        "about", "above", "across", "after", "again", "against", "all", "along", "already", "also",
        "although", "always", "among", "another", "any", "anyone", "anything", "around", "because",
        "before", "being", "below", "between", "both", "but", "can", "cannot", "could", "despite",
        "during", "each", "either", "enough", "especially", "every", "everyone", "everything", "few",
        "for", "from", "further", "had", "has", "have", "having", "here", "however", "into", "its",
        "itself", "just", "least", "less", "many", "may", "might", "more", "most", "much", "must",
        "near", "nearly", "neither", "next", "none", "nor", "not", "often", "onto", "other", "others",
        "our", "ours", "overall", "per", "perhaps", "rather", "same", "several", "since", "some",
        "such", "than", "that", "their", "theirs", "them", "then", "there", "therefore", "these",
        "they", "this", "those", "through", "throughout", "toward", "towards", "under", "until", "upon",
        "very", "well", "were", "what", "when", "where", "whether", "which", "while", "who", "whom",
        "whose", "why", "with", "within", "without", "would", "your", "yours",
    }
    conjunctions = {
        "and", "or", "but", "yet", "so", "nor", "for", "after", "although", "because", "before",
        "once", "since", "than", "though", "unless", "until", "when", "whenever", "whereas", "while",
    }
    pronouns = {
        "he", "her", "hers", "herself", "him", "himself", "his", "i", "it", "me", "mine", "my",
        "myself", "our", "ourselves", "she", "their", "theirs", "them", "themselves", "they", "us",
        "we", "you", "your", "yours", "yourself", "yourselves",
    }
    common_adjectives = {
        "basic", "better", "broad", "central", "clear", "clinical", "common", "complex", "current",
        "different", "difficult", "early", "effective", "entire", "essential", "general", "good",
        "great", "high", "human", "important", "large", "late", "little", "local", "long", "major",
        "medical", "modern", "molecular", "national", "new", "normal", "old", "other", "overall",
        "particular", "physical", "possible", "present", "primary", "public", "recent", "relative",
        "same", "similar", "simple", "single", "small", "specific", "standard", "strong", "total",
        "true", "various", "whole", "young",
    }
    common_verbs = {
        "affect", "allow", "appear", "become", "begin", "cause", "change", "compare", "contain",
        "continue", "control", "create", "define", "describe", "develop", "direct", "discuss", "exist",
        "explain", "follow", "found", "identify", "include", "increase", "indicate", "involve", "known",
        "lead", "learn", "made", "make", "means", "occur", "produce", "provide", "remain", "result",
        "show", "suggest", "study", "used", "using",
    }
    common_first_names = {
        "alex", "alice", "anna", "ben", "charles", "david", "emily", "emma", "ethan", "grace", "henry",
        "isabella", "jack", "jacob", "james", "jane", "john", "joseph", "liam", "lucas", "maria", "mary",
        "michael", "olivia", "robert", "sam", "sarah", "sophia", "thomas", "william",
    }
    
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
            
        storage_path = data.get("storage_path")
        
        try:
            blob = self.storage_bucket.blob(storage_path)
            content = blob.download_as_bytes()
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to read file from storage: {e}")
            
        try:
            text = self._extract_text_from_pdf(content)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error parsing PDF: {e}")

        terms = self._extract_candidate_terms(text)
        
        # Update extraction status
        doc_ref.update({"extraction_status": "completed"})
        
        return terms

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

        for term_str in payload.terms:
            normalized_term = self._normalize_term(term_str)
            if not normalized_term or normalized_term in existing_terms:
                continue

            # MVP assigns "TBD" as translation to comply with schema validator
            # Future expansion can use an LLM or dictionary service here
            card_req = CardCreateRequest(
                term=term_str.strip(),
                translation="TBD",
                source_reference=data.get("file_name")
            )
            card_service.create_card(user_id=user_id, deck_id=deck_id, payload=card_req)
            existing_terms.add(normalized_term)
            
        return deck_id

    def _extract_text_from_pdf(self, content: bytes) -> str:
        reader = PdfReader(io.BytesIO(content))
        pages: list[str] = []
        for page in reader.pages:
            extracted = page.extract_text()
            if extracted:
                pages.append(extracted)
        return "\n".join(pages)

    def _extract_candidate_terms(self, text: str) -> list[CandidateTerm]:
        normalized_text = text.replace("\u00ad", "").replace("\r", "\n")
        tokens = re.findall(r"\b[A-Za-z][A-Za-z-]{2,29}\b", normalized_text)
        if not tokens:
            return []

        lower_tokens = [token.lower() for token in tokens]
        frequencies = Counter(lower_tokens)
        title_case_hits = Counter(
            token.lower()
            for token in tokens
            if token[0].isupper() and not token.isupper()
        )

        scored_terms: list[tuple[float, str, int]] = []
        seen_terms: set[str] = set()
        for token in lower_tokens:
            if token in seen_terms:
                continue

            seen_terms.add(token)
            frequency = frequencies[token]
            if not self._is_likely_term(token, frequency, title_case_hits[token]):
                continue

            score = self._score_term(token, frequency, title_case_hits[token])
            scored_terms.append((score, token, frequency))

        scored_terms.sort(key=lambda item: (-item[0], -item[2], item[1]))

        results: list[CandidateTerm] = []
        for _, token, frequency in scored_terms[: self.max_candidate_terms]:
            results.append(
                CandidateTerm(
                    term=self._display_term(token),
                    context=f"Observed {frequency} times in PDF",
                )
            )

        return results

    def _is_likely_term(self, token: str, frequency: int, title_case_hits: int) -> bool:
        if len(token) < 4 and token not in self.protected_short_terms:
            return False

        if any(char.isdigit() for char in token):
            return False

        if token in self.stopwords or token in self.conjunctions or token in self.pronouns:
            return False

        if token in self.common_adjectives or token in self.common_verbs or token in self.common_first_names:
            return False

        if token.endswith("ing") and frequency < 3:
            return False

        if any(token.endswith(suffix) for suffix in self.blocked_suffixes) and frequency < 3:
            return False

        if title_case_hits > 0 and frequency == 1 and not any(
            token.endswith(suffix) for suffix in self.academic_suffixes
        ):
            return False

        if frequency < 2 and not any(token.endswith(suffix) for suffix in self.academic_suffixes):
            return False

        return True

    def _score_term(self, token: str, frequency: int, title_case_hits: int) -> float:
        score = float(frequency * 2)

        if any(token.endswith(suffix) for suffix in self.academic_suffixes):
            score += 3.5

        if len(token) >= 8:
            score += 1.0

        if "-" in token:
            score += 0.5

        if title_case_hits == 0:
            score += 1.0
        elif frequency >= 3:
            score += 0.5

        return score

    def _display_term(self, token: str) -> str:
        parts = token.split("-")
        return "-".join(part.capitalize() if part else part for part in parts)

    def _normalize_term(self, value: str | None) -> str:
        if not value:
            return ""

        normalized = re.sub(r"\s+", " ", value).strip().lower()
        return normalized


def get_upload_service() -> UploadService:
    return UploadService(get_firestore_client(), get_storage_bucket())
