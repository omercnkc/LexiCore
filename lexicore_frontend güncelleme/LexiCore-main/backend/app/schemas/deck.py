from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class DeckSourceType(str, Enum):
    MANUAL = "manual"
    FILE = "file"


class DeckCreateRequest(BaseModel):
    title: str = Field(min_length=1, max_length=120)
    course_name: str = Field(min_length=1, max_length=120)
    topic_name: str = Field(min_length=1, max_length=120)

    @field_validator("title", "course_name", "topic_name")
    @classmethod
    def strip_and_validate(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("This field cannot be blank.")
        return cleaned


class DeckResponse(BaseModel):
    id: str
    user_id: str
    title: str
    course_name: str
    topic_name: str
    source_type: DeckSourceType
    source_file_name: str | None = None
    created_at: datetime
    updated_at: datetime
    card_count: int = Field(ge=0)
    progress_percent: float = Field(ge=0, le=100)


class DeckListResponse(BaseModel):
    items: list[DeckResponse]
    total: int
