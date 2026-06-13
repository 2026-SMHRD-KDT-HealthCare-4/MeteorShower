import json
import math
import os
import queue
import time
import urllib.request

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from landmark_utils import compute_guide_scale, normalize_to_guide_scale

MODEL_PATH = os.path.join(os.path.dirname(__file__), "hand_landmarker.task")
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)

if not os.path.exists(MODEL_PATH):
    print("hand_landmarker.task 모델 다운로드 중...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("다운로드 완료")

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]

STABLE_FRAMES   = 3
TARGET_ROM      = 0.8    # 과부하 ROM 임계값 (테스트 하드코딩)
CAPTURE_DIR     = os.path.join(os.path.dirname(__file__), "captures")
GUIDE_FPS       = 30.0
GUIDE_SCALE     = 900
MAX_DTW_DIST    = 0.162
WINDOW_STRETCH  = 2      # 환자버퍼 길이 대비 가이드 비교 구간의 최대 배수
WINDOW_STRIDE   = 10     # 비교 구간 시작 위치 탐색 간격(프레임)
DTW_INTERVAL    = 30
PATIENT_BUF_MAX = 30

# ── 운동 목록 ─────────────────────────────────────────────────
_BASE = os.path.dirname(__file__)
EXERCISES = [
    {
        "name":         "full_fist",
        "guide_path":   os.path.join(_BASE, "guide_data", "full_fist.json"),
        "target_count": 7,  # TODO: DB 처방값으로 교체 예정
        "target_set":   2,   # TODO: DB 처방값으로 교체 예정
    },
    {
        "name":         "tapping",
        "guide_path":   os.path.join(_BASE, "guide_data", "tapping.json"),
        "target_count": 7,  # TODO: DB 처방값으로 교체 예정
        "target_set":   2,   # TODO: DB 처방값으로 교체 예정
    },
]


# ── 가이드 로드 ────────────────────────────────────────────────

def _load_guide(guide_path: str):
    """Exercise guide JSON → ndarray (N, 21, 3). 파일 없으면 None."""
    if not os.path.exists(guide_path):
        print(f"[WARN] guide not found: {guide_path}")
        return None
    with open(guide_path) as f:
        arr = np.array(json.load(f), dtype=np.float32)
    print(f"guide loaded: {os.path.basename(guide_path)}  ({len(arr)} frames)")
    return arr


# ── 유틸 ──────────────────────────────────────────────────────

def dist2(a, b):
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2


# ── 손 상태 판별 ───────────────────────────────────────────────

def get_hand_state(landmarks):
    wrist = landmarks[0]
    pairs = [(4, 3), (8, 6), (12, 10), (16, 14), (20, 18)]
    fingers = [
        dist2(wrist, landmarks[tip_i]) > dist2(wrist, landmarks[pip_i])
        for tip_i, pip_i in pairs
    ]
    folded = sum(not f for f in fingers[1:])
    if folded >= 2:
        state = "grip"
    elif folded == 0:
        state = "open"
    else:
        state = "partial"
    return state, fingers


# ── ROM / 캡처 ────────────────────────────────────────────────

def compute_rom(landmarks):
    wrist = landmarks[0]
    tips = [landmarks[i] for i in [8, 12, 16, 20]]
    return float(np.mean([
        math.sqrt((t.x - wrist.x) ** 2 + (t.y - wrist.y) ** 2)
        for t in tips
    ]))


def save_capture(frame, label="overload"):
    os.makedirs(CAPTURE_DIR, exist_ok=True)
    ts = time.strftime("%Y%m%d_%H%M%S")
    path = os.path.join(CAPTURE_DIR, f"capture_{label}_{ts}.jpg")
    cv2.imwrite(path, frame)
    print(f"capture saved: {path}")


# ── DTW 유사도 ─────────────────────────────────────────────────

def _dtw_avg_dist(seq1, seq2):
    """seq1 (m,21,3) vs seq2 (n,21,3) DTW 누적거리 dtw[m,n] / (m+n)."""
    m, n = len(seq1), len(seq2)
    diff = seq1[:, np.newaxis] - seq2[np.newaxis]    # (m, n, 21, 3)
    frame_dist = np.sqrt((diff ** 2).sum(axis=3)).mean(axis=2)
    dtw = np.full((m + 1, n + 1), np.inf)
    dtw[0, 0] = 0.0
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = frame_dist[i - 1, j - 1]
            dtw[i, j] = cost + min(dtw[i-1, j], dtw[i, j-1], dtw[i-1, j-1])
    return dtw[m, n] / (m + n)


