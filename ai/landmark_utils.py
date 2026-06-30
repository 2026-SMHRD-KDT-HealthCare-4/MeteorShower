"""손 랜드마크 좌표 정규화·특징 추출·관절 각도 계산·손바닥 방향 감지 유틸리티."""
import numpy as np

# index/middle/ring/pinky MCP joints: rigid base of the palm. Their distance
# from the wrist stays roughly constant across finger articulation (fist/open/
# tap), making their average a stable size reference across frames.
_PALM_REF_INDICES = (5, 9, 13, 17)

# Floor for a palm-size scale so a barely-detected/too-far hand (scale ~0)
# never causes a divide-by-near-zero blowup. Real palm scales are ~0.05-0.2.
_MIN_SCALE = 0.02


def translate_to_wrist(landmarks) -> np.ndarray:
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


def compute_guide_scale(guide_np) -> float:
    """Mean palm-size reference across all frames of a guide sequence.

    Used as the target scale that live patient landmarks get rescaled to,
    so the guide JSON itself never needs to change. Returns 1.0 (no-op) if
    the guide is missing/empty.
    """
    if guide_np is None or len(guide_np) == 0:
        return 1.0
    return float(palm_scale(guide_np).mean())


def normalize_to_guide_scale(landmarks, guide_scale) -> np.ndarray:
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


def extract_features_full_fist(coords) -> np.ndarray:
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


def extract_features_tapping(coords) -> np.ndarray:
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


def calculate_joint_angle(p1, p2, p3) -> float:
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


def compute_finger_angles(coords) -> dict[str, dict[str, float]]:
    """(21, 3) coords(wrist-relative) → 손가락별 관절 각도 dict.

    반환 구조: {"thumb": {"MCP": float, "IP": float}, "index": {"MCP": float, ...}, ...}.
    각 값은 0~180도이며, 180°에 가까울수록 곧게 펴진 상태를 의미한다.
    """
    # 이 구조로 반환되는지 확인하세요
    return {
        finger: {
            joint_name: calculate_joint_angle(coords[a], coords[b], coords[c])
            for joint_name, (a, b, c) in joints.items()
        }
        for finger, joints in _FINGER_JOINT_INDICES.items()
    }


def mirror_guide_to_right_hand(guide_np) -> np.ndarray | None:
    """왼손 기준 가이드 (N, 21, 3)을 오른손용으로 좌우 반전.

    손목 기준 상대좌표에서 x축만 부호 반전하면 거울 대칭이 된다.
    y, z축은 그대로 유지.
    """
    if guide_np is None:
        return None
    mirrored = guide_np.copy()
    mirrored[..., 0] *= -1
    return mirrored


def compute_palm_normal(coords) -> np.ndarray | None:
    """(21,3) wrist-relative coords → 손바닥 평면의 단위 법선 벡터 (3,).

    손목(0), 검지MCP(5), 새끼MCP(17) 세 점으로 평면을 정의하고
    두 모서리 벡터(0→5, 0→17)의 외적(cross product)으로 법선을 구한다.
    외적 크기가 0에 가까우면(세 점이 거의 일직선 — 측면에서 봐서 손이
    찌그러져 보이는 경우 등) None을 반환해 호출부에서 판정을 건너뛰게 한다.

    좌표계 주의: 가이드(hand="right"일 때 미러된 current_guide_raw)와
    환자(원본 wrist-relative 좌표, 미러하지 않음)를 "같은 손 기준"으로
    동일하게 처리해야 사이각이 의미를 가진다 — 호출부(hand_tracking.py)에서
    환자는 항상 원본 좌표, 가이드는 이미 hand에 맞게 처리된 좌표를 쓴다.
    """
    coords = np.asarray(coords, dtype=np.float32)
    v1 = coords[5] - coords[0]
    v2 = coords[17] - coords[0]
    n = np.cross(v1, v2)
    norm = float(np.linalg.norm(n))
    if norm < 1e-6:
        return None
    return n / norm


def compute_guide_palm_normal(guide_np) -> np.ndarray | None:
    """가이드 (N,21,3) 전체 프레임의 손바닥 법선을 평균해 단위벡터로 반환.

    프레임마다 법선이 들쭉날쭉(특히 주먹을 쥐는 구간 등)할 때 특정 프레임
    하나만 보고 비교하면 오판하기 쉬워서, 전체 프레임의 법선을 모아 평균낸
    뒤 정규화한 "대표 방향"을 한 번만 계산해 세션 내내 고정값으로 쓴다.
    각 프레임의 compute_palm_normal 결과 중 유효한(None이 아닌) 것만 모아
    평균하며, 유효한 법선이 하나도 없으면 None을 반환한다.
    """
    if guide_np is None or len(guide_np) == 0:
        return None
    normals = [compute_palm_normal(frame) for frame in guide_np]
    normals = [n for n in normals if n is not None]
    if not normals:
        return None
    mean_normal = np.mean(np.stack(normals, axis=0), axis=0)
    norm = float(np.linalg.norm(mean_normal))
    if norm < 1e-6:
        return None
    return mean_normal / norm


def angle_between_vectors(a, b) -> float | None:
    """두 단위 벡터 사이각(0~180도). a 또는 b가 None이면 None."""
    if a is None or b is None:
        return None
    a = np.asarray(a, dtype=np.float32)
    b = np.asarray(b, dtype=np.float32)
    cos_theta = np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b))
    return float(np.degrees(np.arccos(np.clip(cos_theta, -1.0, 1.0))))


def palm_normal_delta(patient_normal, guide_normal) -> tuple[float, float, float] | None:
    """두 단위 법선의 차이를 환자-가이드 로 분해해 (dx, dy, dz) 반환.

    둘 중 하나가 None이면 None. 추가 변환/정규화 없이 patient_normal -
    guide_normal의 각 성분을 그대로 돌려준다 — 축-방향 매핑을 실측으로
    확정하기 전의 검증용 raw 값이다.
    """
    if patient_normal is None or guide_normal is None:
        return None
    patient_normal = np.asarray(patient_normal, dtype=np.float32)
    guide_normal = np.asarray(guide_normal, dtype=np.float32)
    dx, dy, dz = patient_normal - guide_normal
    return (float(dx), float(dy), float(dz))