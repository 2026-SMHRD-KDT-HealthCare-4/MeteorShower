import os
import time
import urllib.request

import cv2
import mediapipe as mp
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

STABLE_FRAMES = 3   # 상태 확정에 필요한 연속 동일 프레임 수


def dist2(a, b):
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2


def get_hand_state(landmarks):
    """(state, fingers) 반환.
    state   : 'open' / 'fist' / 'partial'
    fingers : [thumb, index, middle, ring, pinky]  True=extended
    """
    wrist = landmarks[0]

    # 손목 기준 거리 비교: dist(wrist, tip) > dist(wrist, pip) → 펴짐
    # tip/pip 쌍: 엄지(4,3), 검지(8,6), 중지(12,10), 약지(16,14), 소지(20,18)
    pairs = [(4, 3), (8, 6), (12, 10), (16, 14), (20, 18)]
    fingers = [
        dist2(wrist, landmarks[tip_i]) > dist2(wrist, landmarks[pip_i])
        for tip_i, pip_i in pairs
    ]

    ext = sum(fingers)
    if ext == 5:
        state = "open"
    elif ext == 0:
        state = "fist"
    else:
        state = "partial"

    return state, fingers


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
    label = f"{handedness.category_name} {handedness.score:.2f}"
    cv2.putText(frame, label,
                (int(wrist.x * w), int(wrist.y * h) - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)


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
    start_time = time.time()

    count = 0
    # 사이클: None → "open" → "fist" → "open" = +1
    phase = None
    state_buf = []          # partial 제외 안정화 버퍼
    confirmed_state = None  # 마지막 확정 상태

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        frame = cv2.flip(frame, 1)
        timestamp_ms = int((time.time() - start_time) * 1000)

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect_for_video(mp_image, timestamp_ms)

        raw_state = None
        debug_fingers = [False] * 5
        if result.hand_landmarks and result.handedness:
            for landmarks, handedness_list in zip(
                result.hand_landmarks, result.handedness
            ):
                handedness = handedness_list[0]
                if handedness.score < 0.5:
                    continue
                draw_hand(frame, landmarks, handedness)
                if raw_state is None:       # 첫 번째 유효 손으로만 카운팅
                    raw_state, debug_fingers = get_hand_state(landmarks)

        # ── 상태 안정화 ──────────────────────────────────────
        if raw_state in ("open", "fist"):
            state_buf.append(raw_state)
        if len(state_buf) > STABLE_FRAMES:
            state_buf.pop(0)

        candidate_state = state_buf[-1] if state_buf else "none"

        if (len(state_buf) == STABLE_FRAMES
                and all(s == state_buf[0] for s in state_buf)):
            new_state = state_buf[0]
            if new_state != confirmed_state:
                confirmed_state = new_state

                # ── 카운팅 상태 머신 ─────────────────────────
                if confirmed_state == "open":
                    if phase == "fist":
                        count += 1      # 펼침→주먹→펼침 완료
                    phase = "open"
                elif confirmed_state == "fist" and phase == "open":
                    phase = "fist"

        # ── HUD ──────────────────────────────────────────────
        state_label = {"open": "OPEN", "fist": "GRIP"}.get(confirmed_state, "---")
        finger_str = " ".join(
            f"{'TIMRP'[i]}:{'O' if v else 'X'}"
            for i, v in enumerate(debug_fingers)
        )

        cv2.putText(frame, f"COUNT: {count}", (20, 50),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 255, 255), 3)
        cv2.putText(frame, f"STATE:     {state_label}", (20, 95),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(frame, f"CANDIDATE: {candidate_state}", (20, 120),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 0), 2)
        cv2.putText(frame, f"PHASE:     {phase}", (20, 145),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 0), 2)
        cv2.putText(frame, f"FINGERS:   {finger_str}", (20, 170),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (150, 255, 150), 2)

        cv2.imshow("Hand Tracking", frame)
        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()
