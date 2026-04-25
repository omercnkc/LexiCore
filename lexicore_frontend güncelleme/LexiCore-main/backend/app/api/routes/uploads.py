from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from app.dependencies.auth import AuthenticatedUser, get_current_user
from app.services.upload_service import UploadService, get_upload_service
from app.schemas.upload import UploadResponse, ExtractResponse, GenerateCardsRequest

router = APIRouter()

@router.post("", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    current_user: AuthenticatedUser = Depends(get_current_user),
    upload_service: UploadService = Depends(get_upload_service),
):
    return await upload_service.process_upload(user_id=current_user.uid, file=file)

@router.post("/{upload_id}/extract", response_model=ExtractResponse)
async def extract_terms(
    upload_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
    upload_service: UploadService = Depends(get_upload_service),
):
    terms = upload_service.extract_terms(user_id=current_user.uid, upload_id=upload_id)
    return ExtractResponse(upload_id=upload_id, terms=terms)

@router.post("/{upload_id}/generate-cards")
async def generate_cards(
    upload_id: str,
    payload: GenerateCardsRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
    upload_service: UploadService = Depends(get_upload_service),
):
    if payload.upload_id != upload_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Mismatched upload ID")
        
    deck_id = upload_service.generate_cards(user_id=current_user.uid, payload=payload)
    return {"message": "Cards generated successfully", "deck_id": deck_id}
