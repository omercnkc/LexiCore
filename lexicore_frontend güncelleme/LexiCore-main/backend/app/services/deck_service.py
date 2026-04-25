from datetime import datetime, timezone

from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.firebase_admin import get_firestore_client
from app.schemas.deck import DeckCreateRequest, DeckResponse, DeckSourceType


class DeckService:
    collection_name = "decks"

    def __init__(self, firestore_client):
        self.firestore_client = firestore_client

    @property
    def collection(self):
        return self.firestore_client.collection(self.collection_name)

    def create_deck(
        self,
        *,
        user_id: str,
        payload: DeckCreateRequest,
        source_type: DeckSourceType = DeckSourceType.MANUAL,
        source_file_name: str | None = None,
    ) -> DeckResponse:
        timestamp = datetime.now(timezone.utc)
        deck_ref = self.collection.document()
        deck_data = {
            "user_id": user_id,
            "title": payload.title,
            "course_name": payload.course_name,
            "topic_name": payload.topic_name,
            "source_type": source_type.value,
            "source_file_name": source_file_name,
            "created_at": timestamp,
            "updated_at": timestamp,
            "card_count": 0,
            "progress_percent": 0.0,
        }
        deck_ref.set(deck_data)
        return self._to_response(deck_ref.id, deck_data)

    def list_user_decks(self, *, user_id: str) -> list[DeckResponse]:
        snapshots = self.collection.where(filter=FieldFilter("user_id", "==", user_id)).stream()
        decks = [self._to_response(snapshot.id, snapshot.to_dict() or {}) for snapshot in snapshots]
        return sorted(decks, key=lambda deck: deck.created_at, reverse=True)

    def get_user_deck(self, *, user_id: str, deck_id: str) -> DeckResponse | None:
        snapshot = self.collection.document(deck_id).get()
        if not snapshot.exists:
            return None

        deck_data = snapshot.to_dict() or {}
        if deck_data.get("user_id") != user_id:
            return None

        return self._to_response(snapshot.id, deck_data)

    def delete_deck(self, *, user_id: str, deck_id: str) -> bool:
        deck_ref = self.collection.document(deck_id)
        snapshot = deck_ref.get()
        if not snapshot.exists:
            return False
            
        deck_data = snapshot.to_dict() or {}
        if deck_data.get("user_id") != user_id:
            return False

        cards_ref = self.firestore_client.collection("cards")
        card_docs = cards_ref.where(filter=FieldFilter("user_id", "==", user_id)).where(filter=FieldFilter("deck_id", "==", deck_id)).stream()

        batch = self.firestore_client.batch()
        ops_count = 0

        for doc in card_docs:
            batch.delete(doc.reference)
            ops_count += 1
            if ops_count == 490:  # Reserve space for safe transaction limits (< 500)
                batch.commit()
                batch = self.firestore_client.batch()
                ops_count = 0

        # Finally, delete the deck itself
        batch.delete(deck_ref)
        batch.commit()

        return True

    def _to_response(self, deck_id: str, deck_data: dict) -> DeckResponse:
        return DeckResponse(
            id=deck_id,
            user_id=deck_data["user_id"],
            title=deck_data["title"],
            course_name=deck_data["course_name"],
            topic_name=deck_data["topic_name"],
            source_type=deck_data.get("source_type", DeckSourceType.MANUAL.value),
            source_file_name=deck_data.get("source_file_name"),
            created_at=deck_data["created_at"],
            updated_at=deck_data["updated_at"],
            card_count=deck_data.get("card_count", 0),
            progress_percent=deck_data.get("progress_percent", 0.0),
        )


def get_deck_service() -> DeckService:
    return DeckService(get_firestore_client())
