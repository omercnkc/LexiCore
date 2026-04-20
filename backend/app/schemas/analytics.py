from datetime import datetime
from pydantic import BaseModel

class DashboardSummaryResponse(BaseModel):
    cards_due_today: int
    total_decks: int
    total_cards: int
    reviews_today: int
    reviews_last_7_days: int
    average_accuracy: float
    weakest_deck_name: str | None

class DailyProgress(BaseModel):
    date: str # YYYY-MM-DD
    review_count: int
    accuracy: float

class WeeklyProgressResponse(BaseModel):
    days: list[DailyProgress]
