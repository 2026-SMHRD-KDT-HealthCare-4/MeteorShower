"""가이드 홀로그램(파란 손) 렌더링 전담 모듈.

hand_tracking.py의 트래킹/DTW/ROM/신호등 로직과 분리해서, 가이드 비주얼(색·레이어
순서·밝기 보정)만 이 파일에서 따로 튜닝할 수 있게 한다.
"""
import cv2
import numpy as np

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]

# ── 가이드 홀로그램 렌더링 레이어 순서(뒤→앞) ──
# 2D 투영이라 겹침 순서는 "그리는 순서"로만 결정됨. 엄지는 항상 맨 위(앞)로,
# 손목-검지MCP 뼈(0,5)는 항상 맨 아래(뒤)로 그려서 자연스러운 앞뒤 관계를 만든다.
THUMB_CONNECTIONS = [(0, 1), (1, 2), (2, 3), (3, 4)]
BACK_CONNECTIONS = [(0, 5)]
MIDDLE_CONNECTIONS = [
    c for c in HAND_CONNECTIONS
    if c not in THUMB_CONNECTIONS and c not in BACK_CONNECTIONS
]

GUIDE_SCALE = 900  # 손목기준 좌표 → 화면 픽셀 변환 스케일

# 가이드 홀로그램 밝기 적응 — 배경이 밝을수록(b↑) 불투명도/채도를 높여 묻히지 않게 한다.
# BASE/MIN을 함께 올려서 어두운 배경에서도 전체적으로 더 밝고 진한 홀로그램이 되게 한다.
HOLOGRAM_ALPHA_BASE             = 0.85
HOLOGRAM_ALPHA_BRIGHTNESS_GAIN  = 0.85
HOLOGRAM_ALPHA_MIN              = 0.85
HOLOGRAM_ALPHA_MAX              = 1.60
HOLOGRAM_SAT_BASE               = 1.00
HOLOGRAM_SAT_BRIGHTNESS_GAIN    = 1.20
HOLOGRAM_SAT_MIN                = 1.00
HOLOGRAM_SAT_MAX                = 2.20
HOLOGRAM_VAL_BASE               = 1.40
HOLOGRAM_VAL_BRIGHTNESS_GAIN    = -0.25  # 배경 밝을수록 명도를 살짝 낮춰 대비는 유지하되, 전반적으로는 항상 원본보다 밝게
HOLOGRAM_VAL_MIN                = 1.00
HOLOGRAM_VAL_MAX                = 1.40


