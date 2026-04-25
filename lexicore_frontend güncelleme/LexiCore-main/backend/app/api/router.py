from fastapi import APIRouter

from app.api.routes.decks import router as decks_router
from app.api.routes.health import router as health_router
from app.api.routes.users import router as users_router
from app.api.routes.cards import router as cards_router
from app.api.routes.analytics import router as analytics_router
from app.api.routes.uploads import router as uploads_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(decks_router, prefix="/decks", tags=["decks"])
api_router.include_router(users_router, prefix="/users", tags=["users"])
api_router.include_router(cards_router, prefix="/cards", tags=["cards"])
api_router.include_router(analytics_router, prefix="/dashboard", tags=["analytics"])
api_router.include_router(uploads_router, prefix="/uploads", tags=["uploads"])
