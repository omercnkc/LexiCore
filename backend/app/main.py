from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import get_settings
from app.core.firebase_admin import get_firebase_app

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    # Fail fast if Firebase Admin is misconfigured so auth issues surface at startup.
    get_firebase_app()
    yield


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", tags=["root"])
async def root():
    return {"message": "LexiCore API is running."}
