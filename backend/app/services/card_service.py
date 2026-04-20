from datetime import datetime, timezone
from google.cloud import firestore
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1.transaction import Transaction
from fastapi import HTTPException, status
from app.core.firebase_admin import get_firestore_client
from app.schemas.card import CardCreateRequest, CardResponse, CardUpdateRequest

class CardService:
    collection_name = "cards"
    decks_collection_name = "decks"

    def __init__(self, firestore_client):
        self.firestore_client = firestore_client

    @property
    def collection(self):
        return self.firestore_client.collection(self.collection_name)

    @property
    def decks_collection(self):
        return self.firestore_client.collection(self.decks_collection_name)

    def create_card(self, *, user_id: str, deck_id: str, payload: CardCreateRequest) -> CardResponse:
        deck_ref = self.decks_collection.document(deck_id)
        
        # Transaction to ensure deck exists, verify ownership, and increment card count
        @firestore.transactional
        def create_in_transaction(transaction: Transaction):
            deck_snapshot = deck_ref.get(transaction=transaction)
            if not deck_snapshot.exists:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found.")
            
            deck_data = deck_snapshot.to_dict() or {}
            if deck_data.get("user_id") != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized to add cards to this deck.")

            timestamp = datetime.now(timezone.utc)
            card_ref = self.collection.document()
            card_data = {
                "deck_id": deck_id,
                "user_id": user_id,
                "term": payload.term,
                "translation": payload.translation,
                "pronunciation": payload.pronunciation,
                "example_sentence": payload.example_sentence,
                "source_reference": payload.source_reference,
                "created_at": timestamp,
                "updated_at": timestamp,
                "next_review_at": timestamp,
                "interval": 0,
                "ease_factor": 2.5,
                "review_count": 0,
            }
            transaction.set(card_ref, card_data)
            
            # Increment deck card_count
            transaction.update(deck_ref, {
                "card_count": deck_data.get("card_count", 0) + 1,
                "updated_at": timestamp
            })
            
            return self._to_response(card_ref.id, card_data)

        # Execute transaction
        transaction = self.firestore_client.transaction()
        return create_in_transaction(transaction)

    def list_deck_cards(self, *, user_id: str, deck_id: str) -> list[CardResponse]:
        # Minimal check on deck ownership is implicitly handled or we explicit verify deck first.
        # But cards also have user_id, so filtering by user_id AND deck_id ensures security.
        snapshots = self.collection.where(filter=FieldFilter("user_id", "==", user_id)).where(filter=FieldFilter("deck_id", "==", deck_id)).stream()
        cards = [self._to_response(snapshot.id, snapshot.to_dict() or {}) for snapshot in snapshots]
        return sorted(cards, key=lambda card: card.created_at, reverse=True)

    def get_card(self, *, user_id: str, card_id: str) -> CardResponse | None:
        snapshot = self.collection.document(card_id).get()
        if not snapshot.exists:
            return None
        
        card_data = snapshot.to_dict() or {}
        if card_data.get("user_id") != user_id:
            return None
            
        return self._to_response(snapshot.id, card_data)

    def update_card(self, *, user_id: str, card_id: str, payload: CardUpdateRequest) -> CardResponse | None:
        card_ref = self.collection.document(card_id)
        snapshot = card_ref.get()
        if not snapshot.exists:
            return None
            
        card_data = snapshot.to_dict() or {}
        if card_data.get("user_id") != user_id:
            return None

        update_data = {}
        for field, value in payload.model_dump(exclude_unset=True).items():
            update_data[field] = value
        
        if not update_data:
            return self._to_response(snapshot.id, card_data)

        update_data["updated_at"] = datetime.now(timezone.utc)
        card_ref.update(update_data)
        
        # Merge locally to return updated response
        updated_card_data = {**card_data, **update_data}
        return self._to_response(snapshot.id, updated_card_data)

    def delete_card(self, *, user_id: str, card_id: str) -> bool:
        card_ref = self.collection.document(card_id)
        
        @firestore.transactional
        def delete_in_transaction(transaction: Transaction):
            snapshot = card_ref.get(transaction=transaction)
            if not snapshot.exists:
                return False
                
            card_data = snapshot.to_dict() or {}
            if card_data.get("user_id") != user_id:
                return False

            deck_id = card_data.get("deck_id")
            deck_ref = self.decks_collection.document(deck_id)
            deck_snapshot = deck_ref.get(transaction=transaction)
            
            # Delete card
            transaction.delete(card_ref)

            # Decrement count on deck
            if deck_snapshot.exists:
                deck_data = deck_snapshot.to_dict() or {}
                new_count = max(0, deck_data.get("card_count", 0) - 1)
                transaction.update(deck_ref, {
                    "card_count": new_count,
                    "updated_at": datetime.now(timezone.utc)
                })
            
            return True

        transaction = self.firestore_client.transaction()
        return delete_in_transaction(transaction)

    def _to_response(self, card_id: str, card_data: dict) -> CardResponse:
        return CardResponse(
            id=card_id,
            deck_id=card_data["deck_id"],
            user_id=card_data["user_id"],
            term=card_data["term"],
            translation=card_data["translation"],
            pronunciation=card_data.get("pronunciation"),
            example_sentence=card_data.get("example_sentence"),
            source_reference=card_data.get("source_reference"),
            created_at=card_data["created_at"],
            updated_at=card_data["updated_at"],
            next_review_at=card_data.get("next_review_at", card_data["created_at"]),
            interval=card_data.get("interval", 0),
            ease_factor=card_data.get("ease_factor", 2.5),
            review_count=card_data.get("review_count", 0),
        )

def get_card_service() -> CardService:
    return CardService(get_firestore_client())
