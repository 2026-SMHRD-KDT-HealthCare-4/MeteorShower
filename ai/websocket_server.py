"""MediaPipe 손 트래킹 데이터를 개별 세션으로 격리하여 실시간 스트리밍하는 FastAPI 서버(AI 서버 포트 8000)."""
import asyncio
import base64
import os
import queue as stdlib_queue
import sys
import threading
from contextlib import asynccontextmanager
from typing import AsyncIterator, List, Optional, Dict, Any

import cv2
from dotenv import load_dotenv
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
import numpy as np
import uvicorn

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=True)

SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"

sys.path.insert(0, os.path.dirname(__file__))
from hand_tracking import run_tracking

# ---------------------------------------------------------
# 1. Session Manager (사용자별 1:1 격리 관리)
# ---------------------------------------------------------
class SessionManager:
    def __init__(self) -> None:
        # 웹소켓 객체를 키(key)로 하여 개별 큐와 스레드를 저장합니다.
        # { websocket: {"frame_queue": Queue, "data_queue": Queue, "stop_event": Event, "session_complete_event": Event, "thread": Thread} }
        self.active_sessions: Dict[WebSocket, Dict[str, Any]] = {}

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        # 접속한 사용자만을 위한 독립적인 자원 할당
        self.active_sessions[ws] = {
            "frame_queue": stdlib_queue.Queue(maxsize=3),
            "data_queue": stdlib_queue.Queue(maxsize=10),
            "stop_event": threading.Event(),
            "session_complete_event": threading.Event(),
            "thread": None
        }
        print(f"[WS] connected  (total={len(self.active_sessions)})")

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active_sessions:
            session = self.active_sessions[ws]
            # 연결이 끊어지면 진행 중인 AI 스레드 종료 신호 전달
            if session.get("stop_event"):
                session["stop_event"].set()
            del self.active_sessions[ws]
        print(f"[WS] disconnected (total={len(self.active_sessions)})")

session_manager = SessionManager()

# ---------------------------------------------------------
# 2. 개별 트래킹 제어 함수
# ---------------------------------------------------------
def start_client_tracking(ws: WebSocket, kwargs_data: dict) -> None:
    session = session_manager.active_sessions.get(ws)
    if not session:
        return

    # 이미 이 사용자의 스레드가 돌고 있다면 중지 신호를 보냄
    if session["thread"] and session["thread"].is_alive():
        if not session["session_complete_event"].is_set():
            return  # 운동이 진행 중이면 중복 실행 방지
        session["stop_event"].set()
        print(f"[Server] Restarting tracking for next exercise (patient_id: {kwargs_data.get('patient_id')})")

    # 이벤트 초기화 (새로운 운동 시작)
    session["session_complete_event"].clear()
    session["stop_event"] = threading.Event()

    # 이 사용자 전용 스레드 시작
    session["thread"] = threading.Thread(
        target=run_tracking,
        kwargs={
            "q": session["data_queue"],
            "frame_queue": session["frame_queue"] if kwargs_data.get("use_client_frames") else None,
            "stop_event": session["stop_event"],
            "session_complete_event": session["session_complete_event"],
            "show_window": False,
            "patient_id": kwargs_data.get("patient_id"),
            "doctor_id": kwargs_data.get("doctor_id"),
            "hand": kwargs_data.get("hand", "left"),
            "finger_rom_targets": kwargs_data.get("finger_rom_targets"),
            "exercise_name": kwargs_data.get("exercise_name"),
            "target_count": kwargs_data.get("target_count"),
            "target_set": kwargs_data.get("target_set"),
        },
        daemon=True,
        name=f"hand_tracking_{kwargs_data.get('patient_id')}",
    )
    session["thread"].start()
    print(f"[Server] Tracking thread started for patient {kwargs_data.get('patient_id')}")

def stop_client_tracking(ws: WebSocket) -> None:
    session = session_manager.active_sessions.get(ws)
    if session and session["stop_event"]:
        session["stop_event"].set()
        print("[Server] Tracking stop requested for user")

def decode_client_frame(image_data: str):
    if not image_data:
        return None
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]
    frame_bytes = base64.b64decode(image_data)
    np_arr = np.frombuffer(frame_bytes, dtype=np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)

def enqueue_client_frame(ws: WebSocket, frame) -> None:
    session = session_manager.active_sessions.get(ws)
    if not session or frame is None:
        return
    
    queue = session["frame_queue"]
    try:
        queue.put_nowait(frame)
    except stdlib_queue.Full:
        try: queue.get_nowait()
        except stdlib_queue.Empty: pass
        try: queue.put_nowait(frame)
        except stdlib_queue.Full: pass

# ---------------------------------------------------------
# 3. 1:1 개인화 전송 루프 (브로드캐스트 대체)
# ---------------------------------------------------------
async def send_personal_data_loop(ws: WebSocket) -> None:
    """자신의 세션 data_queue에 쌓인 분석 결과만 자신에게 전송한다."""
    session = session_manager.active_sessions.get(ws)
    if not session:
        return
        
    data_queue = session["data_queue"]
    frame_log_counter = 0

    while ws in session_manager.active_sessions:
        try:
            data = data_queue.get_nowait()
            await ws.send_json(data)
            
            frame_log_counter += 1
            if frame_log_counter % 30 == 1:
                has_frame = "frame" in data and bool(data["frame"])
                print(f"[Send] 1:1 frame #{frame_log_counter} has_frame={has_frame}")
                
        except stdlib_queue.Empty:
            await asyncio.sleep(0.016) # ~60fps 대기
        except Exception as e:
            print(f"[Send Error] {e}")
            break

# ---------------------------------------------------------
# 4. FastAPI 앱 설정 및 WebSocket 엔드포인트
# ---------------------------------------------------------
app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)) -> None:
    # 1. JWT 환자 인증
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "patient":
            print(f"[WS Auth] role 불일치: {payload.get('role')}")
            await websocket.close(code=4001, reason="unauthorized")
            return
        patient_id = int(payload["sub"])
        print(f"[WS Auth] 인증 성공 patient_id={patient_id}")
    except Exception:
        await websocket.close(code=4001, reason="invalid token")
        return

    # 2. 세션 연결 및 개인화 송신 태스크 실행
    await session_manager.connect(websocket)
    send_task = asyncio.create_task(send_personal_data_loop(websocket))

    # 3. 메시지 수신 루프
    try:
        while True:
            msg = await websocket.receive_json()
            action = msg.get("action")
            
            if action == "start":
                start_client_tracking(websocket, {
                    "patient_id": patient_id,
                    "doctor_id": msg.get("doctor_id"),
                    "hand": msg.get("hand", "left"),
                    "finger_rom_targets": msg.get("finger_rom_targets"),
                    "exercise_name": msg.get("exercise_name"),
                    "target_count": msg.get("target_count"),
                    "target_set": msg.get("target_set"),
                    "use_client_frames": msg.get("use_client_frames", False),
                })
                await websocket.send_json({"status": "tracking_started"})
                
            elif action == "frame":
                try:
                    frame = decode_client_frame(msg.get("image", ""))
                    enqueue_client_frame(websocket, frame)
                except Exception as e:
                    print(f"[Frame Decode Error] {e}")
                    
            elif action == "stop":
                stop_client_tracking(websocket)
                await websocket.send_json({"status": "tracking_stopped"})
                
    except WebSocketDisconnect:
        session_manager.disconnect(websocket)
    except Exception as e:
        print(f"[WS Exception] {e}")
        session_manager.disconnect(websocket)
    finally:
        send_task.cancel()

if __name__ == "__main__":
    uvicorn.run(
        "websocket_server:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=False,
    )