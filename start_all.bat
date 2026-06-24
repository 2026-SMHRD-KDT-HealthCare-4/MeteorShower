@echo off
chcp 65001 >nul
set ROOT=%~dp0

start "AI Server (8000)" cmd /k "cd /d "%ROOT%ai" && call "%ROOT%venv\Scripts\activate.bat" && python websocket_server.py"

start "Backend Server (8001)" cmd /k "cd /d "%ROOT%backend\app" && call "%ROOT%backend\venv\Scripts\activate.bat" && uvicorn main:app --host 0.0.0.0 --port 8001 --reload"

start "Frontend (5173)" cmd /k "cd /d "%ROOT%frontend" && npm run dev"
