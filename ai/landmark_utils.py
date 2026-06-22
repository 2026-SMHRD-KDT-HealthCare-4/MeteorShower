import numpy as np

# index/middle/ring/pinky MCP joints: rigid base of the palm. Their distance
# from the wrist stays roughly constant across finger articulation (fist/open/
# tap), making their average a stable size reference across frames.
_PALM_REF_INDICES = (5, 9, 13, 17)

# Floor for a palm-size scale so a barely-detected/too-far hand (scale ~0)
# never causes a divide-by-near-zero blowup. Real palm scales are ~0.05-0.2.
_MIN_SCALE = 0.02


def translate_to_wrist(landmarks):
    """Wrist-center 21 hand landmarks to (21, 3) float32.

    This is the only normalization guide JSON files use: it removes camera
    position but keeps the guide's original recording-time scale intact.
    """
    wrist = landmarks[0]
    return np.array(
        [[lm.x - wrist.x, lm.y - wrist.y, lm.z - wrist.z] for lm in landmarks],
        dtype=np.float32,
    )


def palm_scale(coords):
    """Palm-size reference from wrist-relative coords.

    `coords` is (21, 3) for a single frame or (N, 21, 3) for a sequence;
    returns a scalar or (N,) array. Measured from x/y only -- MediaPipe's z
    is a noisier depth estimate, so including it would inject that noise
    into the scale.
    """
    palm_xy = coords[..., list(_PALM_REF_INDICES), :2]
    return np.sqrt((palm_xy ** 2).sum(axis=-1)).mean(axis=-1)


def compute_guide_scale(guide_np):
    """Mean palm-size reference across all frames of a guide sequence.

    Used as the target scale that live patient landmarks get rescaled to,
    so the guide JSON itself never needs to change. Returns 1.0 (no-op) if
    the guide is missing/empty.
    """
    if guide_np is None or len(guide_np) == 0:
        return 1.0
    return float(palm_scale(guide_np).mean())


def normalize_to_guide_scale(landmarks, guide_scale):
    """Wrist-center live landmarks, then rescale so this hand's palm size
    matches `guide_scale`.

    This maps the patient's coordinates into the guide's coordinate space
    regardless of the patient's camera distance / hand size, while leaving
    the guide data itself untouched.
    """
    coords = translate_to_wrist(landmarks)
    scale = max(float(palm_scale(coords)), _MIN_SCALE)
    ratio = guide_scale / scale
    return coords * ratio


def extract_features_full_fist(coords):
    """(21, 3) wrist-relative coords → (5,) feature vector.

    손목(0) 기준 각 손가락 끝까지의 3D 거리.
    주먹: 5개 값 모두 작음.
    V표시: 검지(8)·중지(12) 거리만 크고 나머지 작음 → 패턴 다름.
    """
    tips = [4, 8, 12, 16, 20]   # 엄지, 검지, 중지, 약지, 새끼 끝
    return np.array(
        [np.linalg.norm(coords[i]) for i in tips],
        dtype=np.float32
    )


def extract_features_tapping(coords):
    """(21, 3) wrist-relative coords → (8,) feature vector.

    앞 4개: 엄지끝(4) 기준 각 손가락끝(8,12,16,20)까지의 3D 거리.
    뒤 4개: 손목(0, 원점) 기준 각 손가락끝(8,12,16,20)까지의 3D 거리.
    검지+엄지 탭: 앞쪽은 첫 번째 값만 작음, 뒤쪽은 탭한 손가락만 작고
    나머지는 펴져 있어 큼.
    그립: 앞쪽 4개 모두 작고, 뒤쪽 4개도 모두 작음 → 탭 패턴과 다름.
    """
    thumb = coords[4]
    tips  = [8, 12, 16, 20]
    thumb_dists = [np.linalg.norm(coords[i] - thumb) for i in tips]
    wrist_dists = [np.linalg.norm(coords[i]) for i in tips]
    return np.array(thumb_dists + wrist_dists, dtype=np.float32)


def calculate_joint_angle(p1, p2, p3):
    """세 점(p1, p2, p3)으로 p2를 꼭짓점으로 하는 내부 각도(0~180도)를 계산.

    v1 = p1-p2, v2 = p3-p2 사이의 각도. 곧게 펴졌을 때 180°에 가깝고,
    관절이 굽을수록 0°에 가까워진다 (해부학적 굴곡각 관례와 동일한 방향).
    """
    p1 = np.asarray(p1, dtype=np.float32)
    p2 = np.asarray(p2, dtype=np.float32)
    p3 = np.asarray(p3, dtype=np.float32)
    v1 = p1 - p2
    v2 = p3 - p2
    n1 = np.linalg.norm(v1)
    n2 = np.linalg.norm(v2)
    if n1 < 1e-6 or n2 < 1e-6:
        return 180.0
    cos_theta = np.dot(v1, v2) / (n1 * n2)
    return float(np.degrees(np.arccos(np.clip(cos_theta, -1.0, 1.0))))


# 손가락별 (p1, p2, p3) 랜드마크 인덱스. p2가 각도를 측정할 관절.
# 검지/중지/약지/새끼: 손목(0)을 기준점으로 MCP 각도까지 포함.
# 엄지: CMC(1)을 기준점으로 사용 (손목 대신 CMC가 구조상 더 적합).
_FINGER_JOINT_INDICES = {
    "thumb":  {"MCP": (1, 2, 3),   "IP":  (2, 3, 4)},
    "index":  {"MCP": (0, 5, 6),   "PIP": (5, 6, 7),   "DIP": (6, 7, 8)},
    "middle": {"MCP": (0, 9, 10),  "PIP": (9, 10, 11), "DIP": (10, 11, 12)},
    "ring":   {"MCP": (0, 13, 14), "PIP": (13, 14, 15), "DIP": (14, 15, 16)},
    "pinky":  {"MCP": (0, 17, 18), "PIP": (17, 18, 19), "DIP": (18, 19, 20)},
}


def compute_finger_angles(coords):
    # 이 구조로 반환되는지 확인하세요
    return {
        finger: {
            joint_name: calculate_joint_angle(coords[a], coords[b], coords[c])
            for joint_name, (a, b, c) in joints.items()
        }
        for finger, joints in _FINGER_JOINT_INDICES.items()
    }


def mirror_guide_to_right_hand(guide_np):
    """왼손 기준 가이드 (N, 21, 3)을 오른손용으로 좌우 반전.

    손목 기준 상대좌표에서 x축만 부호 반전하면 거울 대칭이 된다.
    y, z축은 그대로 유지.
    """
    if guide_np is None:
        return None
    mirrored = guide_np.copy()
    mirrored[..., 0] *= -1
    return mirrored