def compute_dtw_similarity(patient_buf, guide_np):
    """환자 버퍼 vs guide_np 비교. 일치율(0~100) or None.

    guide_np 전체(n프레임)와 직접 비교하면 환자의 짧은 버퍼(m프레임)가 가이드의
    아무 구간에나 elastic하게 끼워맞춰져 변별력이 떨어진다. 그래서 길이
    m*WINDOW_STRETCH 이하의 로컬 구간들로 가이드를 슬라이딩하며 가장 거리가
    작은 구간을 찾는다 (open-begin). 가이드 애니메이션 재생 위상과는 무관하게
    동작한다.
    """
    if guide_np is None or len(patient_buf) < 2:
        return None
    seq1 = np.array(patient_buf, dtype=np.float32)  # (m, 21, 3)
    m = len(seq1)
    n_total = len(guide_np)

    window_len = min(n_total, m * WINDOW_STRETCH)

    if window_len >= n_total:
        starts = [0]
    else:
        starts = list(range(0, n_total - window_len + 1, WINDOW_STRIDE))
        if starts[-1] != n_total - window_len:
            starts.append(n_total - window_len)

    best_avg = min(
        _dtw_avg_dist(seq1, guide_np[s:s + window_len])
        for s in starts
    )
    similarity = max(0.0, 1.0 - best_avg / MAX_DTW_DIST) * 100
    return similarity


# ── 그리기 ────────────────────────────────────────────────────

def draw_animated_guide(frame, guide_frame_idx, guide_np):
    if guide_np is None:
        return
    h, w = frame.shape[:2]
    cx, cy = w // 2, h // 2 + 225
    gf = guide_np[guide_frame_idx % len(guide_np)]
    pts = [
        (int(cx + rel[0] * GUIDE_SCALE), int(cy + rel[1] * GUIDE_SCALE))
        for rel in gf
    ]
    for s_idx, e_idx in HAND_CONNECTIONS:
        cv2.line(frame, pts[s_idx], pts[e_idx], (255, 0, 0), 3)


