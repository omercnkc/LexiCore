from fastapi import APIRouter, Depends

from app.dependencies.auth import AuthenticatedUser, get_current_user

router = APIRouter()


@router.get("/me")
async def get_me(current_user: AuthenticatedUser = Depends(get_current_user)):
    return current_user.model_dump()

