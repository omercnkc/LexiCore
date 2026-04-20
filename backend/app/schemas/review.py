from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field

class ReviewRating(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    UNKNOWN = "unknown"

class ReviewRequest(BaseModel):
    rating: ReviewRating

class ReviewResponse(BaseModel):
    id: str
    user_id: str
    deck_id: str
    card_id: str
    rating: ReviewRating
    reviewed_at: datetime
    previous_interval: int
    new_interval: int
    previous_ease_factor: float
    new_ease_factor: float

class StudyQueueResponse(BaseModel):
    items: list[dict] # Will use CardResponse schema directly in routing
    total_due: int
    deck_id: str
