import os
import uuid
from pathlib import Path
from urllib.parse import quote


def _resolve_service_account_path(path_value: str) -> Path:
    path = Path(path_value)
    if path.is_absolute() and path.exists():
        return path
    if path.exists():
        return path.resolve()

    backend_dir = Path(__file__).resolve().parents[2]
    backend_relative = backend_dir / path_value
    if backend_relative.exists():
        return backend_relative

    return path


def _get_bucket():
    try:
        import firebase_admin
        from firebase_admin import credentials, storage
    except ImportError as exc:
        raise RuntimeError("firebase-admin package is not installed") from exc

    service_account_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    bucket_name = os.getenv("FIREBASE_STORAGE_BUCKET")
    if not service_account_path or not bucket_name:
        raise RuntimeError("Firebase environment variables are missing")

    if not firebase_admin._apps:
        resolved_path = _resolve_service_account_path(service_account_path)
        if not resolved_path.exists():
            raise RuntimeError(f"Firebase service account file not found: {resolved_path}")
        cred = credentials.Certificate(str(resolved_path))
        firebase_admin.initialize_app(cred, {"storageBucket": bucket_name})

    return storage.bucket()


def upload_bytes_to_firebase(data: bytes, path: str, content_type: str) -> str:
    """Upload binary data to Firebase Storage and return a download URL."""
    bucket = _get_bucket()
    blob = bucket.blob(path)
    download_token = str(uuid.uuid4())
    blob.metadata = {"firebaseStorageDownloadTokens": download_token}
    blob.upload_from_string(data, content_type=content_type)

    encoded_path = quote(path, safe="")
    return (
        f"https://firebasestorage.googleapis.com/v0/b/{bucket.name}/o/"
        f"{encoded_path}?alt=media&token={download_token}"
    )
