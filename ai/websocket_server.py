"""MediaPipe 손 트래킹 데이터를 WebSocket으로 실시간 스트리밍하는 FastAPI 서버(AI 서버 포트 8000)."""
import asyncio
import base64
import os
import queue as stdlib_queue
import sys
import threading
from contextlib import asynccontextmanager
from typing import AsyncIterator, List, Optional

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

data_queue: stdlib_queue.Queue = stdlib_queue.Queue(maxsize=10)

_tracking_thread: Optional[threading.Thread] = None
_stop_event: Optional[threading.Event] = None
_frame_input_queue: Optional[stdlib_queue.Queue] = None
_tracking_lock = threading.Lock()
_session_complete_event = threading.Event()  # 세션 완료(session_end) 여부 — 연속 운동 판단용


class ConnectionManager:
    def __init__(self) -> None:
        """활성 WebSocket 연결 목록을 빈 상태로 초기화한다."""
        self._connections: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        """WebSocket 연결을 수락하고 활성 목록에 등록한다."""
        await ws.accept()
        self._connections.append(ws)
        print(f"[WS] connected  (total={len(self._connections)})")

    def disconnect(self, ws: WebSocket) -> None:
        """활성 목록에서 해당 WebSocket을 제거한다(이미 없으면 무시)."""
        if ws in self._connections:
            self._connections.remove(ws)
        print(f"[WS] disconnected (total={len(self._connections)})")

    async def broadcast(self, data: dict) -> None:
        """모든 활성 연결에 data를 JSON으로 전송한다. 전송 실패한 연결은 자동으로 제거한다."""
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
        """현재 활성 WebSocket 연결 수를 반환한다."""
        return len(self._connections)


manager = ConnectionManager()


def start_tracking(patient_id=None, doctor_id=None, hand="left", finger_rom_targets=None, exercise_name=None, target_count=None, target_set=None, use_client_frames=False) -> None:
    """run_tracking을 백그라운드 스레드로 시작한다.

    이미 실행 중인 스레드가 있을 때:
    - 세션 완료(_session_complete_event) 상태면 이전 스레드에 stop 신호만 보내고 새 스레드를 시작.
    - 운동 진행 중이면 중복 실행하지 않는다.
    """
    global _tracking_thread, _stop_event, _frame_input_queue, _session_complete_event
    with _tracking_lock:
        if _tracking_thread is not None and _tracking_thread.is_alive():
            if not _session_complete_event.is_set():
                # 운동 진행 중 — 중복 시작 방지
                return
            # 이전 세션 완료 상태 — stop 신호 후 새 스레드 시작
            if _stop_event is not None:
                _stop_event.set()
            _tracking_thread = None
            _stop_event = None
            _frame_input_queue = None
            print("[Server] previous session complete, restarting tracking for next exercise")
        _session_complete_event.clear()
        _stop_event = threading.Event()
        _frame_input_queue = stdlib_queue.Queue(maxsize=3) if use_client_frames else None
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
                "frame_queue": _frame_input_queue,
                "session_complete_event": _session_complete_event,
            },
            daemon=True,
            name="hand_tracking",
        )
        _tracking_thread.start()
        print("[Server] hand_tracking thread started")


def stop_tracking() -> None:
    """실행 중인 트래킹 스레드에 stop 신호를 보내고 내부 참조를 정리한다."""
    global _tracking_thread, _stop_event, _frame_input_queue, _session_complete_event
    with _tracking_lock:
        if _stop_event is not None:
            _stop_event.set()
        _tracking_thread = None
        _stop_event = None
        _frame_input_queue = None
        _session_complete_event.clear()
        print("[Server] hand_tracking stop requested")


_frame_log_counter = 0


def decode_client_frame(image_data: str):
    """브라우저가 보낸 data URL/base64 JPEG를 OpenCV BGR 프레임으로 변환한다."""
    if not image_data:
        return None
    if "," in image_data:
        image_data = image_data.split(",", 1)[1]
    frame_bytes = base64.b64decode(image_data)
    np_arr = np.frombuffer(frame_bytes, dtype=np.uint8)
    return cv2.imdecode(np_arr, cv2.IMREAD_COLOR)


def enqueue_client_frame(frame) -> None:
    """분석 스레드가 최신 프레임을 우선 쓰도록 오래된 프레임을 버리고 넣는다."""
    if _frame_input_queue is None or frame is None:
        return
    try:
        _frame_input_queue.put_nowait(frame)
    except stdlib_queue.Full:
        try:
            _frame_input_queue.get_nowait()
        except stdlib_queue.Empty:
            pass
        try:
            _frame_input_queue.put_nowait(frame)
        except stdlib_queue.Full:
            pass


async def broadcast_loop() -> None:
    """data_queue에 쌓인 트래킹 결과를 꺼내 모든 활성 WebSocket에 지속적으로 브로드캐스트한다."""
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
    """FastAPI 앱 시작 시 broadcast_loop 태스크를 실행하고, 종료 시 트래킹을 멈춘다."""
    task = asyncio.create_task(broadcast_loop())
    yield
    task.cancel()
    stop_tracking()
    print("[Server] shutdown")


app = FastAPI(lifespan=lifespan)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket, token: str = Query(...)) -> None:
    """JWT 토큰으로 환자 인증 후, start/stop 메시지를 받아 트래킹을 제어하는 WebSocket 핸들러."""
    await websocket.accept()

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
                    use_client_frames=msg.get("use_client_frames", False),
                )
                await websocket.send_json({"status": "tracking_started"})
            elif action == "frame":
                try:
                    enqueue_client_frame(decode_client_frame(msg.get("image", "")))
                except Exception as e:
                    print(f"[Frame Decode Error] {e}")
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
