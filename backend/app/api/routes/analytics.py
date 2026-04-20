from fastapi import APIRouter, Depends
from app.dependencies.auth import AuthenticatedUser, get_current_user
from app.schemas.analytics import DashboardSummaryResponse, WeeklyProgressResponse
from app.services.analytics_service import AnalyticsService, get_analytics_service

router = APIRouter()

@router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    current_user: AuthenticatedUser = Depends(get_current_user),
    analytics_service: AnalyticsService = Depends(get_analytics_service),
):
    return analytics_service.get_dashboard_summary(user_id=current_user.uid)

@router.get("/weekly-progress", response_model=WeeklyProgressResponse)
async def get_weekly_progress(
    current_user: AuthenticatedUser = Depends(get_current_user),
    analytics_service: AnalyticsService = Depends(get_analytics_service),
):
    return analytics_service.get_weekly_progress(user_id=current_user.uid)
