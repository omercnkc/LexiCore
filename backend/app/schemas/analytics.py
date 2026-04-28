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
    # AI answer tracking
    total_correct: int = 0
    total_wrong: int = 0
    answer_accuracy_percent: float = 0.0
    avg_similarity_score: float = 0.0

class DailyProgress(BaseModel):
    date: str # YYYY-MM-DD
    review_count: int
    accuracy: float
    correct_count: int = 0
    wrong_count: int = 0

class WeeklyProgressResponse(BaseModel):
    days: list[DailyProgress]