def draw_hand(frame, landmarks, handedness):
    h, w = frame.shape[:2]
    for s_idx, e_idx in HAND_CONNECTIONS:
        s, e = landmarks[s_idx], landmarks[e_idx]
        cv2.line(frame,
                 (int(s.x * w), int(s.y * h)),
                 (int(e.x * w), int(e.y * h)),
                 (0, 200, 0), 2)
    for lm in landmarks:
        cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 5, (0, 0, 255), -1)
    wrist = landmarks[0]
    flipped = "Right" if handedness.category_name == "Left" else "Left"
    cv2.putText(frame, f"{flipped} {handedness.score:.2f}",
                (int(wrist.x * w), int(wrist.y * h) - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)


# ── MediaPipe 옵션 ─────────────────────────────────────────────

_options = vision.HandLandmarkerOptions(
    base_options=python.BaseOptions(model_asset_path=MODEL_PATH),
    running_mode=vision.RunningMode.VIDEO,
    num_hands=2,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
)


# ── 메인 트래킹 함수 ───────────────────────────────────────────

def run_tracking(q: queue.Queue = None):
    with vision.HandLandmarker.create_from_options(_options) as landmarker:
        cap = cv2.VideoCapture(0)
        loop_start = time.time()

        # ── 운동 진행 상태 ────────────────────────────────────
        current_exercise_idx = 0
        current_set          = 1
        current_guide_np     = _load_guide(EXERCISES[0]["guide_path"])
        current_guide_scale  = compute_guide_scale(current_guide_np)

        # ── 공통 트래킹 상태 ─────────────────────────────────
        count           = 0
        phase           = None
        state_buf       = []
        confirmed_state = None
        patient_buf     = []
        dtw_counter     = 0
        similarity      = None
        similarity_buf  = []

        # ── 과부하 상태 ──────────────────────────────────────
        overload_stage        = 0
        overload_count_marker = -1
        session_end_at        = None

        # ── 세션 완료 상태 ────────────────────────────────────
        session_complete    = False
        session_complete_at = None

        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            ex = EXERCISES[current_exercise_idx]

            # flip 후 MediaPipe에 전달 → Left/Right 화면과 일치
            frame = cv2.flip(frame, 1)
            timestamp_ms = int((time.time() - loop_start) * 1000)

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect_for_video(mp_image, timestamp_ms)

            # ── 1. 랜드마크 수집 ──────────────────────────────
            raw_state       = None
            first_landmarks = None
            valid_hands     = []
            if result.hand_landmarks and result.handedness:
                for landmarks, handedness_list in zip(
                    result.hand_landmarks, result.handedness
                ):
                    handedness = handedness_list[0]
                    if handedness.score < 0.5:
                        continue
                    valid_hands.append((landmarks, handedness))
                    if raw_state is None:
                        raw_state, _ = get_hand_state(landmarks)
                        first_landmarks = landmarks

            # ── 2. 환자 버퍼 업데이트 ────────────────────────
            if first_landmarks is not None:
                patient_buf.append(
                    normalize_to_guide_scale(first_landmarks, current_guide_scale)
                )
                if len(patient_buf) > PATIENT_BUF_MAX:
                    patient_buf.pop(0)

            # ── 3. DTW ───────────────────────────────────────
            dtw_counter += 1
            if dtw_counter >= DTW_INTERVAL:
                dtw_counter = 0
                raw_similarity = compute_dtw_similarity(patient_buf, current_guide_np)
                if raw_similarity is not None:
                    similarity_buf.append(raw_similarity)
                    if len(similarity_buf) > 3:
                        similarity_buf.pop(0)
                    similarity = sum(similarity_buf) / len(similarity_buf)

            # ── 4. 가이드 프레임 인덱스 ──────────────────────
            elapsed = time.time() - loop_start
            guide_n = len(current_guide_np) if current_guide_np is not None else 1
            guide_frame_idx = int(elapsed * GUIDE_FPS) % guide_n

            # ── 5. 렌더링 ────────────────────────────────────
            draw_animated_guide(frame, guide_frame_idx, current_guide_np)
            for landmarks, handedness in valid_hands:
                draw_hand(frame, landmarks, handedness)

            # ── 상태 안정화 & 카운팅 ─────────────────────────
            if raw_state in ("open", "grip"):
                state_buf.append(raw_state)
            if len(state_buf) > STABLE_FRAMES:
                state_buf.pop(0)

            if (len(state_buf) == STABLE_FRAMES
                    and all(s == state_buf[0] for s in state_buf)):
                new_state = state_buf[0]
                if new_state != confirmed_state:
                    confirmed_state = new_state
                    if confirmed_state == "open":
                        if phase == "grip":
                            count += 1      # OPEN → GRIP → OPEN 완료

                            # ── 과부하(카운트 초과) 체크: 리셋 전 ─────
                            if overload_stage == 0 and count > ex["target_count"]:
                                save_capture(frame)
                                overload_stage        = 1
                                overload_count_marker = count

                            # ── 세트 완료 체크 ─────────────────────────
                            elif count >= ex["target_count"] and overload_stage == 0:
                                current_set += 1
                                count = 0
                                phase = None
                                state_buf.clear()
                                confirmed_state = None
                                patient_buf.clear()
                                similarity = None
                                similarity_buf.clear()

                                # ── 운동 완료 체크 ──────────────────────
                                if current_set > ex["target_set"]:
                                    current_exercise_idx += 1
                                    current_set = 1

                                    if current_exercise_idx >= len(EXERCISES):
                                        session_complete    = True
                                        session_complete_at = time.time()
                                    else:
                                        current_guide_np = _load_guide(
                                            EXERCISES[current_exercise_idx]["guide_path"]
                                        )
                                        current_guide_scale = compute_guide_scale(current_guide_np)

                        phase = "open"
                    elif confirmed_state == "grip" and phase == "open":
                        phase = "grip"

            # ── 과부하 감지 (ROM 기반) ────────────────────────
            current_rom = compute_rom(first_landmarks) if first_landmarks else 0.0

            if overload_stage == 0 and current_rom > TARGET_ROM:
                save_capture(frame)
                overload_stage        = 1
                overload_count_marker = count

            elif overload_stage == 1 and count > overload_count_marker:
                save_capture(frame)
                overload_stage = 2

            if overload_stage == 2:
                if session_end_at is None:
                    session_end_at = time.time()
                elif time.time() - session_end_at > 3.0:
                    break

            # ── 큐 전송 ───────────────────────────────────────
            if q is not None and not session_complete:
                ex_now     = EXERCISES[current_exercise_idx] \
                             if current_exercise_idx < len(EXERCISES) else ex
                state_lbl  = {"open": "OPEN", "grip": "GRIP"}.get(confirmed_state, "")
                signal     = (
                    "green"  if (similarity or 0) >= 80 else
                    "yellow" if (similarity or 0) >= 50 else "red"
                ) if similarity is not None else "gray"
                payload = {
                    "landmarks":   [[lm.x, lm.y, lm.z] for lm in first_landmarks]
                                   if first_landmarks is not None else [],
                    "count":       count,
                    "state":       state_lbl,
                    "similarity":  round(similarity, 1) if similarity is not None else None,
                    "signal":      signal,
                    "overload":    overload_stage >= 1,
                    "session_end": overload_stage == 2 or session_complete,
                    "exercise":    ex_now["name"],
                    "set":         current_set,
                    "total_sets":  ex_now["target_set"],
                }
                try:
                    q.put_nowait(payload)
                except queue.Full:
                    pass

            # ── HUD ──────────────────────────────────────────
            state_lbl     = {"open": "OPEN", "grip": "GRIP"}.get(confirmed_state, "---")
            ex_now        = EXERCISES[current_exercise_idx] \
                            if current_exercise_idx < len(EXERCISES) else ex
            progress_text = (
                f"{ex_now['name']}  "
                f"{current_set}set/{ex_now['target_set']}set  "
                f"{count}rep/{ex_now['target_count']}rep"
            )

            cv2.putText(frame, f"COUNT: {count}", (20, 50),
                        cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 255, 255), 3)
            cv2.putText(frame, f"STATE: {state_lbl}", (20, 95),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.putText(frame, progress_text, (20, 130),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 255, 180), 2)

            if similarity is not None:
                sc = (0, 220, 0) if similarity >= 80 else (
                     (0, 200, 255) if similarity >= 50 else (0, 0, 220))
                mt = f"{similarity:.0f}%"
                (tw, _), _ = cv2.getTextSize(mt, cv2.FONT_HERSHEY_SIMPLEX, 2.0, 3)
                tx = (frame.shape[1] - tw) // 2
                cv2.putText(frame, mt, (tx, 65),
                            cv2.FONT_HERSHEY_SIMPLEX, 2.0, sc, 3)
                cv2.circle(frame, (tx + tw + 22, 50), 14, sc, -1)

            # 과부하 경고
            if overload_stage == 1:
                cv2.putText(frame, "! OVERLOAD: COUNT ADJUSTED",
                            (20, frame.shape[0] - 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            elif overload_stage == 2:
                ov = frame.copy()
                cv2.rectangle(ov, (0, 0), (frame.shape[1], frame.shape[0]), (0, 0, 180), -1)
                cv2.addWeighted(ov, 0.4, frame, 0.6, 0, frame)
                cv2.putText(frame, "! SESSION END",
                            (frame.shape[1] // 2 - 170, frame.shape[0] // 2),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 0, 255), 4)

            # 세션 완료
            if session_complete:
                ov = frame.copy()
                cv2.rectangle(ov, (0, 0), (frame.shape[1], frame.shape[0]), (0, 100, 0), -1)
                cv2.addWeighted(ov, 0.35, frame, 0.65, 0, frame)
                cv2.putText(frame, "SESSION COMPLETE!",
                            (frame.shape[1] // 2 - 220, frame.shape[0] // 2),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 255, 100), 4)
                if session_complete_at and time.time() - session_complete_at > 3.0:
                    cv2.imshow("Hand Tracking", frame)
                    cv2.waitKey(1)
                    break

            cv2.imshow("Hand Tracking", frame)
            if cv2.waitKey(1) & 0xFF == ord("q"):
                break

        cap.release()
        cv2.destroyAllWindows()

        if session_complete:
            print("All exercises completed. Session complete.")


if __name__ == "__main__":
    run_tracking()
