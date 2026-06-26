import asyncio
import os
import queue as stdlib_queue
import sys
import threading
from contextlib import asynccontextmanager
from typing import AsyncIterator, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
import uvicorn

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'), override=True)

SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
print(f"[Server] SECRET_KEY 앞 10자리: {SECRET_KEY[:10]}")

sys.path.insert(0, os.path.dirname(__file__))
from hand_tracking import run_tracking

data_queue: stdlib_queue.Queue = stdlib_queue.Queue(maxsize=10)

_tracking_thread: Optional[threading.Thread] = None
_stop_event: Optional[threading.Event] = None
_tracking_lock = threading.Lock()


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self._connections.append(ws)
        print(f"[WS] connected  (total={len(self._connections)})")

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self._connections:
            self._connections.remove(ws)
        print(f"[WS] disconnected (total={len(self._connections)})")

    async def broadcast(self, data: dict) -> None:
        dead = []
        for ws in list(self._connections):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def count(self) -> int:
        return len(self._connections)


manager = ConnectionManager()


def start_tracking(patient_id=None, doctor_id=None, hand="left", finger_rom_targets=None, exercise_name=None, target_count=None, target_set=None) -> None:
    global _tracking_thread, _stop_event
    with _tracking_lock:
        if _tracking_thread is not None and _tracking_thread.is_alive():
            return
        _stop_event = threading.Event()
        _tracking_thread = threading.Thread(
            target=run_tracking,
            kwargs={
                "q": data_queue,
                "finger_rom_targets": finger_rom_targets,
                "patient_id": patient_id,
                "doctor_id": doctor_id,
                "hand": hand,
                "stop_event": _stop_event,
                "show_window": False,
                "exercise_name": exercise_name,
                "target_count": target_count,
                "target_set": target_set,
            },
            daemon=True,
            name="hand_tracking",
        )
        _tracking_thread.start()
        print("[Server] hand_tracking thread started")


def stop_tracking() -> None:
    global _tracking_thread, _stop_event
    with _tracking_lock:
        if _stop_event is not None:
            _stop_event.set()
        _tracking_thread = None
        _stop_event = None
        print("[Server] hand_tracking stop requested")


_frame_log_counter = 0

async def broadcast_loop() -> None:
    global _frame_log_counter
    while True:
        try:
            data = data_queue.get_nowait()
            if manager.count > 0:
                await manager.broadcast(data)
                _frame_log_counter += 1
                if _frame_log_counter % 30 == 1:  # 30프레임마다 한 번 출력
                    has_frame = "frame" in data and bool(data["frame"])
                    print(f"[Broadcast] frame #{_frame_log_counter}  has_frame={has_frame}  clients={manager.count}")
        except stdlib_queue.Empty:
            await asyncio.sleep(0.016)
        except Exception as e:
            print(f"[Broadcast Error] {e}")
            await asyncio.sleep(0.016)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(broadcast_loop())
    yield
    task.cancel()
    stop_tracking()
    print("[Server] shutdown")


app = FastAPI(lifespan=lifespan)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)) -> None:
    await websocket.accept()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "patient":
            print(f"[WS Auth] role 불일치: {payload.get('role')}")
            await websocket.close(code=4001, reason="unauthorized")
            return
        patient_id = int(payload["sub"])
        print(f"[WS Auth] 인증 성공 patient_id={patient_id}")
    except Exception as e:
        try:
            unverified = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_signature": False, "verify_exp": False})
            print(f"[WS Auth] 서명 없이 디코드 성공: {unverified}")
            import hmac, hashlib, base64
            header_payload = '.'.join(token.split('.')[:2]).encode()
            expected_sig = base64.urlsafe_b64encode(
                hmac.new(SECRET_KEY.encode(), header_payload, hashlib.sha256).digest()
            ).rstrip(b'=')
            actual_sig = token.split('.')[2].encode()
            print(f"[WS Auth] 예상 서명 앞10: {expected_sig[:10]}")
            print(f"[WS Auth] 실제 서명 앞10: {actual_sig[:10]}")
            print(f"[WS Auth] 서명 일치: {expected_sig == actual_sig}")
        except Exception as e2:
            print(f"[WS Auth] 디버그 실패: {e2}")
        print(f"[WS Auth] 인증 실패: {type(e).__name__}: {e}  token_len={len(token)}")
        await websocket.close(code=4001, reason="invalid token")
        return

    manager._connections.append(websocket)
    print(f"[WS] connected  (total={len(manager._connections)})")
    try:
        while True:
            msg = await websocket.receive_json()
            action = msg.get("action")
            if action == "start":
                start_tracking(
                    patient_id=patient_id,
                    doctor_id=msg.get("doctor_id"),
                    hand=msg.get("hand", "left"),
                    finger_rom_targets=msg.get("finger_rom_targets"),
                    exercise_name=msg.get("exercise_name"),
                    target_count=msg.get("target_count"),
                    target_set=msg.get("target_set"),
                )
                await websocket.send_json({"status": "tracking_started"})
            elif action == "stop":
                stop_tracking()
                await websocket.send_json({"status": "tracking_stopped"})
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        if manager.count == 0:
            stop_tracking()
    except Exception:
        manager.disconnect(websocket)
        if manager.count == 0:
            stop_tracking()


if __name__ == "__main__":
    uvicorn.run(
        "websocket_server:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=False,
    )
