from pydantic import BaseModel
from typing import List, Optional

class CandidateTerm(BaseModel):
    term: str
    translation: Optional[str] = None
    example_sentence: Optional[str] = None
    hint: Optional[str] = None
    context: Optional[str] = None

class ExtractResponse(BaseModel):
    upload_id: str
    terms: List[CandidateTerm]

class GenerateCardsRequest(BaseModel):
    upload_id: str
    deck_id: Optional[str] = None
    deck_title: Optional[str] = None
    course_name: Optional[str] = None
    topic_name: Optional[str] = None
    terms: List[str]

class UploadResponse(BaseModel):
    id: str
    file_name: str
    status: str

