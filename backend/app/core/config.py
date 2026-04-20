import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parents[2]
load_dotenv(BASE_DIR / ".env")
DEFAULT_FIREBASE_STORAGE_BUCKET = "lexicoreweb.firebasestorage.app"


def _resolve_path(raw_path: str) -> Path:
    path = Path(raw_path).expanduser()
    if path.is_absolute():
        return path
    return BASE_DIR / path


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    app_name: str
    app_env: str
    api_prefix: str
    cors_origins: list[str]
    firebase_project_id: str
    firebase_service_account_path: Path
    firebase_storage_bucket: str

@lru_cache
def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "LexiCore API"),
        app_env=os.getenv("APP_ENV", "development"),
        api_prefix=os.getenv("API_PREFIX", "/api"),
        cors_origins=_split_csv(os.getenv("CORS_ORIGINS", "http://localhost:5173")),
        firebase_project_id=os.getenv("FIREBASE_PROJECT_ID", ""),
        firebase_service_account_path=_resolve_path(
            os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "service-account.json")
        ),
        firebase_storage_bucket=os.getenv(
            "FIREBASE_STORAGE_BUCKET", DEFAULT_FIREBASE_STORAGE_BUCKET
        ),
    )
