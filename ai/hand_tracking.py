import json
import os
import time
import urllib.request

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

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
GUIDE_FPS       = 30.0   # 가이드 애니메이션 속도
GUIDE_SCALE     = 900    # 정규화 좌표 → 픽셀 배율
MAX_DTW_DIST    = 0.3    # 이 DTW 거리에서 일치율 0%
DTW_INTERVAL    = 30     # N 프레임마다 DTW 계산
PATIENT_BUF_MAX = 30     # 환자 버퍼 최대 크기

GUIDE_PATH = os.path.join(os.path.dirname(__file__), "guide_data", "full_fist.json")

if os.path.exists(GUIDE_PATH):
    with open(GUIDE_PATH) as _f:
        guide_np = np.array(json.load(_f), dtype=np.float32)   # (N, 21, 3)
    print(f"guide data loaded: {len(guide_np)} frames")
else:
    guide_np = None
    print(f"[WARN] guide data not found: {GUIDE_PATH}")


# ── 유틸 ──────────────────────────────────────────────────────


def dist2(a, b):
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2


def normalize_landmarks(landmarks):
    """손목(0번) 기준 상대 좌표 ndarray (21, 3) 반환."""
    wrist = landmarks[0]
    return np.array(
        [[lm.x - wrist.x, lm.y - wrist.y, lm.z - wrist.z] for lm in landmarks],
        dtype=np.float32,
    )


# ── 손 상태 판별 ───────────────────────────────────────────────


def get_hand_state(landmarks):
    """(state, fingers) 반환.
    state   : 'open' / 'grip' / 'partial'
    fingers : [thumb, index, middle, ring, pinky]  True=extended
    """
    wrist = landmarks[0]
    pairs = [(4, 3), (8, 6), (12, 10), (16, 14), (20, 18)]
    fingers = [
        dist2(wrist, landmarks[tip_i]) > dist2(wrist, landmarks[pip_i])
        for tip_i, pip_i in pairs
    ]
    folded = sum(not f for f in fingers[1:])   # 검지~소지 4개 기준

    if folded >= 2:
        state = "grip"
    elif folded == 0:
        state = "open"
    else:
        state = "partial"
    return state, fingers


# ── DTW 유사도 ─────────────────────────────────────────────────


def compute_dtw_similarity(patient_buf):
    """환자 버퍼(최근 N프레임) vs guide_np 전체 시퀀스 DTW 비교.
    일치율(0~100) 반환. 데이터 부족 또는 guide 없으면 None.
    """
    if guide_np is None or len(patient_buf) < 2:
        return None

    seq1 = np.array(patient_buf, dtype=np.float32)  # (m, 21, 3)
    seq2 = guide_np                                   # (n, 21, 3)
    m, n = len(seq1), len(seq2)

    # 프레임 간 평균 유클리드 거리 행렬: (m, n)
    diff = seq1[:, np.newaxis] - seq2[np.newaxis]    # (m, n, 21, 3)
    frame_dist = np.sqrt((diff ** 2).sum(axis=3)).mean(axis=2)  # (m, n)

    # DTW DP
    dtw = np.full((m + 1, n + 1), np.inf)
    dtw[0, 0] = 0.0
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = frame_dist[i - 1, j - 1]
            dtw[i, j] = cost + min(dtw[i-1, j], dtw[i, j-1], dtw[i-1, j-1])

    dtw_dist = dtw[m, n] / (m + n)
    return max(0.0, 1.0 - dtw_dist / MAX_DTW_DIST) * 100


# ── 그리기 ────────────────────────────────────────────────────

def draw_animated_guide(frame, guide_frame_idx):
    if guide_np is None:
        return
    h, w = frame.shape[:2]
    cx, cy = w // 2, h // 2 + 225
    guide_frame = guide_np[guide_frame_idx]

    pts = [
        (int(cx + rel[0] * GUIDE_SCALE),
         int(cy + rel[1] * GUIDE_SCALE))
        for rel in guide_frame
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
    label = f"{flipped} {handedness.score:.2f}"
    cv2.putText(frame, label,
                (int(wrist.x * w), int(wrist.y * h) - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)

# ── 메인 루프 ─────────────────────────────────────────────────

options = vision.HandLandmarkerOptions(
    base_options=python.BaseOptions(model_asset_path=MODEL_PATH),
    running_mode=vision.RunningMode.VIDEO,
    num_hands=2,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
)

with vision.HandLandmarker.create_from_options(options) as landmarker:
    cap = cv2.VideoCapture(0)
    loop_start = time.time()

    count         = 0
    phase         = None
    state_buf     = []
    confirmed_state = None
    patient_buf   = []     # normalize_landmarks 결과 누적 [(21,3), ...]
    dtw_counter   = 0
    similarity    = None

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        # flip 후 MediaPipe에 전달 → Left/Right 화면과 일치
        frame = cv2.flip(frame, 1)
        timestamp_ms = int((time.time() - loop_start) * 1000)

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect_for_video(mp_image, timestamp_ms)

        # ── 1. 랜드마크 수집 ──────────────────────────────────
        raw_state      = None
        first_landmarks = None
        valid_hands    = []
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

        # ── 2. 환자 버퍼 업데이트 ────────────────────────────
        if first_landmarks is not None:
            patient_buf.append(normalize_landmarks(first_landmarks))
            if len(patient_buf) > PATIENT_BUF_MAX:
                patient_buf.pop(0)

        # ── 3. DTW (DTW_INTERVAL 프레임마다) ─────────────────
        dtw_counter += 1
        if dtw_counter >= DTW_INTERVAL:
            dtw_counter = 0
            similarity = compute_dtw_similarity(patient_buf)

        # ── 4. 가이드 프레임 인덱스 (시간 기반 루프) ──────────
        if guide_np is not None:
            elapsed = time.time() - loop_start
            guide_frame_idx = int(elapsed * GUIDE_FPS) % len(guide_np)
        else:
            guide_frame_idx = 0

        # ── 5. 렌더링: 가이드(아래) → 환자(위) ───────────────
        draw_animated_guide(frame, guide_frame_idx)
        for landmarks, handedness in valid_hands:
            draw_hand(frame, landmarks, handedness)

        # ── 상태 안정화 & 카운팅 ─────────────────────────────
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
                        count += 1          # OPEN → GRIP → OPEN 완료
                    phase = "open"
                elif confirmed_state == "grip" and phase == "open":
                    phase = "grip"

        # ── HUD ──────────────────────────────────────────────
        state_label = {"open": "OPEN", "grip": "GRIP"}.get(confirmed_state, "---")

        cv2.putText(frame, f"COUNT: {count}", (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 255, 255), 3)
        cv2.putText(frame, f"STATE: {state_label}", (20, 95),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)

        if similarity is not None:
            if similarity >= 80:
                sig_color = (0, 220, 0)
            elif similarity >= 50:
                sig_color = (0, 200, 255)
            else:
                sig_color = (0, 0, 220)
            match_text = f"{similarity:.0f}%"
            (tw, _), _ = cv2.getTextSize(match_text, cv2.FONT_HERSHEY_SIMPLEX, 2.0, 3)
            tx = (frame.shape[1] - tw) // 2
            cv2.putText(frame, match_text, (tx, 65),
                        cv2.FONT_HERSHEY_SIMPLEX, 2.0, sig_color, 3)
            cv2.circle(frame, (tx + tw + 22, 50), 14, sig_color, -1)

        cv2.imshow("Hand Tracking", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
