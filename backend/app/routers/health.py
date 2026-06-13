from fastapi import APIRouter
from sqlalchemy import create_engine, text
import os

router = APIRouter()

engine = create_engine(os.getenv("DATABASE_URL"))

@router.get("/health")
def health():
    return {"status": "ok"}

@router.get("/db-health")
def db_health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"db": "connected"}
    except Exception as e:
        return {"db": "error", "detail": str(e)}