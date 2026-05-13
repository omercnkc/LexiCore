from pydantic import BaseModel, Field


class AnswerCheckRequest(BaseModel):
    user_answer: str = Field(min_length=1, max_length=500)


class AnswerCheckResponse(BaseModel):
    is_correct: bool
    similarity_score: float = Field(ge=0, le=100)
    correct_answer: str
    feedback: str
