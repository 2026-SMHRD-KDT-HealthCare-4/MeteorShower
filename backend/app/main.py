from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent.parent / '.env')

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import auth, chat, doctor_dashboard, doctor_notifications, health, notifications, patients, reports, ws

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
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
