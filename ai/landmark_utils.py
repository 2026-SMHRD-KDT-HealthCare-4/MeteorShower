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
