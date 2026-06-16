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

from landmark_utils import (
    compute_guide_scale, normalize_to_guide_scale,
    extract_features_full_fist, extract_features_tapping,
)

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
TAP_THRESHOLDS  = {8: 0.06, 12: 0.07, 16: 0.09, 20: 0.09}   # 손가락별 임계값
TARGET_ROM      = 0.8    # 과부하 ROM 임계값 (테스트 하드코딩)
CAPTURE_DIR     = os.path.join(os.path.dirname(__file__), "captures")
GUIDE_FPS       = 30.0
GUIDE_SCALE     = 900
MAX_DTW_DIST    = 0.162
WINDOW_STRETCH  = 2      # 환자버퍼 길이 대비 가이드 비교 구간의 최대 배수
WINDOW_STRIDE   = 3      # (수정) 10 -> 3: 점수 요동 및 초반 점수 폭락의 핵심 원인 해결! 탐색을 촘촘하게 합니다.
DTW_INTERVAL    = 3      # (수정) 연산 주기 조절
PATIENT_BUF_MAX = 30

# ── 변별력 & 흔들림 제어 상수 ────────────────────────────
SIMILARITY_SMOOTHING = 12    # (수정) 8 -> 12: 점수 흔들림을 아주 부드럽게 잡아주는 버퍼 크기
PENALTY_POWER        = 1.2   # (수정) 1.8 -> 1.2: 동작 초반 점수 폭락을 막고, 덜 쥐었을 때만 패널티를 줍니다.

# ── 신호등 색 (BGR) & 손가락 그룹 ────────────────────────
SIGNAL_BGR = {
    "green":  (0,   220, 0),
    "yellow": (0,   200, 255),
    "red":    (0,   0,   220),
}

FINGER_LANDMARK_GROUPS = {
    4:  [1, 2, 3, 4],
    8:  [5, 6, 7, 8],
    12: [9, 10, 11, 12],
    16: [13, 14, 15, 16],
    20: [17, 18, 19, 20],
}

def _compute_guide_finger_targets(guide_raw_np, feature_fn, percentile=10):
    """가이드에서 각 손가락이 가장 많이 구부러진 목표치(하위 10%) 추출"""
    if guide_raw_np is None or len(guide_raw_np) == 0: return None
    features = np.array([feature_fn(frame) for frame in guide_raw_np], dtype=np.float32)
    return np.percentile(features, percentile, axis=0)

def _finger_signals_from_distance(cur_features, guide_targets):
    """오차 마진 기반 손가락 개별 색상 판별"""
    signals = []
    BASE_MARGIN = 0.08 
    for cur, tgt in zip(cur_features, guide_targets):
        cur, tgt = float(cur), float(tgt)
        if cur <= tgt + BASE_MARGIN:
            signals.append("green")
        # 노란색 허용 구간을 2.5배에서 1.5배로 대폭 축소 (어설프면 바로 빨간색)
        elif cur <= tgt + (BASE_MARGIN * 1.5):
            signals.append("yellow")
        else:
            signals.append("red")
    return signals

def _build_joint_signals_from_fingers(finger_sigs):
    """손가락끝 신호를 전체 21개 랜드마크로 확장"""
    tip_order = [4, 8, 12, 16, 20] if len(finger_sigs) == 5 else [8, 12, 16, 20]
    signals = {i: "green" for i in range(21)}
    for sig, tip in zip(finger_sigs, tip_order):
        for lm_idx in FINGER_LANDMARK_GROUPS[tip]:
            signals[lm_idx] = sig
    return signals

