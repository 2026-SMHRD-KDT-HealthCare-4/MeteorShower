import base64
import json
import math
import os
import queue
import shutil
import tempfile
import threading
import time
import urllib.request
from collections import defaultdict
from datetime import datetime

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

# ★ 수정됨: _FINGER_JOINT_INDICES를 가져와서 랜드마크 번호 매핑에 사용합니다.
from landmark_utils import (
    compute_guide_scale, normalize_to_guide_scale,
    extract_features_full_fist, extract_features_tapping,
    compute_finger_angles, mirror_guide_to_right_hand,
    _FINGER_JOINT_INDICES
)
from notification_trigger import build_blocking_event, send_notification_to_backend
from feedback_trigger import FeedbackTracker

MODEL_PATH = os.path.join(os.path.dirname(__file__), "hand_landmarker.task")
MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)

if not os.path.exists(MODEL_PATH):
    print("hand_landmarker.task 모델 다운로드 중...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("다운로드 완료")

# MediaPipe C++ 레이어는 경로에 한글/공백이 있으면 파일을 못 열어요.
# ASCII 경로가 아니면 임시 폴더로 복사해서 사용합니다.
try:
    MODEL_PATH.encode('ascii')
except UnicodeEncodeError:
    _tmp_path = os.path.join(tempfile.gettempdir(), "hand_landmarker.task")
    if not os.path.exists(_tmp_path):
        shutil.copy2(MODEL_PATH, _tmp_path)
        print(f"[Model] 임시 경로로 복사 완료: {_tmp_path}")
    else:
        print(f"[Model] 임시 경로 사용: {_tmp_path}")
    MODEL_PATH = _tmp_path

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]

STABLE_FRAMES   = 3
TAP_THRESHOLDS  = {8: 0.06, 12: 0.07, 16: 0.09, 20: 0.09}
TARGET_ROM      = 0.8
OVERLOAD_STAGE1_TIMEOUT = 5.0
CAPTURE_DIR     = os.path.join(os.path.dirname(__file__), "captures")
GUIDE_FPS       = 30.0
GUIDE_SCALE     = 900
MAX_DTW_DIST    = 0.162
WINDOW_STRETCH  = 2
WINDOW_STRIDE   = 3
DTW_INTERVAL    = 10
PATIENT_BUF_MAX = 30

SIMILARITY_SMOOTHING = 12
PENALTY_POWER        = 0.8

DTW_WEIGHT    = 0.5
ROM_WEIGHT    = 0.5
ROM_SMOOTHING = 12

# Adaptive baseline design rationale:
# - Bradykinesia = slowness AND decrement in amplitude/speed as movements
#   continue (MDS diagnostic criteria; Interrater Reliability study,
#   PMC10357208). 그래서 시간(속도)과 ROM(진폭) 두 축을 함께 추적한다.
# - Amplitude/velocity decrement(sequence effect)는 보통 초반 구간의
#   최대·최상값 대비 후반 하락으로 측정됨 (MDS Abstracts 2016,
#   "Evaluating bradykinesia: How many finger taps are needed?";
#   iRBD finger tapping study, ScienceDirect 2020, 처음 10탭의 MaxOpV·AmpDec).
# - Decrement는 운동 초반부터 나타날 수 있어 평균이 아닌 best를 baseline으로
#   사용 (ReTap, Sensors 2023, MDPI 23(11):5238 — 블록 시작 부근의 진폭
#   감소도 점수 3에 해당).
# 주의: 이 로직은 재활 피드백용 heuristic이며 UPDRS 점수를 재현하는
# 검증된 알고리즘이 아니다.
ADAPT_BASELINE_REPS   = 4      # 초반 몇 rep을 baseline 수집 구간으로 쓸지
SLOWDOWN_RATIO        = 1.3    # baseline 시간 × 이 값 초과 시 "느려짐"
ROM_DROP_RATIO        = 0.7    # baseline ROM × 이 값 미만 시 "얕아짐"
DTW_RELAX_STEP        = 0.05   # 트리거 시 max_dtw_dist 증가폭
DTW_RELAX_MAX_MULT    = 1.5    # max_dtw_dist 완화 상한 = 원래값 × 이 값

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

DEFAULT_FINGER_ROM_TARGETS = {
"thumb": {"IP": 110},
    "index": {"MCP": 95, "PIP": 120, "DIP": 120},
    "middle": {"MCP": 60, "PIP": 140, "DIP": 60},
    "ring": {"MCP": 55, "PIP": 140, "DIP": 75},
    "pinky": {"MCP": 45, "PIP": 150, "DIP": 80}
}
FINGER_NAMES = ["thumb", "index", "middle", "ring", "pinky"]

# 새로 추가: 탭핑 전용 타겟 (각도가 그립보다 더 완만해야 함)
TAP_FINGER_ROM_TARGETS = {
    "thumb":  {"IP": 80},
    "index":  {"MCP": 150, "PIP": 100, "DIP": 140},
    "middle": {"MCP": 150, "PIP": 105, "DIP": 140},
    "ring":   {"MCP": 150, "PIP": 110, "DIP": 145},
    "pinky":  {"MCP": 150, "PIP": 100, "DIP": 140},
}


