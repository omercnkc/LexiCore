from datetime import datetime, timedelta, timezone
from google.cloud.firestore_v1.base_query import FieldFilter
from google.cloud.firestore_v1.transaction import Transaction
from fastapi import HTTPException, status
from app.core.firebase_admin import get_firestore_client
from app.schemas.review import ReviewRequest, ReviewResponse, ReviewRating
from app.schemas.card import CardResponse
from app.services.card_service import get_card_service

class ReviewService:
    records_collection_name = "review_records"
    cards_collection_name = "cards"

    def __init__(self, firestore_client):
        self.firestore_client = firestore_client

    @property
    def records_collection(self):
        return self.firestore_client.collection(self.records_collection_name)

    @property
    def cards_collection(self):
        return self.firestore_client.collection(self.cards_collection_name)

    def get_study_queue(self, *, user_id: str, deck_id: str) -> list[CardResponse]:
        # Minimalist matching, we load cards for the deck and filter due dates in Python 
        # to avoid needing a Firestore composite index on user_id + deck_id + next_review_at
        snapshots = self.cards_collection.where(filter=FieldFilter("user_id", "==", user_id)).where(filter=FieldFilter("deck_id", "==", deck_id)).stream()
        
        # We need the `card_service` `_to_response` mapping for clean schema
        card_svc = get_card_service()
        cards = [card_svc._to_response(snapshot.id, snapshot.to_dict() or {}) for snapshot in snapshots]
        
        now = datetime.now(timezone.utc)
        due_cards = [card for card in cards if card.next_review_at <= now]
        
        # Prioritize cards that are most overdue
        due_cards.sort(key=lambda c: c.next_review_at)
        return due_cards

    def submit_review(self, *, user_id: str, card_id: str, payload: ReviewRequest) -> ReviewResponse:
        card_ref = self.cards_collection.document(card_id)
        record_ref = self.records_collection.document()
        
        @self.firestore_client.transactional
        def review_in_transaction(transaction: Transaction):
            card_snapshot = card_ref.get(transaction=transaction)
            if not card_snapshot.exists:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found.")
                
            card_data = card_snapshot.to_dict() or {}
            if card_data.get("user_id") != user_id:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized.")

            # Current SR State
            prev_interval = card_data.get("interval", 0)
            prev_ease = card_data.get("ease_factor", 2.5)
            review_count = card_data.get("review_count", 0)
            
            # SR Logic calculation
            new_ease = prev_ease
            new_interval = prev_interval
            
            if payload.rating == ReviewRating.EASY:
                new_ease = prev_ease + 0.15
                new_interval = 4 if prev_interval == 0 else int(prev_interval * new_ease)
            elif payload.rating == ReviewRating.MEDIUM:
                new_interval = 1 if prev_interval == 0 else int(prev_interval * 1.5) # Medium doesn't boost ease factor, just expands standard
            elif payload.rating == ReviewRating.HARD:
                new_ease = max(1.3, prev_ease - 0.15)
                new_interval = max(1, int(prev_interval / 2)) # Shorter wait time
            elif payload.rating == ReviewRating.UNKNOWN:
                new_ease = max(1.3, prev_ease - 0.20)
                new_interval = 0 # Need to see it again tomorrow/immediately
                
            # Keep numbers clean
            new_ease = round(new_ease, 2)
            review_time = datetime.now(timezone.utc)
            next_review = review_time + timedelta(days=new_interval)
            
            # 1. Update Card Document
            transaction.update(card_ref, {
                "next_review_at": next_review,
                "interval": new_interval,
                "ease_factor": new_ease,
                "review_count": review_count + 1,
                "updated_at": review_time
            })
            
            # 2. Write Review Record Document
            record_data = {
                "user_id": user_id,
                "deck_id": card_data.get("deck_id"),
                "card_id": card_id,
                "rating": payload.rating.value,
                "reviewed_at": review_time,
                "previous_interval": prev_interval,
                "new_interval": new_interval,
                "previous_ease_factor": prev_ease,
                "new_ease_factor": new_ease
            }
            transaction.set(record_ref, record_data)
            
            return ReviewResponse(
                id=record_ref.id,
                **record_data
            )
            
        transaction = self.firestore_client.transaction()
        return review_in_transaction(transaction)

def get_review_service() -> ReviewService:
    return ReviewService(get_firestore_client())
