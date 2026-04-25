from typing import Any

import firebase_admin
from firebase_admin import auth, credentials, firestore, storage

from app.core.config import get_settings

_firebase_app = None
_firestore_client = None


def get_firebase_app():
    global _firebase_app

    if _firebase_app is not None:
        return _firebase_app

    try:
        _firebase_app = firebase_admin.get_app()
        return _firebase_app
    except ValueError:
        pass

    settings = get_settings()

    if not settings.firebase_service_account_path.exists():
        raise RuntimeError(
            "Firebase service account file not found. "
            "Set FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env."
        )

    certificate = credentials.Certificate(str(settings.firebase_service_account_path))
    options = {}
    if settings.firebase_project_id:
        options["projectId"] = settings.firebase_project_id
    if settings.firebase_storage_bucket:
        options["storageBucket"] = settings.firebase_storage_bucket
        
    _firebase_app = firebase_admin.initialize_app(certificate, options=options)
    return _firebase_app


def verify_firebase_token(id_token: str) -> dict[str, Any]:
    get_firebase_app()
    return auth.verify_id_token(id_token)


def get_firestore_client():
    global _firestore_client

    if _firestore_client is not None:
        return _firestore_client

    firebase_app = get_firebase_app()
    _firestore_client = firestore.client(app=firebase_app)
    return _firestore_client

def get_storage_bucket():
    firebase_app = get_firebase_app()
    settings = get_settings()
    return storage.bucket(name=settings.firebase_storage_bucket, app=firebase_app)
