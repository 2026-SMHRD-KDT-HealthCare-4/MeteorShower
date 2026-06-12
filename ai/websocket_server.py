import asyncio
import os
import queue as stdlib_queue
import sys
import threading
from contextlib import asynccontextmanager
from typing import List

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import uvicorn

# hand_tracking.py 가 같은 ai/ 폴더에 있으므로 경로 추가
sys.path.insert(0, os.path.dirname(__file__))
from hand_tracking import run_tracking

# ── 공유 큐 (hand_tracking → WebSocket 브로드캐스트) ──────────
# maxsize=10: 처리 지연 시 오래된 프레임 드롭
data_queue: stdlib_queue.Queue = stdlib_queue.Queue(maxsize=10)


# ── WebSocket 연결 관리 ────────────────────────────────────────

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


manager = ConnectionManager()


# ── 브로드캐스트 루프 ─────────────────────────────────────────
# 큐에서 데이터를 꺼내 연결된 모든 클라이언트에게 전송.
# hand_tracking 스레드가 put_nowait 하면 여기서 소비.

async def broadcast_loop():
    while True:
        try:
            data = data_queue.get_nowait()
            if manager._connections:
                await manager.broadcast(data)
        except stdlib_queue.Empty:
            await asyncio.sleep(0.016)   # ~60 fps 폴링
        except Exception:
            await asyncio.sleep(0.016)


# ── Lifespan: 트래킹 스레드 + 브로드캐스트 태스크 ────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # hand_tracking을 데몬 스레드로 실행
    tracking_thread = threading.Thread(
        target=run_tracking,
        args=(data_queue,),
        daemon=True,
        name="hand_tracking",
    )
    tracking_thread.start()
    print("[Server] hand_tracking thread started")

    task = asyncio.create_task(broadcast_loop())
    yield

    task.cancel()
    print("[Server] shutdown")


# ── FastAPI 앱 ────────────────────────────────────────────────

app = FastAPI(lifespan=lifespan)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """ws://localhost:8000/ws

    송신: JSON 프레임 (hand_tracking 결과)
    수신: 클라이언트 메시지 무시 (연결 종료 감지 용도)

    JSON 형식:
    {
        "landmarks":   [[x,y,z], ...],   // 21개, 손 미검출 시 []
        "count":       5,
        "state":       "OPEN",           // "OPEN" / "GRIP" / ""
        "similarity":  78.3,             // null 가능
        "signal":      "green",          // green / yellow / red / gray
        "overload":    false,
        "session_end": false
    }
    """
    await manager.connect(websocket)
    try:
        while True:
            # 클라이언트 메시지 대기 → WebSocketDisconnect 감지
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)


# ── 진입점 ───────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "websocket_server:app",
        host="0.0.0.0",
        port=8000,
        log_level="info",
        reload=False,
    )