# ★ 수정됨: 새 데이터 구조에 맞춰 각 관절의 '랜드마크 번호'를 키로 하는 딕셔너리 반환
def _finger_angle_signals(angles_dict, target_angles_dict):
    signals = {i: "green" for i in range(21)} 
    for finger_name, joints in angles_dict.items():
        if finger_name not in target_angles_dict: continue
        
        for joint_name, angle in joints.items():
            if joint_name not in target_angles_dict[finger_name]: continue
            
            target = target_angles_dict[finger_name][joint_name]
            pivot_idx = _FINGER_JOINT_INDICES[finger_name][joint_name][1]
            
            if angle <= target + 8:
                signals[pivot_idx] = "green"
            elif angle <= target + 15:
                signals[pivot_idx] = "yellow"
            else:
                signals[pivot_idx] = "red"
    return signals


def _compute_rom_score(angles_dict, targets):
    total_score = 0
    joint_count = 0
    for finger, joints in angles_dict.items():
        if finger not in targets: continue
        for joint_name, angle in joints.items():
            if joint_name in targets[finger]:
                target = targets[finger][joint_name]
                ratio = max(0, (180 - angle) / (180 - target))
                total_score += min(1.0, ratio)
                joint_count += 1
    return (total_score / joint_count) * 100 if joint_count > 0 else 0


_BASE = os.path.dirname(__file__)
EXERCISES = [
    {
        "name":         "full_fist",
        "guide_path":   os.path.join(_BASE, "guide_data", "full_fist.json"),
        "target_count": 7,   
        "target_set":   2,   
        "count_type":   "grip",
        # ★ 수정됨: 꽉 쥐었을 때 일치율 폭락을 막기 위해 DTW 허용치를 늘림 (0.35 -> 0.50)
        "max_dtw_dist": 0.50, 
        "feature_fn":   extract_features_full_fist,
    },
    {
        "name":         "tapping",
        "guide_path":   os.path.join(_BASE, "guide_data", "tapping.json"),
        "target_count": 7,   
        "target_set":   2,   
        "count_type":   "tap",
        "max_dtw_dist": 0.45,
        "feature_fn":   extract_features_tapping,
    },
]


def _load_guide(guide_path: str):
    if not os.path.exists(guide_path):
        print(f"[WARN] guide not found: {guide_path}")
        return None
    with open(guide_path) as f:
        arr = np.array(json.load(f), dtype=np.float32)
    print(f"guide loaded: {os.path.basename(guide_path)}  ({len(arr)} frames)")
    return arr


def _load_guide_features(guide_path, feature_fn):
    arr = _load_guide(guide_path)
    if arr is None: return None
    return np.array([feature_fn(frame) for frame in arr], dtype=np.float32)


def dist2(a, b):
    return (a.x - b.x) ** 2 + (a.y - b.y) ** 2


def get_hand_state(landmarks):
    wrist = landmarks[0]
    pairs = [(4, 3), (8, 6), (12, 10), (16, 14), (20, 18)]
    fingers = [
        dist2(wrist, landmarks[tip_i]) > dist2(wrist, landmarks[pip_i])
        for tip_i, pip_i in pairs
    ]
    folded = sum(not f for f in fingers[1:])
    if folded >= 2: return "grip", fingers
    elif folded == 0: return "open", fingers
    else: return "partial", fingers


def get_guide_tap_finger(guide_frame):
    thumb      = guide_frame[4]
    min_dist   = float("inf")
    tap_finger = None
    for tip_i in [8, 12, 16, 20]:
        tip  = guide_frame[tip_i]
        dist = math.sqrt(float((thumb[0] - tip[0])**2 + (thumb[1] - tip[1])**2 + (thumb[2] - tip[2])**2))
        if dist < TAP_THRESHOLDS[tip_i] and dist < min_dist:
            min_dist   = dist
            tap_finger = tip_i
    return tap_finger


def get_tap_state(landmarks):
    thumb = landmarks[4]
    wrist = landmarks[0]
    mcp   = landmarks[5] 
    
    pairs = [(8, 6), (12, 10), (16, 14), (20, 18)]
    folded_count = 0
    for tip_i, pip_i in pairs:
        tip_dist = (wrist.x - landmarks[tip_i].x)**2 + (wrist.y - landmarks[tip_i].y)**2
        pip_dist = (wrist.x - landmarks[pip_i].x)**2 + (wrist.y - landmarks[pip_i].y)**2
        if tip_dist < pip_dist: folded_count += 1
            
    if folded_count >= 2: return "wrong_motion", None 

    ref_length = math.sqrt((wrist.x - mcp.x)**2 + (wrist.y - mcp.y)**2 + (wrist.z - mcp.z)**2)
    if ref_length < 1e-6: ref_length = 0.1
        
    min_ratio = float("inf")
    active_finger = 8
    
    for tip_i in [8, 12, 16, 20]:
        tip = landmarks[tip_i]
        dist = math.sqrt((thumb.x - tip.x)**2 + (thumb.y - tip.y)**2 + (thumb.z - tip.z)**2)
        ratio = dist / ref_length
        if ratio < min_ratio:
            min_ratio = ratio
            active_finger = tip_i
            
    touch_thresholds = {8: 0.20, 12: 0.22, 16: 0.24, 20: 0.26}
    touch_th = touch_thresholds[active_finger]
    
    if min_ratio <= touch_th: return "tap", active_finger
    elif min_ratio <= touch_th + 0.4: return "open", active_finger
    else: return "open", None


