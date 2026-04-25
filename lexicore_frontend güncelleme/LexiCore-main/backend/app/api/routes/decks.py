from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies.auth import AuthenticatedUser, get_current_user
from app.schemas.deck import DeckCreateRequest, DeckListResponse, DeckResponse
from app.services.deck_service import DeckService, get_deck_service
from app.schemas.card import CardCreateRequest, CardListResponse, CardResponse
from app.services.card_service import CardService, get_card_service
from app.schemas.review import StudyQueueResponse
from app.services.review_service import ReviewService, get_review_service

router = APIRouter()


@router.post("", response_model=DeckResponse, status_code=status.HTTP_201_CREATED)
async def create_deck(
    payload: DeckCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    deck_service: DeckService = Depends(get_deck_service),
):
    return deck_service.create_deck(user_id=current_user.uid, payload=payload)


@router.get("", response_model=DeckListResponse)
async def list_decks(
    current_user: AuthenticatedUser = Depends(get_current_user),
    deck_service: DeckService = Depends(get_deck_service),
):
    decks = deck_service.list_user_decks(user_id=current_user.uid)
    return DeckListResponse(items=decks, total=len(decks))


@router.get("/{deck_id}", response_model=DeckResponse)
async def get_deck(
    deck_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    deck_service: DeckService = Depends(get_deck_service),
):
    deck = deck_service.get_user_deck(user_id=current_user.uid, deck_id=deck_id)
    if deck is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found.")

    return deck


@router.delete("/{deck_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_deck(
    deck_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    deck_service: DeckService = Depends(get_deck_service),
):
    success = deck_service.delete_deck(user_id=current_user.uid, deck_id=deck_id)
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deck not found.")

@router.post("/{deck_id}/cards", response_model=CardResponse, status_code=status.HTTP_201_CREATED)
async def create_deck_card(
    deck_id: str,
    payload: CardCreateRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    card_service: CardService = Depends(get_card_service),
):
    return card_service.create_card(user_id=current_user.uid, deck_id=deck_id, payload=payload)

@router.get("/{deck_id}/cards", response_model=CardListResponse)
async def list_deck_cards(
    deck_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    card_service: CardService = Depends(get_card_service),
):
    cards = card_service.list_deck_cards(user_id=current_user.uid, deck_id=deck_id)
    return CardListResponse(items=cards, total=len(cards))

@router.get("/{deck_id}/study", response_model=StudyQueueResponse)
async def get_study_queue(
    deck_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    review_service: ReviewService = Depends(get_review_service),
):
    cards = review_service.get_study_queue(user_id=current_user.uid, deck_id=deck_id)
    return StudyQueueResponse(items=cards, total_due=len(cards), deck_id=deck_id)