def draw_animated_guide(frame, guide_frame_idx, guide_np):
    if guide_np is None: return

    h, w = frame.shape[:2]
    cx, cy = w // 2, h // 2 + 225
    gf = guide_np[guide_frame_idx % len(guide_np)]

    # 2D 투영 좌표 계산
    pts = [(int(cx + rel[0] * GUIDE_SCALE), int(cy + rel[1] * GUIDE_SCALE)) for rel in gf]

    # 1. 홀로그램을 그릴 빈 검은색 캔버스 생성
    overlay = np.zeros_like(frame, dtype=np.uint8)

    # 2. 손바닥 면 채우기 (진하고 채도 높은 딥 블루) — 가장 뒤 레이어
    # 새끼 PIP(18)을 포함시켜 새끼MCP(17)→손목(0) 측면(소지구)이 hull 가장자리에
    # 걸리도록 넓힌다. 그래도 오목한 측면 살은 hull로는 안 펴지므로, 명시적 폴리곤
    # [0, 17, 18]을 추가로 채워 소지구 살을 확실히 보강한다.
    palm_indices = [0, 1, 2, 5, 9, 13, 17, 18]
    palm_pts = np.array([pts[i] for i in palm_indices], np.int32)
    # 배경에 묻히지 않도록 B=255, G=80, R=10 으로 설정
    cv2.fillPoly(overlay, [cv2.convexHull(palm_pts)], (255, 150, 10))
    pinky_side_pts = np.array([pts[0], pts[17], pts[18]], np.int32)
    cv2.fillPoly(overlay, [pinky_side_pts], (255, 150, 10))

    # 3. 손가락 '살' 및 관절 노드 — 뒤→앞 3개 레이어로 분리해서 그림.
    # 2D 투영이라 겹침 순서는 그리는 순서로만 결정되므로, 순서만으로 앞뒤를 만든다.
    # 레이어 A(가장 뒤): 손목-검지MCP 뼈(0,5) — 위로 지나가는 손가락이 항상 이 뼈를 덮게 함
    # 레이어 B(중간): 엄지/뒤 뼈를 제외한 나머지 손가락 전부
    # 레이어 C(가장 앞): 엄지 — 겹쳐도 항상 위로 보이게, (3,4)를 맨 마지막에 그림
    for s_idx, e_idx in BACK_CONNECTIONS + MIDDLE_CONNECTIONS + THUMB_CONNECTIONS:
        # 손가락 뼈대 (선명한 형광 스카이블루)
        cv2.line(overlay, pts[s_idx], pts[e_idx], (255, 40, 0), thickness=20)
        # 관절 코어 (완전한 흰색으로 뚫어줘서 대비를 극대화)
        cv2.circle(overlay, pts[e_idx], 12, (255, 210, 0), -1)

    # 4. 빛 번짐(Bloom) 효과
    # 블러 반경을 (21, 21)로 줄여서 빛이 퍼지지 않고 밀도 있게 뭉치게 함
    glow = cv2.GaussianBlur(overlay, (19, 19), 0)

    # 코어(overlay)의 비중을 0.9로 높여서 흐리멍덩해지는 것을 방지
    hologram = cv2.addWeighted(overlay, 1.5, glow, 0.1, 0)

    # 5. 주변 밝기에 따른 채도·불투명도·명도 자동 조절
    # 홀로그램이 그려질 영역(손 bounding box)의 밝기를 측정해, 배경이 밝을수록
    # 더 또렷하게(채도↑, 불투명도↑) 보이도록 보정한다. 딥블루 톤/glow 미감은 그대로 유지.
    xs = [p[0] for p in pts]
    ys = [p[1] for p in pts]
    x0, x1 = max(0, min(xs)), min(w, max(xs))
    y0, y1 = max(0, min(ys)), min(h, max(ys))
    if x1 > x0 and y1 > y0:
        region = frame[y0:y1, x0:x1]
    else:
        region = frame
    brightness = float(cv2.cvtColor(region, cv2.COLOR_BGR2GRAY).mean()) / 255.0

    alpha = min(HOLOGRAM_ALPHA_MAX, max(HOLOGRAM_ALPHA_MIN,
        HOLOGRAM_ALPHA_BASE + HOLOGRAM_ALPHA_BRIGHTNESS_GAIN * brightness))
    sat_scale = min(HOLOGRAM_SAT_MAX, max(HOLOGRAM_SAT_MIN,
        HOLOGRAM_SAT_BASE + HOLOGRAM_SAT_BRIGHTNESS_GAIN * brightness))
    # 배경이 밝을수록 명도(V)를 살짝 낮춰 대비를 만들되, BASE/MIN을 1.0 이상으로 둬서
    # 항상 원본보다 밝고 진한 톤을 유지한다.
    val_scale = min(HOLOGRAM_VAL_MAX, max(HOLOGRAM_VAL_MIN,
        HOLOGRAM_VAL_BASE + HOLOGRAM_VAL_BRIGHTNESS_GAIN * brightness))

    hsv = cv2.cvtColor(hologram, cv2.COLOR_BGR2HSV).astype(np.float32)
    hsv[..., 1] = np.clip(hsv[..., 1] * sat_scale, 0, 255)
    hsv[..., 2] = np.clip(hsv[..., 2] * val_scale, 0, 255)
    hologram = cv2.cvtColor(hsv.astype(np.uint8), cv2.COLOR_HSV2BGR)

    # 6. 최종 합성 ★★★ (가장 중요한 부분)
    # 홀로그램의 투명도를 밝기 적응형 alpha로 적용해 사실상 불투명한 3D 오브젝트처럼 보이게 만듦
    cv2.addWeighted(hologram, alpha, frame, 1.0, 0, frame)
