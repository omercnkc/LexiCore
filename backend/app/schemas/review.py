from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field

class ReviewRating(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    UNKNOWN = "unknown"

class ReviewRequest(BaseModel):
    rating: ReviewRating
    is_correct: Optional[bool] = None
    similarity_score: Optional[float] = Field(None, ge=0, le=100)
    user_answer: Optional[str] = Field(None, max_length=500)

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
    is_correct: Optional[bool] = None
    similarity_score: Optional[float] = None
    user_answer: Optional[str] = None

class StudyQueueResponse(BaseModel):
    items: list[dict] # Will use CardResponse schema directly in routing
    total_due: int
    deck_id: str