# ── 운동 목록 ─────────────────────────────────────────────────
_BASE = os.path.dirname(__file__)
EXERCISES = [
    {
        "name":         "full_fist",
        "guide_path":   os.path.join(_BASE, "guide_data", "full_fist.json"),
        "target_count": 7,   # TODO: DB 처방값으로 교체 예정
        "target_set":   2,   # TODO: DB 처방값으로 교체 예정
        "count_type":   "grip",
        "max_dtw_dist": 0.35,
        "feature_fn":   extract_features_full_fist,
    },
    {
        "name":         "tapping",
        "guide_path":   os.path.join(_BASE, "guide_data", "tapping.json"),
        "target_count": 7,   # TODO: DB 처방값으로 교체 예정
        "target_set":   2,   # TODO: DB 처방값으로 교체 예정
        "count_type":   "tap",
        "max_dtw_dist": 0.32,
        "feature_fn":   extract_features_tapping,
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


def _load_guide_features(guide_path, feature_fn):
    """가이드 json → 특징 벡터 시퀀스 (N, D).

    draw_animated_guide 등 애니메이션용 원본 (N,21,3)은 _load_guide로 별도 로드한다.
    """
    arr = _load_guide(guide_path)
    if arr is None:
        return None
    return np.array([feature_fn(frame) for frame in arr], dtype=np.float32)


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


def get_guide_tap_finger(guide_frame):
    """가이드 프레임(wrist-normalized)에서 손가락별 임계값 이하인 손가락 중
    엄지(4)와 가장 가까운 손가락 끝 인덱스. 없으면 None."""
    thumb      = guide_frame[4]
    min_dist   = float("inf")
    tap_finger = None
    for tip_i in [8, 12, 16, 20]:
        tip  = guide_frame[tip_i]
        dist = math.sqrt(float(
            (thumb[0] - tip[0]) ** 2 +
            (thumb[1] - tip[1]) ** 2 +
            (thumb[2] - tip[2]) ** 2
        ))
        if dist < TAP_THRESHOLDS[tip_i] and dist < min_dist:
            min_dist   = dist
            tap_finger = tip_i
    return tap_finger


def get_tap_state(landmarks, guide_tap_finger):
    """가이드가 지정한 손가락이 해당 손가락의 임계값 이하면 TAP."""
    if guide_tap_finger is None:
        return "open"
    thumb = landmarks[4]
    tip   = landmarks[guide_tap_finger]
    dist  = math.sqrt(
        (thumb.x - tip.x) ** 2 +
        (thumb.y - tip.y) ** 2 +
        (thumb.z - tip.z) ** 2
    )
    return "tap" if dist < TAP_THRESHOLDS[guide_tap_finger] else "open"


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

def compute_dtw_similarity(patient_buf, guide_np, max_dtw_dist=MAX_DTW_DIST):
    """Subsequence DTW를 사용하여 가이드의 특정 정지 구간과 완벽히 매칭되도록 개선"""
    if guide_np is None or len(patient_buf) < 2:
        return None
    seq1 = np.array(patient_buf, dtype=np.float32) 
    m = len(seq1)
    n = len(guide_np)

    diff = seq1[:, np.newaxis] - guide_np[np.newaxis] 
    point_dist = np.sqrt((diff ** 2).sum(axis=-1))
    if point_dist.ndim > 2:
        frame_dist = point_dist.reshape(m, n, -1).mean(axis=-1)
    else:
        frame_dist = point_dist

    # 가이드(n)의 어느 시점에서든 매칭을 시작(0.0)할 수 있도록 허용
    dtw = np.full((m + 1, n + 1), np.inf)
    dtw[0, :] = 0.0  
    
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = frame_dist[i - 1, j - 1]
            dtw[i, j] = cost + min(dtw[i-1, j], dtw[i, j-1], dtw[i-1, j-1])
    
    # 마지막 프레임이 매칭된 지점 중 가장 오차가 적은 곳 선택
    best_avg = np.min(dtw[m, 1:]) / m
    
    raw_ratio = max(0.0, 1.0 - best_avg / max_dtw_dist)
    similarity = (raw_ratio ** PENALTY_POWER) * 100
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


def draw_hand(frame, landmarks, handedness, joint_signals=None):
    h, w = frame.shape[:2]
    
    _DEFAULT_SEG = (0, 200, 0)
    _DEFAULT_LM  = (0, 0, 255)

    def lm_color(idx):
        if joint_signals is None: return _DEFAULT_LM
        return SIGNAL_BGR.get(joint_signals.get(idx, "green"), _DEFAULT_LM)

    def seg_color(s_idx, e_idx):
        if joint_signals is None: return _DEFAULT_SEG
        ss = joint_signals.get(s_idx, "green")
        es = joint_signals.get(e_idx, "green")
        priority = ["red", "yellow", "green"]
        si = priority.index(ss) if ss in priority else 2
        ei = priority.index(es) if es in priority else 2
        worse = ss if si < ei else es
        return SIGNAL_BGR.get(worse, _DEFAULT_SEG)

    for s_idx, e_idx in HAND_CONNECTIONS:
        s, e = landmarks[s_idx], landmarks[e_idx]
        cv2.line(frame,
                 (int(s.x * w), int(s.y * h)),
                 (int(e.x * w), int(e.y * h)),
                 seg_color(s_idx, e_idx), 2)
    for i, lm in enumerate(landmarks):
        cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 5, lm_color(i), -1)
    
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
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        loop_start          = time.time()
        guide_elapsed_start = loop_start   # 운동 전환 시 리셋됨

        # ── 운동 진행 상태 ────────────────────────────────────
        current_exercise_idx = 0
        current_set          = 1
        ex0                  = EXERCISES[current_exercise_idx]
        current_guide_raw    = _load_guide(ex0["guide_path"])           # 애니메이션용 (N,21,3)
        current_guide_np     = _load_guide_features(                     # DTW용 (N,D)
            ex0["guide_path"], ex0["feature_fn"]
        )
        current_guide_scale  = compute_guide_scale(current_guide_raw)
        current_feature_fn   = ex0["feature_fn"]
        current_guide_targets = _compute_guide_finger_targets(current_guide_raw, current_feature_fn)
        joint_signals = None

        # ── 공통 트래킹 상태 ─────────────────────────────────
        count           = 0
        phase           = None
        state_buf       = []
        confirmed_state = None
        patient_buf     = []
        dtw_counter     = 0
        similarity      = None
        similarity_buf  = []
        no_hand_counter = 0

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

            ex         = EXERCISES[current_exercise_idx]
            count_type = ex.get("count_type", "grip")

            # 가이드 프레임 인덱스 (tap 판정에도 필요하므로 루프 상단에서 계산)
            guide_n          = len(current_guide_raw) if current_guide_raw is not None else 1
            guide_frame_idx  = int((time.time() - guide_elapsed_start) * GUIDE_FPS) % guide_n
            guide_tap_finger = (
                get_guide_tap_finger(current_guide_raw[guide_frame_idx])
                if count_type == "tap" and current_guide_raw is not None
                else None
            )

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
                        if count_type == "tap":
                            raw_state = get_tap_state(landmarks, guide_tap_finger)
                        else:
                            raw_state, _ = get_hand_state(landmarks)
                        first_landmarks = landmarks

            # ── 2. 환자 버퍼 업데이트 ────────────────────────
            if first_landmarks is not None:
                no_hand_counter = 0   # ← 손 검출되면 즉시 리셋
                coords = normalize_to_guide_scale(first_landmarks, current_guide_scale)
                patient_buf.append(current_feature_fn(coords))
                if len(patient_buf) > PATIENT_BUF_MAX:
                    patient_buf.pop(0)
            else:
                no_hand_counter += 1   # ← 미검출 프레임 카운트
                if no_hand_counter >= PATIENT_BUF_MAX:
                    patient_buf.clear()
                    similarity      = None
                    similarity_buf.clear()
                    no_hand_counter = 0

            # ── 3. DTW ───────────────────────────────────────
            dtw_counter += 1
            if dtw_counter >= DTW_INTERVAL:
                dtw_counter = 0
                raw_similarity = compute_dtw_similarity(
                    patient_buf, current_guide_np, ex["max_dtw_dist"]
                )
                if raw_similarity is not None:
                    similarity_buf.append(raw_similarity)
                    if len(similarity_buf) > SIMILARITY_SMOOTHING: # <-- 여기 변경
                        similarity_buf.pop(0)
                    similarity = sum(similarity_buf) / len(similarity_buf)

            # ── 4. 가이드 프레임 인덱스 (루프 상단에서 이미 계산됨) ──

            # ── 5. 렌더링 ────────────────────────────────────
            draw_animated_guide(frame, guide_frame_idx, current_guide_raw)
            for landmarks, handedness in valid_hands:
                draw_hand(frame, landmarks, handedness, joint_signals)

            # ── 상태 안정화 & 카운팅 ─────────────────────────
            valid_states = ("open", "tap") if count_type == "tap" else ("open", "grip")
            if raw_state in valid_states:
                state_buf.append(raw_state)
            if len(state_buf) > STABLE_FRAMES:
                state_buf.pop(0)

            if (len(state_buf) == STABLE_FRAMES
                    and all(s == state_buf[0] for s in state_buf)):
                new_state = state_buf[0]
                
                # 1. 상태 전이 및 카운트 판별 (상태가 변했을 때 '단 1회' 실행)
                if new_state != confirmed_state:
                    confirmed_state = new_state
                    should_count    = False

                    # ── 운동 타입별 페이즈 전환 & 카운트 트리거 ─────
                    if count_type == "grip":
                        if confirmed_state == "open":
                            if phase == "grip":
                                should_count = True
                            phase = "open"
                            joint_signals = None
                        elif confirmed_state == "grip":
                            if phase == "open":
                                phase = "grip"
                    else:  # tap
                        if confirmed_state == "open":
                            if phase == "tap":
                                should_count = True
                            phase = "open"
                            joint_signals = None
                        elif confirmed_state == "tap":
                            if phase == "open":
                                phase = "tap"

                    if should_count:
                        count += 1

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
                            no_hand_counter = 0

                            # ── 운동 완료 체크 ──────────────────────
                            if current_set > ex["target_set"]:
                                current_exercise_idx += 1
                                current_set = 1

                                if current_exercise_idx >= len(EXERCISES):
                                    session_complete    = True
                                    session_complete_at = time.time()
                                else:
                                    ex_new              = EXERCISES[current_exercise_idx]
                                    current_guide_raw   = _load_guide(ex_new["guide_path"])
                                    current_guide_np    = _load_guide_features(
                                        ex_new["guide_path"], ex_new["feature_fn"]
                                    )
                                    current_guide_scale = compute_guide_scale(current_guide_raw)
                                    current_feature_fn  = ex_new["feature_fn"]
                                    guide_elapsed_start = time.time()
                                    current_guide_targets = _compute_guide_finger_targets(current_guide_raw, current_feature_fn)
                                    joint_signals = None

            # 2. 실시간 스켈레톤 색상 업데이트 (동작이 유지되는 동안 '매 프레임' 실행)
            if confirmed_state == "grip" and count_type == "grip":
                if first_landmarks is not None and current_guide_targets is not None:
                    coords = normalize_to_guide_scale(first_landmarks, current_guide_scale)
                    cur_features = current_feature_fn(coords)
                    finger_sigs = _finger_signals_from_distance(cur_features, current_guide_targets)
                    joint_signals = _build_joint_signals_from_fingers(finger_sigs)
            elif confirmed_state == "tap" and count_type == "tap":
                if first_landmarks is not None and current_guide_targets is not None:
                    coords = normalize_to_guide_scale(first_landmarks, current_guide_scale)
                    cur_features = current_feature_fn(coords)
                    finger_sigs = _finger_signals_from_distance(cur_features, current_guide_targets)
                    joint_signals = _build_joint_signals_from_fingers(finger_sigs)

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
                state_lbl  = {"open": "OPEN", "grip": "GRIP", "tap": "TAP"}.get(confirmed_state, "")
                signal     = (
                    "green"  if (similarity or 0) >= 80 else
                    "yellow" if (similarity or 0) >= 50 else "red"
                ) if similarity is not None else "gray"
                payload = {
                    "landmarks":     [[lm.x, lm.y, lm.z] for lm in first_landmarks]
                                     if first_landmarks is not None else [],
                    "count":         count,
                    "state":         state_lbl,
                    "similarity":    round(similarity, 1) if similarity is not None else None,
                    "signal":        signal,
                    "overload":      overload_stage >= 1,
                    "session_end":   overload_stage == 2 or session_complete,
                    "exercise":      ex_now["name"],
                    "set":           current_set,
                    "total_sets":    ex_now["target_set"],
                    }
                try:
                    q.put_nowait(payload)
                except queue.Full:
                    pass

            # ── HUD ──────────────────────────────────────────
            state_lbl     = {"open": "OPEN", "grip": "GRIP", "tap": "TAP"}.get(confirmed_state, "---")
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