def compute_overload_rom(landmarks):
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


def compute_dtw_similarity(patient_buf, guide_np, max_dtw_dist=MAX_DTW_DIST):
    if guide_np is None or len(patient_buf) < 2: return None
    seq1 = np.array(patient_buf, dtype=np.float32) 
    m = len(seq1)
    n = len(guide_np)

    diff = seq1[:, np.newaxis] - guide_np[np.newaxis] 
    point_dist = np.sqrt((diff ** 2).sum(axis=-1))
    if point_dist.ndim > 2: frame_dist = point_dist.reshape(m, n, -1).mean(axis=-1)
    else: frame_dist = point_dist

    dtw = np.full((m + 1, n + 1), np.inf)
    dtw[0, :] = 0.0  
    
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            cost = frame_dist[i - 1, j - 1]
            dtw[i, j] = cost + min(dtw[i-1, j], dtw[i, j-1], dtw[i-1, j-1])
    
    best_avg = np.min(dtw[m, 1:]) / m
    raw_ratio = max(0.0, 1.0 - best_avg / max_dtw_dist)
    similarity = (raw_ratio ** PENALTY_POWER) * 100
    return similarity


def draw_animated_guide(frame, guide_frame_idx, guide_np):
    if guide_np is None: return
    h, w = frame.shape[:2]
    cx, cy = w // 2, h // 2 + 225
    gf = guide_np[guide_frame_idx % len(guide_np)]
    pts = [(int(cx + rel[0] * GUIDE_SCALE), int(cy + rel[1] * GUIDE_SCALE)) for rel in gf]
    for s_idx, e_idx in HAND_CONNECTIONS:
        cv2.line(frame, pts[s_idx], pts[e_idx], (255, 0, 0), 3)


