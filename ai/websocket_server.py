import asyncio
import os
import queue as stdlib_queue
import sys
import threading
from contextlib import asynccontextmanager
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, Query, WebSocket, WebSocketDisconnect
from jose import JWTError, jwt
import uvicorn

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"

sys.path.insert(0, os.path.dirname(__file__))
from hand_tracking import run_tracking

data_queue: stdlib_queue.Queue = stdlib_queue.Queue(maxsize=10)

_tracking_thread: Optional[threading.Thread] = None
_stop_event: Optional[threading.Event] = None
_tracking_lock = threading.Lock()


class ConnectionManager:
    def __init__(self):
        self._connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self._connections.append(ws)
        print(f"[WS] connected  (total={len(self._connections)})")

    def disconnect(self, ws: WebSocket):
        if ws in self._connections:
            self._connections.remove(ws)
        print(f"[WS] disconnected (total={len(self._connections)})")

    async def broadcast(self, data: dict):
        dead = []
        for ws in list(self._connections):
            try:
                await ws.send_json(data)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    @property
    def count(self):
        return len(self._connections)


manager = ConnectionManager()


def start_tracking(patient_id=None, doctor_id=None, hand="left", finger_rom_targets=None, exercise_name=None):
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
            },
            daemon=True,
            name="hand_tracking",
        )
        _tracking_thread.start()
        print("[Server] hand_tracking thread started")


def stop_tracking():
    global _tracking_thread, _stop_event
    with _tracking_lock:
        if _stop_event is not None:
            _stop_event.set()
        _tracking_thread = None
        _stop_event = None
        print("[Server] hand_tracking stop requested")


_frame_log_counter = 0

async def broadcast_loop():
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
async def lifespan(app: FastAPI):
    task = asyncio.create_task(broadcast_loop())
    yield
    task.cancel()
    stop_tracking()
    print("[Server] shutdown")


app = FastAPI(lifespan=lifespan)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("role") != "patient":
            await websocket.close(code=4001)
            return
        patient_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        await websocket.close(code=4001)
        return

    await manager.connect(websocket)
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
