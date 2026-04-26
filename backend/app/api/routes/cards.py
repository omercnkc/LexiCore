from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import AuthenticatedUser, get_current_user
from app.schemas.card import CardResponse, CardUpdateRequest
from app.services.card_service import CardService, get_card_service
from app.schemas.review import ReviewRequest, ReviewResponse
from app.services.review_service import ReviewService, get_review_service
from app.schemas.answer import AnswerCheckRequest, AnswerCheckResponse
from app.services.gemini_service import check_answer_similarity

router = APIRouter()

@router.get("/{card_id}", response_model=CardResponse)
async def get_card(
    card_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    card_service: CardService = Depends(get_card_service),
):
    card = card_service.get_card(user_id=current_user.uid, card_id=card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found.")

    return card

@router.patch("/{card_id}", response_model=CardResponse)
async def update_card(
    card_id: str,
    payload: CardUpdateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    card_service: CardService = Depends(get_card_service),
):
    card = card_service.update_card(user_id=current_user.uid, card_id=card_id, payload=payload)
    if card is None:
        # We return 404 both for non-existent and not-owned
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found.")

    return card

@router.delete("/{card_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_card(
    card_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    card_service: CardService = Depends(get_card_service),
):
    success = card_service.delete_card(user_id=current_user.uid, card_id=card_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found.")

@router.post("/{card_id}/review", response_model=ReviewResponse)
async def submit_card_review(
    card_id: str,
    payload: ReviewRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    review_service: ReviewService = Depends(get_review_service),
):
    return review_service.submit_review(user_id=current_user.uid, card_id=card_id, payload=payload)


@router.post("/{card_id}/check-answer", response_model=AnswerCheckResponse)
async def check_card_answer(
    card_id: str,
    payload: AnswerCheckRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    card_service: CardService = Depends(get_card_service),
):
    card = card_service.get_card(user_id=current_user.uid, card_id=card_id)
    if card is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Card not found.")

    try:
        result = check_answer_similarity(
            term=card.term,
            correct_answer=card.translation,
            user_answer=payload.user_answer,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    return AnswerCheckResponse(
        is_correct=result["is_correct"],
        similarity_score=result["similarity_score"],
        correct_answer=card.term,
        feedback=result["feedback"],
    )