def draw_hand(frame, landmarks, handedness, joint_signals=None):
    h, w = frame.shape[:2]
    DEFAULT_COLOR = (0, 255, 0)
    DEFAULT_SEG_COLOR = (0, 200, 0)

    for i, lm in enumerate(landmarks):
        state = joint_signals.get(i, "green") if joint_signals else "green"
        color = SIGNAL_BGR.get(state, DEFAULT_COLOR)
        cv2.circle(frame, (int(lm.x * w), int(lm.y * h)), 6, color, -1)
    
    for s_idx, e_idx in HAND_CONNECTIONS:
        s, e = landmarks[s_idx], landmarks[e_idx]
        seg_color = DEFAULT_SEG_COLOR
        if joint_signals:
            ss = joint_signals.get(s_idx, "green")
            es = joint_signals.get(e_idx, "green")
            priority = {"red": 0, "yellow": 1, "green": 2}
            worse_state = ss if priority.get(ss, 2) < priority.get(es, 2) else es
            seg_color = SIGNAL_BGR.get(worse_state, DEFAULT_SEG_COLOR)
            
        cv2.line(frame, (int(s.x * w), int(s.y * h)), 
                        (int(e.x * w), int(e.y * h)), seg_color, 2)
    
    wrist = landmarks[0]
    flipped = "Right" if handedness.category_name == "Left" else "Left"
    cv2.putText(frame, f"{flipped} {handedness.score:.2f}",
                (int(wrist.x * w), int(wrist.y * h) - 10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)


_options = vision.HandLandmarkerOptions(
    base_options=python.BaseOptions(model_asset_path=MODEL_PATH),
    running_mode=vision.RunningMode.VIDEO,
    num_hands=1,
    min_hand_detection_confidence=0.7,
    min_hand_presence_confidence=0.7,
    min_tracking_confidence=0.7,
)


def print_angle_summary(angle_stats, total_frames):
    """운동별로 누적된 관절 각도 통계(min/max/avg)를 콘솔에 정렬해서 출력.

    angle_stats: { 운동명: { "finger_joint": {min,max,sum,count}, ... }, ... }
    total_frames: { 운동명: 프레임 수, ... }
    finger는 thumb→index→middle→ring→pinky, joint는 MCP→PIP→DIP(엄지는 MCP→IP)
    순서로 _FINGER_JOINT_INDICES의 정의 순서를 그대로 따른다.
    데이터가 있는 운동만 블록으로 출력한다.
    """
    for ex_name, ex_stats in angle_stats.items():
        frames = total_frames.get(ex_name, 0)
        print(f"====== [{ex_name}] 관절 각도 통계 (총 {frames} 프레임) ======")
        for finger, joints in _FINGER_JOINT_INDICES.items():
            for joint in joints:
                stat = ex_stats.get(f"{finger}_{joint}")
                label = f"{finger:6s} {joint:3s}"
                if not stat or stat["count"] == 0:
                    print(f"{label}: no data")
                    continue
                avg = stat["sum"] / stat["count"]
                print(
                    f"{label}: min {stat['min']:5.1f} / max {stat['max']:5.1f} "
                    f"/ avg {avg:5.1f}  (samples: {stat['count']})"
                )
        print("============================================")


def run_tracking(q: queue.Queue = None, finger_rom_targets=None, patient_id=None, doctor_id=None, hand="left", stop_event: threading.Event = None, show_window: bool = True):
    # 1. 외부 입력 데이터가 있으면 그것을 우선 사용
    if finger_rom_targets is not None:
        target_angles = finger_rom_targets
    else:
        # 2. 없으면 첫 번째 운동 타입을 확인해서 자동 설정
        ex0 = EXERCISES[0]
        target_angles = TAP_FINGER_ROM_TARGETS if ex0["count_type"] == "tap" else DEFAULT_FINGER_ROM_TARGETS

    with vision.HandLandmarker.create_from_options(_options) as landmarker:
        cap = cv2.VideoCapture(0, cv2.CAP_DSHOW)
        loop_start          = time.time()
        guide_elapsed_start = loop_start  

        current_exercise_idx = 0
        current_set          = 1
        ex0                  = EXERCISES[current_exercise_idx]
        current_guide_raw    = _load_guide(ex0["guide_path"])          
        if hand == "right": current_guide_raw = mirror_guide_to_right_hand(current_guide_raw)
        current_guide_np     = (
            np.array([ex0["feature_fn"](frame) for frame in current_guide_raw], dtype=np.float32)
            if current_guide_raw is not None else None
        )
        current_guide_scale  = compute_guide_scale(current_guide_raw)
        current_feature_fn   = ex0["feature_fn"]
        joint_signals = None
        feedback_tracker = FeedbackTracker()

        count           = 0
        phase           = None
        state_buf       = []
        confirmed_state = None
        patient_buf     = []
        dtw_counter     = 0
        similarity          = None
        similarity_buf      = []
        rom_score           = None
        rom_score_buf       = []
        display_similarity  = None
        no_hand_counter = 0

        overload_stage            = 0
        overload_count_marker     = -1
        overload_stage1_started_at = None
        session_end_at        = None

        overload_cause          = None 
        overload_measured_rom   = None
        overload_threshold_rom  = None
        overload_measured_count = None
        overload_target_count   = None
        overload_exercise_name  = None

        session_complete    = False
        session_complete_at = None

        # 운동별 관절 각도 누적 통계 (min/max/sum/count). 손이 감지된 프레임에서만 갱신.
        # { "full_fist": {"index_PIP": {...}, ...}, "tapping": {...} } 형태로 운동마다 분리.
        angle_stats = defaultdict(lambda: {
            f"{finger}_{joint}": {"min": None, "max": None, "sum": 0.0, "count": 0}
            for finger, joints in _FINGER_JOINT_INDICES.items()
            for joint in joints
        })
        angle_sample_frames = defaultdict(int)

        # 운동별 적응형 난이도 상태 — best(rep_time 최소, rom 최대)를 baseline으로 잡고,
        # 확정 후 하락이 감지되면 해당 운동의 DTW 판정(current_max_dtw)을 실시간으로 완화한다.
        # baseline은 운동(이름) 단위로 한 번만 확정되며, 같은 운동의 다음 set에서도 유지된다.
        adapt_states = {
            ex_def["name"]: {
                "rep_count": 0,
                "last_rep_time": None,
                "pair_start_time": None,
                "baseline_rep_time": None,
                "baseline_rom": None,
                "baseline_locked": False,
                "current_max_dtw": ex_def["max_dtw_dist"],
                "orig_max_dtw": ex_def["max_dtw_dist"],
            }
            for ex_def in EXERCISES
        }

        while cap.isOpened():
            if stop_event is not None and stop_event.is_set():
                break
            ret, frame = cap.read()
            if not ret: break

            ex         = EXERCISES[current_exercise_idx] if current_exercise_idx < len(EXERCISES) else EXERCISES[-1]
            count_type = ex.get("count_type", "grip")

            guide_n          = len(current_guide_raw) if current_guide_raw is not None else 1
            guide_frame_idx  = int((time.time() - guide_elapsed_start) * GUIDE_FPS) % guide_n
            guide_tap_finger = (
                get_guide_tap_finger(current_guide_raw[guide_frame_idx])
                if count_type == "tap" and current_guide_raw is not None else None
            )

            frame = cv2.flip(frame, 1)
            timestamp_ms = int((time.time() - loop_start) * 1000)

            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = landmarker.detect_for_video(mp_image, timestamp_ms)

            raw_state             = None
            first_landmarks       = None
            patient_active_finger = None 
            valid_hands           = []
            
            if result.hand_landmarks and result.handedness:
                for landmarks, handedness_list in zip(result.hand_landmarks, result.handedness):
                    handedness = handedness_list[0]
                    if handedness.score < 0.7: continue
                    valid_hands.append((landmarks, handedness))
                    if raw_state is None:
                        if count_type == "tap":
                            raw_state, patient_active_finger = get_tap_state(landmarks)
                        else:
                            raw_state, _ = get_hand_state(landmarks)
                        first_landmarks = landmarks

            if first_landmarks is not None:
                no_hand_counter = 0  
                coords = normalize_to_guide_scale(first_landmarks, current_guide_scale)
                patient_buf.append(current_feature_fn(coords))
                if len(patient_buf) > PATIENT_BUF_MAX:
                    patient_buf.pop(0)
            else:
                no_hand_counter += 1  
                if no_hand_counter >= PATIENT_BUF_MAX:
                    patient_buf.clear()
                    similarity      = None
                    similarity_buf.clear()
                    rom_score       = None
                    rom_score_buf.clear()
                    no_hand_counter = 0

            dtw_counter += 1
            if dtw_counter >= DTW_INTERVAL:
                dtw_counter = 0
                if len(patient_buf) >= 10:
                    # ★ 적응형 난이도: 고정 상수(ex["max_dtw_dist"]) 대신
                    # 실시간으로 완화될 수 있는 adapt_states[...]["current_max_dtw"] 사용
                    raw_similarity = compute_dtw_similarity(
                        patient_buf, current_guide_np, adapt_states[ex["name"]]["current_max_dtw"]
                    )
                    if raw_similarity is not None:
                        similarity_buf.append(raw_similarity)
                        if len(similarity_buf) > SIMILARITY_SMOOTHING:
                            similarity_buf.pop(0)
                        similarity = sum(similarity_buf) / len(similarity_buf)
                else:
                    similarity = None
                    similarity_buf.clear()

            draw_animated_guide(frame, guide_frame_idx, current_guide_raw)

            valid_states = ("open", "tap") if count_type == "tap" else ("open", "grip")
            if raw_state in valid_states:
                state_buf.append(raw_state)
            if len(state_buf) > STABLE_FRAMES:
                state_buf.pop(0)

            if len(state_buf) == STABLE_FRAMES and all(s == state_buf[0] for s in state_buf):
                new_state = state_buf[0]
                if new_state != confirmed_state:
                    confirmed_state = new_state
                    should_count    = False

                    if count_type == "grip":
                        if confirmed_state == "open":
                            if phase == "grip": should_count = True
                            phase = "open"
                            joint_signals = None
                        elif confirmed_state == "grip":
                            if phase == "open": phase = "grip"
                    else:  
                        if confirmed_state == "open":
                            if phase == "tap": should_count = True
                            phase = "open"
                            joint_signals = None
                        elif confirmed_state == "tap":
                            if phase == "open": phase = "tap"

                    if should_count:
                        count += 1

                        # ── 적응형 난이도: 2-rep 묶음 평균 시간/ROM baseline 추적 + DTW 완화 ──
                        _now = time.time()
                        _adapt = adapt_states[ex["name"]]
                        _adapt["rep_count"] += 1

                        if _adapt["pair_start_time"] is None:
                            # 새 2-rep 묶음 시작 (홀수 rep) — 측정 보류
                            _adapt["pair_start_time"] = _now
                        elif _adapt["rep_count"] % 2 == 0:
                            # 묶음 완성 (짝수 rep) — 묶음 평균 시간 산출
                            _pair_avg = (_now - _adapt["pair_start_time"]) / 2
                            _adapt["pair_start_time"] = None

                            if not _adapt["baseline_locked"]:
                                # baseline 수집 구간: best(최소 시간 / 최대 ROM)로 갱신
                                if (_adapt["baseline_rep_time"] is None
                                        or _pair_avg < _adapt["baseline_rep_time"]):
                                    _adapt["baseline_rep_time"] = _pair_avg
                                if rom_score is not None and (
                                        _adapt["baseline_rom"] is None
                                        or rom_score > _adapt["baseline_rom"]):
                                    _adapt["baseline_rom"] = rom_score

                                if _adapt["rep_count"] >= ADAPT_BASELINE_REPS:
                                    _adapt["baseline_locked"] = True
                                    print(
                                        f"[Adapt][{ex['name']}] baseline 확정 — "
                                        f"rep_time={_adapt['baseline_rep_time']:.2f}s, "
                                        f"rom={(_adapt['baseline_rom'] or 0):.1f}"
                                    )
                            else:
                                # baseline 확정 후: 하락 감지 → 트리거되면 묶음당 최대 1 step DTW 완화
                                _triggered = False
                                _base_time = _adapt["baseline_rep_time"]
                                _base_rom  = _adapt["baseline_rom"]

                                if _base_time and _pair_avg > _base_time * SLOWDOWN_RATIO:
                                    print(
                                        f"[Adapt][{ex['name']}] 너무 느려졌어요 "
                                        f"(현재 {_pair_avg:.2f}s vs 기준 {_base_time:.2f}s)"
                                    )
                                    _triggered = True

                                if (_base_rom and rom_score is not None
                                        and rom_score < _base_rom * ROM_DROP_RATIO):
                                    print(
                                        f"[Adapt][{ex['name']}] 동작이 얕아졌어요 "
                                        f"(현재 {rom_score:.1f} vs 기준 {_base_rom:.1f})"
                                    )
                                    _triggered = True

                                if _triggered:
                                    _orig    = _adapt["orig_max_dtw"]
                                    _new_max = min(
                                        _adapt["current_max_dtw"] + DTW_RELAX_STEP,
                                        _orig * DTW_RELAX_MAX_MULT
                                    )
                                    if _new_max > _adapt["current_max_dtw"]:
                                        _adapt["current_max_dtw"] = _new_max
                                        print(
                                            f"[Adapt][{ex['name']}] DTW 허용치 완화 → "
                                            f"{_adapt['current_max_dtw']:.3f} (원래 {_orig:.3f})"
                                        )

                        _adapt["last_rep_time"] = _now

                        if overload_stage == 0 and count > ex["target_count"]:
                            save_capture(frame)
                            overload_stage        = 1
                            overload_count_marker = count
                            overload_stage1_started_at = time.time()
                            overload_cause          = "count"
                            overload_measured_count = count
                            overload_target_count   = ex["target_count"]
                            overload_exercise_name  = ex["name"]

                        elif count >= ex["target_count"] and overload_stage == 0:
                            current_set += 1
                            count = 0
                            phase = None
                            state_buf.clear()
                            confirmed_state = None
                            patient_buf.clear()
                            similarity = None
                            similarity_buf.clear()
                            rom_score = None
                            rom_score_buf.clear()
                            no_hand_counter = 0

                            if current_set > ex["target_set"]:
                                current_exercise_idx += 1
                                current_set = 1

                                if current_exercise_idx >= len(EXERCISES):
                                    session_complete    = True
                                    session_complete_at = time.time()
                                else:
                                    ex_new              = EXERCISES[current_exercise_idx]
                                    # 운동이 전환될 때 타겟값도 운동 타입에 맞게 변경
                                    if ex_new["count_type"] == "tap":
                                        target_angles = TAP_FINGER_ROM_TARGETS
                                    else:
                                        target_angles = DEFAULT_FINGER_ROM_TARGETS
                                    current_guide_raw   = _load_guide(ex_new["guide_path"])
                                    if hand == "right":
                                        current_guide_raw = mirror_guide_to_right_hand(current_guide_raw)
                                    current_guide_np    = np.array(
                                        [ex_new["feature_fn"](frame) for frame in current_guide_raw],
                                        dtype=np.float32
                                    ) if current_guide_raw is not None else None
                                    current_guide_scale = compute_guide_scale(current_guide_raw)
                                    current_feature_fn  = ex_new["feature_fn"]
                                    guide_elapsed_start = time.time()
                                    rom_score     = None
                                    rom_score_buf.clear()
                                    joint_signals = None
                                    feedback_tracker.reset()

            if first_landmarks is not None:
                coords_raw = np.array([[lm.x, lm.y, lm.z] for lm in first_landmarks], dtype=np.float32)
                angles = compute_finger_angles(coords_raw)

                # 관절 각도 누적 — 운동별로 분리, 손이 감지된 프레임에서만 (stale angles는 절대 누적하지 않음)
                # 어느 운동에도 속하지 않는 프레임(세션 완료/범위 초과)은 누적하지 않음.
                if not session_complete and current_exercise_idx < len(EXERCISES):
                    cur_ex_name = EXERCISES[current_exercise_idx]["name"]
                    angle_sample_frames[cur_ex_name] += 1
                    cur_ex_stats = angle_stats[cur_ex_name]
                    for _finger, _joints in angles.items():
                        for _joint, _angle in _joints.items():
                            _stat = cur_ex_stats[f"{_finger}_{_joint}"]
                            _stat["sum"] += _angle
                            _stat["count"] += 1
                            _stat["min"] = _angle if _stat["min"] is None else min(_stat["min"], _angle)
                            _stat["max"] = _angle if _stat["max"] is None else max(_stat["max"], _angle)

                if confirmed_state == "grip" and count_type == "grip":
                    raw_rom = _compute_rom_score(angles, target_angles)
                    rom_score_buf.append(raw_rom)
                    if len(rom_score_buf) > ROM_SMOOTHING: rom_score_buf.pop(0)
                    rom_score = sum(rom_score_buf) / len(rom_score_buf)
                elif confirmed_state == "tap" and count_type == "tap" and patient_active_finger is not None:
                    finger_name_map = {8: "index", 12: "middle", 16: "ring", 20: "pinky"}
                    active_finger_name = finger_name_map.get(patient_active_finger)
                    if active_finger_name in angles and active_finger_name in target_angles:
                        tap_angles_subset  = {active_finger_name: angles[active_finger_name]}
                        tap_targets_subset = {active_finger_name: target_angles[active_finger_name]}
                        raw_rom = _compute_rom_score(tap_angles_subset, tap_targets_subset)
                        rom_score_buf.append(raw_rom)
                        if len(rom_score_buf) > ROM_SMOOTHING: rom_score_buf.pop(0)
                        rom_score = sum(rom_score_buf) / len(rom_score_buf)

                # ★ 수정됨: 신호등 연산 완전 정상화
                if confirmed_state == "grip" and count_type == "grip":
                    joint_signals = _finger_angle_signals(angles, target_angles)
                elif count_type == "tap":
                    if raw_state == "wrong_motion":
                        joint_signals = {i: "red" for i in range(21)}
                    elif patient_active_finger is not None:
                        # 1. 거리 기반: 끝점(Tip) 판별 (닿았는가?)
                        thumb = first_landmarks[4]
                        tip   = first_landmarks[patient_active_finger]
                        wrist = first_landmarks[0]
                        mcp   = first_landmarks[5]
                        
                        ref_length = math.sqrt((wrist.x - mcp.x)**2 + (wrist.y - mcp.y)**2 + (wrist.z - mcp.z)**2) + 1e-6
                        cur_dist = math.sqrt((thumb.x - tip.x)**2 + (thumb.y - tip.y)**2 + (thumb.z - tip.z)**2)
                        ratio = cur_dist / ref_length
                        
                        touch_thresholds = {8: 0.20, 12: 0.22, 16: 0.24, 20: 0.26}
                        touch_th = touch_thresholds.get(patient_active_finger, 0.20)
                        
                        # 일단 모두 초록색으로 초기화
                        signals = {i: "green" for i in range(21)}
                        
                        # 거리 비율에 따라 끝점(Tip) 색상 결정
                        if ratio <= touch_th:           tip_state = "green"
                        elif ratio <= touch_th + 0.15:  tip_state = "yellow"
                        else:                           tip_state = "red"
                        
                        # 엄지 끝(4번)과 움직이는 손가락 끝에 거리 기반 색상 적용
                        signals[4] = tip_state
                        signals[patient_active_finger] = tip_state

                        # 2. 각도 기반: 중간 관절(MCP, PIP, DIP) 판별 (예쁘게 구부러졌는가?)
                        finger_name_map = {8: "index", 12: "middle", 16: "ring", 20: "pinky"}
                        active_finger_name = finger_name_map.get(patient_active_finger)
                        
                        # 2. 각도 기반: 중간 관절(MCP, PIP, DIP) 판별 (정상 범위를 더 넓게!)
                        if active_finger_name in angles:
                            for joint_name, angle in angles[active_finger_name].items():
                                target = target_angles[active_finger_name].get(joint_name, 90)
                                pivot_idx = _FINGER_JOINT_INDICES[active_finger_name][joint_name][1]
                                
                                if angle <= target + 8:
                                    signals[pivot_idx] = "green"
                                elif angle <= target + 15:
                                    signals[pivot_idx] = "yellow"
                                # 그 이상(완전 펴짐)이면 빨간색
                                else:
                                    signals[pivot_idx] = "red"
                                    
                        joint_signals = signals
                    else:
                        joint_signals = {i: "green" for i in range(21)}

            if joint_signals is not None:
                feedback_messages = feedback_tracker.update(joint_signals)
                for msg in feedback_messages:
                    print(f"[{time.time():.2f}] [Feedback] {msg['finger']}/{msg['level']} {msg['message']}")

            if valid_hands:
                landmarks, handedness = valid_hands[0]
                draw_hand(frame, landmarks, handedness, joint_signals)

            if similarity is not None:
                if rom_score is not None and confirmed_state in ("grip", "tap"):
                    display_similarity = round(similarity * DTW_WEIGHT + rom_score * ROM_WEIGHT, 1)
                else:
                    display_similarity = round(similarity, 1)
            else:
                display_similarity = None

            current_rom = compute_overload_rom(first_landmarks) if first_landmarks else 0.0

            if overload_stage == 0 and current_rom > TARGET_ROM:
                save_capture(frame)
                overload_stage        = 1
                overload_count_marker = count
                overload_stage1_started_at = time.time()
                overload_cause          = "rom"
                overload_measured_rom   = current_rom
                overload_threshold_rom  = TARGET_ROM
            elif overload_stage == 1 and (
                count > overload_count_marker
                or (overload_stage1_started_at is not None
                    and time.time() - overload_stage1_started_at > OVERLOAD_STAGE1_TIMEOUT)
            ):
                save_capture(frame)
                overload_stage = 2

            if overload_stage == 2:
                if session_end_at is None:
                    session_end_at = time.time()
                elif time.time() - session_end_at > 3.0:
                    break

            if q is not None:
                ex_now     = EXERCISES[current_exercise_idx] if current_exercise_idx < len(EXERCISES) else ex
                state_lbl  = {"open": "OPEN", "grip": "GRIP", "tap": "TAP"}.get(confirmed_state, "")
                signal     = (
                    "green"  if (display_similarity or 0) >= 80 else
                    "yellow" if (display_similarity or 0) >= 50 else "red"
                ) if display_similarity is not None else "gray"
                payload = {
                    "landmarks":      [[lm.x, lm.y, lm.z] for lm in first_landmarks] if first_landmarks is not None else [],
                    "count":          count,
                    "state":          state_lbl,
                    "similarity":     display_similarity,
                    "signal":         signal,
                    "overload":       overload_stage >= 1,
                    "session_end":    overload_stage == 2 or session_complete,
                    "exercise":       ex_now["name"],
                    "set":            current_set,
                    "total_sets":     ex_now["target_set"],
                    "rom_score":      round(rom_score, 1) if rom_score is not None else None,
                    "joint_signals":  joint_signals,
                    "feedback_messages": feedback_messages if 'feedback_messages' in locals() else [],
                    "finger_angles":  angles if first_landmarks is not None else None,
                    }
                _, buf = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 55])
                payload["frame"] = base64.b64encode(buf).decode('utf-8')
                try: q.put_nowait(payload)
                except queue.Full: pass

            state_lbl     = {"open": "OPEN", "grip": "GRIP", "tap": "TAP"}.get(confirmed_state, "---")
            ex_now        = EXERCISES[current_exercise_idx] if current_exercise_idx < len(EXERCISES) else ex
            progress_text = f"{ex_now['name']}  {current_set}set/{ex_now['target_set']}set  {count}rep/{ex_now['target_count']}rep"

            cv2.putText(frame, f"COUNT: {count}", (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 255, 255), 3)
            cv2.putText(frame, f"STATE: {state_lbl}", (20, 95), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
            cv2.putText(frame, progress_text, (20, 130), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (180, 255, 180), 2)

            if display_similarity is not None:
                sc = (0, 220, 0) if display_similarity >= 80 else ((0, 200, 255) if display_similarity >= 50 else (0, 0, 220))
                mt = f"{display_similarity:.0f}%"
                (tw, _), _ = cv2.getTextSize(mt, cv2.FONT_HERSHEY_SIMPLEX, 2.0, 3)
                tx = (frame.shape[1] - tw) // 2
                cv2.putText(frame, mt, (tx, 65), cv2.FONT_HERSHEY_SIMPLEX, 2.0, sc, 3)
                cv2.circle(frame, (tx + tw + 22, 50), 14, sc, -1)

            # ★ 수정됨: 모든 관절 HUD 출력 완전 정상화
            if first_landmarks is not None:
                row = 0
                for finger_name, joints in angles.items():
                    for joint_name, angle in joints.items():
                        pivot_idx = _FINGER_JOINT_INDICES[finger_name][joint_name][1]
                        state = joint_signals.get(pivot_idx, "green") if joint_signals else "green"
                        color = SIGNAL_BGR.get(state, (255, 255, 255))
                        
                        cv2.putText(
                            frame,
                            f"{finger_name[:1]}({joint_name}):{angle:.0f}",
                            (frame.shape[1] - 120, 30 + row * 18), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1
                        )
                        row += 1

            if overload_stage == 1:
                cv2.putText(frame, "! OVERLOAD: COUNT ADJUSTED", (20, frame.shape[0] - 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            elif overload_stage == 2:
                ov = frame.copy()
                cv2.rectangle(ov, (0, 0), (frame.shape[1], frame.shape[0]), (0, 0, 180), -1)
                cv2.addWeighted(ov, 0.4, frame, 0.6, 0, frame)
                cv2.putText(frame, "! SESSION END", (frame.shape[1] // 2 - 170, frame.shape[0] // 2), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 0, 255), 4)

            if session_complete:
                ov = frame.copy()
                cv2.rectangle(ov, (0, 0), (frame.shape[1], frame.shape[0]), (0, 100, 0), -1)
                cv2.addWeighted(ov, 0.35, frame, 0.65, 0, frame)
                cv2.putText(frame, "SESSION COMPLETE!", (frame.shape[1] // 2 - 220, frame.shape[0] // 2), cv2.FONT_HERSHEY_SIMPLEX, 1.6, (0, 255, 100), 4)
                if session_complete_at and time.time() - session_complete_at > 3.0:
                    if show_window:
                        cv2.imshow("Hand Tracking", frame)
                        cv2.waitKey(1)
                    break

            if show_window:
                cv2.imshow("Hand Tracking", frame)
                if cv2.waitKey(1) & 0xFF == ord("q"):
                    break
            else:
                time.sleep(0.001)

        cap.release()
        cv2.destroyAllWindows()

        print_angle_summary(angle_stats, angle_sample_frames)

        if overload_stage == 2:
            if patient_id is None:
                print("[WARN] patient_id 없음 — 운동차단 알림을 보내지 않습니다.")
            else:
                session_data = {
                    "end_type":       "운동차단",
                    "patient_id":     patient_id,
                    "occurred_at":    datetime.fromtimestamp(session_end_at).isoformat(),
                    "overload_cause": overload_cause,
                }
                if doctor_id is not None:
                    session_data["doctor_id"] = doctor_id

                if overload_cause == "rom":
                    session_data["measured_rom"]  = overload_measured_rom
                    session_data["threshold_rom"] = overload_threshold_rom
                elif overload_cause == "count":
                    session_data["measured_count"] = overload_measured_count
                    session_data["target_count"]   = overload_target_count
                    session_data["exercise_name"]  = overload_exercise_name

                event = build_blocking_event(session_data)
                if event is not None:
                    print(f"[Notification] 운동차단 이벤트 생성됨: {event['reason_code']}")
                    sent = send_notification_to_backend(event)
                    print(f"[Notification] 백엔드 전송 {'성공' if sent else '실패'}")
        elif session_complete:
            print("All exercises completed. Session complete.")

if __name__ == "__main__":
    run_tracking(hand="right")