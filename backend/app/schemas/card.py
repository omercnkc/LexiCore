from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class CardCreateRequest(BaseModel):
    term: str = Field(min_length=1, max_length=200)
    translation: str = Field(min_length=1, max_length=200)
    pronunciation: Optional[str] = Field(None, max_length=100)
    example_sentence: Optional[str] = Field(None, max_length=500)
    example_translation: Optional[str] = Field(None, max_length=500)
    hint: Optional[str] = Field(None, max_length=300)
    source_reference: Optional[str] = Field(None, max_length=200)

    @field_validator("term", "translation")
    @classmethod
    def strip_and_validate(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank.")
        return cleaned


class CardUpdateRequest(BaseModel):
    term: Optional[str] = Field(None, min_length=1, max_length=200)
    translation: Optional[str] = Field(None, min_length=1, max_length=200)
    pronunciation: Optional[str] = Field(None, max_length=100)
    example_sentence: Optional[str] = Field(None, max_length=500)
    example_translation: Optional[str] = Field(None, max_length=500)
    hint: Optional[str] = Field(None, max_length=300)
    source_reference: Optional[str] = Field(None, max_length=200)

    @field_validator("term", "translation")
    @classmethod
    def strip_and_validate(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            cleaned = value.strip()
            if not cleaned:
                raise ValueError("This field cannot be blank.")
            return cleaned
        return value


class CardResponse(BaseModel):
    id: str
    deck_id: str
    user_id: str
    term: str
    translation: str
    pronunciation: Optional[str] = None
    example_sentence: Optional[str] = None
    example_translation: Optional[str] = None
    hint: Optional[str] = None
    source_reference: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # SR Study Mode Fields
    next_review_at: datetime
    interval: int
    ease_factor: float
    review_count: int

class CardListResponse(BaseModel):
    items: list[CardResponse]
    total: int
