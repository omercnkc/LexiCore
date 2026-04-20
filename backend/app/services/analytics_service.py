from datetime import datetime, timedelta, timezone
from typing import Any

from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.firebase_admin import get_firestore_client
from app.schemas.analytics import DashboardSummaryResponse, DailyProgress, WeeklyProgressResponse
from app.schemas.review import ReviewRating

class AnalyticsService:
    records_collection_name = "review_records"
    decks_collection_name = "decks"
    cards_collection_name = "cards"

    def __init__(self, firestore_client):
        self.firestore_client = firestore_client

    @property
    def records_collection(self):
        return self.firestore_client.collection(self.records_collection_name)
        
    @property
    def decks_collection(self):
        return self.firestore_client.collection(self.decks_collection_name)
        
    @property
    def cards_collection(self):
        return self.firestore_client.collection(self.cards_collection_name)

    def get_dashboard_summary(self, *, user_id: str) -> DashboardSummaryResponse:
        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        seven_days_ago = today_start - timedelta(days=6)
        
        # 1. Total decks & total cards
        decks_snapshots = self.decks_collection.where(filter=FieldFilter("user_id", "==", user_id)).stream()
        total_decks = 0
        total_cards = 0
        deck_map = {}
        for snap in decks_snapshots:
            d = snap.to_dict() or {}
            total_decks += 1
            total_cards += self._coerce_int(d.get("card_count"))
            deck_map[snap.id] = d.get("title", "Unknown Deck")

        # 2. Optimized Cards due today 
        # CAUTION: This requires a Firestore Composite Index on:
        # Collection: cards | Fields: user_id (Ascending), next_review_at (Ascending)
        
        cards_due_today = 0
        try:
            # Shift processing exclusively to the DB
            due_query = (
                self.cards_collection.where(filter=FieldFilter("user_id", "==", user_id))
                .where(filter=FieldFilter("next_review_at", "<=", now))
                .count()
            )

            # google-cloud-firestore aggregation responses vary by version; parse defensively.
            cards_due_today = self._parse_count_result(due_query.get())
        except Exception as e:
            print(f"Warning: Ensure Composite Index is built. Falling back. Error: {e}")
            for snap in self.cards_collection.where(filter=FieldFilter("user_id", "==", user_id)).stream():
                c = snap.to_dict() or {}
                next_review = self._normalize_datetime(c.get("next_review_at"))
                if next_review and next_review <= now:
                    cards_due_today += 1
        # 3. Reviews metrics
        # Fetch user reviews and filter in Python to avoid composite index requirements.
        reviews_last_7_days = 0
        reviews_today = 0
        total_score = 0
        
        # For weakest deck calculation
        deck_scores = {}
        
        for snap in self.records_collection.where(filter=FieldFilter("user_id", "==", user_id)).stream():
            r = snap.to_dict() or {}
            rev_time = self._normalize_datetime(r.get("reviewed_at"))
            if rev_time is None or rev_time < seven_days_ago or rev_time > now:
                continue

            reviews_last_7_days += 1
            if rev_time >= today_start:
                reviews_today += 1
                
            rating = r.get("rating")
            score = self._rating_to_score(rating)
            total_score += score
            
            d_id = r.get("deck_id")
            if d_id:
                if d_id not in deck_scores:
                    deck_scores[d_id] = {"score_sum": 0, "count": 0}
                deck_scores[d_id]["score_sum"] += score
                deck_scores[d_id]["count"] += 1

        avg_accuracy = (total_score / reviews_last_7_days) if reviews_last_7_days > 0 else 0.0
        
        # Find weakest deck
        weakest_deck_name = None
        lowest_avg = 101.0
        for d_id, stats in deck_scores.items():
            if stats["count"] >= 3: # Need at least 3 reviews to be statistically relevant
                avg = stats["score_sum"] / stats["count"]
                if avg < lowest_avg:
                    lowest_avg = avg
                    weakest_deck_name = deck_map.get(d_id, "Unknown Deck")
                    
        if total_decks > 0 and weakest_deck_name is None:
            # Fallback if no reviews yet or not enough data
            weakest_deck_name = "Not enough study data"
            
        return DashboardSummaryResponse(
            cards_due_today=cards_due_today,
            total_decks=total_decks,
            total_cards=total_cards,
            reviews_today=reviews_today,
            reviews_last_7_days=reviews_last_7_days,
            average_accuracy=round(avg_accuracy, 1),
            weakest_deck_name=weakest_deck_name
        )

    def get_weekly_progress(self, *, user_id: str) -> WeeklyProgressResponse:
        now = datetime.now(timezone.utc)
        today_start = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)
        
        # Generate last 7 days buckets
        days_map = {}
        ordered_dates = []
        for i in range(6, -1, -1):
            day_date = (today_start - timedelta(days=i)).strftime("%Y-%m-%d")
            ordered_dates.append(day_date)
            days_map[day_date] = {"count": 0, "score_sum": 0}
            
        seven_days_ago = today_start - timedelta(days=6)

        for snap in self.records_collection.where(filter=FieldFilter("user_id", "==", user_id)).stream():
            r = snap.to_dict() or {}
            rev_time = self._normalize_datetime(r.get("reviewed_at"))
            if rev_time is None or rev_time < seven_days_ago or rev_time > now:
                continue

            date_str = rev_time.strftime("%Y-%m-%d")
            if date_str in days_map:
                days_map[date_str]["count"] += 1
                days_map[date_str]["score_sum"] += self._rating_to_score(r.get("rating"))
                    
        results = []
        for d_str in ordered_dates:
            stats = days_map[d_str]
            acc = (stats["score_sum"] / stats["count"]) if stats["count"] > 0 else 0.0
            results.append(DailyProgress(
                date=d_str,
                review_count=stats["count"],
                accuracy=round(acc, 1)
            ))
            
        return WeeklyProgressResponse(days=results)

    def _rating_to_score(self, rating: str) -> float:
        # MVP Scoring Logic:
        # Easy = 100% (strongest path)
        # Medium = 80% (acceptable recall)
        # Hard = 50% (weak recall)
        # Unknown = 0% (failed recall)
        if rating == ReviewRating.EASY.value:
            return 100.0
        elif rating == ReviewRating.MEDIUM.value:
            return 80.0
        elif rating == ReviewRating.HARD.value:
            return 50.0
        return 0.0

    def _normalize_datetime(self, value: Any) -> datetime | None:
        if value is None:
            return None

        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.replace(tzinfo=timezone.utc)
            return value.astimezone(timezone.utc)

        if hasattr(value, "ToDatetime"):
            converted = value.ToDatetime()
            if converted.tzinfo is None:
                return converted.replace(tzinfo=timezone.utc)
            return converted.astimezone(timezone.utc)

        return None

    def _coerce_int(self, value: Any, default: int = 0) -> int:
        if value is None:
            return default

        if isinstance(value, bool):
            return int(value)

        if isinstance(value, int):
            return value

        if isinstance(value, float):
            return int(value)

        try:
            return int(value)
        except (TypeError, ValueError):
            return default

    def _parse_count_result(self, result: Any) -> int:
        if not result:
            return 0

        first = result[0]

        if isinstance(first, list) and first:
            first = first[0]

        if hasattr(first, "value"):
            return self._coerce_int(first.value)

        if isinstance(first, dict):
            for value in first.values():
                if hasattr(value, "value"):
                    return self._coerce_int(value.value)
                return self._coerce_int(value)

        try:
            return self._coerce_int(first[0].value)
        except (TypeError, KeyError, IndexError, AttributeError):
            return self._coerce_int(first)

def get_analytics_service() -> AnalyticsService:
    return AnalyticsService(get_firestore_client())
