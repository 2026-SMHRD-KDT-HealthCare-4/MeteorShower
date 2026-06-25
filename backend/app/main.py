import os
import logging
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / '.env')

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import auth, chat, doctor_dashboard, doctor_notifications, health, notifications, patients, reports, ws
from database import SessionLocal
from models.exercise import Exercise
import rag

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 서버 시작 시 운동 데이터를 RAG 벡터 DB에 색인
    try:
        db = SessionLocal()
        exercises = db.query(Exercise).all()
        db.close()
        rag.index_exercises([
            {"id": ex.exercise_id, "name": ex.exercise_name, "duration": ex.estimated_duration}
            for ex in exercises
        ])
        print(f"[RAG] {len(exercises)}개 운동 색인 완료")
    except Exception as e:
        print(f"[RAG] 색인 실패 (서버는 정상 동작): {e}")
    yield


app = FastAPI(lifespan=lifespan)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "내부 서버 오류가 발생했습니다."})


app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(patients.router)
app.include_router(notifications.router)
app.include_router(doctor_notifications.router)
app.include_router(doctor_dashboard.router)
app.include_router(reports.router)
app.include_router(ws.router)
app.include_router(chat.router)
