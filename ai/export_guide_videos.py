"""
export_guide_videos.py
가이드(JSON 랜드마크)를 hover 미리보기용 mp4로 렌더링한다.

핵심: 드로잉을 새로 짜지 않고 hand_tracking.py 의 draw_animated_guide 를 그대로
재사용한다. 그래야 세션에서 보는 가이드와 미리보기 영상이 완전히 동일하다.

실행:
    (venv 켠 상태에서, hand_tracking.py 와 같은 폴더에 두고)
    pip install imageio imageio-ffmpeg numpy opencv-python
    python export_guide_videos.py

결과물:
    ../frontend/public/videos/tapping_left.mp4  (등 4개)

────────────────────────────────────────────────────────────
[ 작업 전 반드시 확인할 것 — 4곳 ]
1) GUIDES 의 json 파일명 (특히 grip 가이드 파일명이 full_fist.json 이 맞는지)
2) FRAME_W / FRAME_H 를 라이브 세션과 동일하게. draw_animated_guide 가 이 크기
   기준으로 좌표를 픽셀에 투영하므로, 크기가 다르면 가이드가 어긋난다.
3) FPS 를 원본 캡처 fps 와 맞추기 (모르면 20~30 사이에서 자연스러운 값으로)
4) draw_animated_guide 의 실제 시그니처. 아래 호출부 한 줄만 맞추면 된다.

[ import 관련 주의 ]
hand_tracking.py 가 import 시점에 카메라/MediaPipe 를 켜거나 무거운 초기화를 한다면,
그 코드를 `if __name__ == "__main__":` 아래로 내려서 import 부작용을 없애야 한다.

[ 태핑 시작 정지구간 트림 ]
tapping.json 은 앞부분에 손이 거의 안 움직이는 정지 구간이 있다. find_motion_start()
가 인접 프레임 간 좌표 변화량을 보고 '실질적 움직임이 시작되는 인덱스'를 자동으로
찾아 그 지점부터 렌더한다(자동 판정 결과는 실행 시 콘솔에 출력됨). 자동 판정이
실패하면 TAPPING_START_TRIM 상수(프레임 수, None이면 트림 없음)를 대신 쓴다.
grip 은 편손→주먹→편손 왕복본이라 앞을 자르면 loop 연결이 깨지므로 트림하지 않는다.

[ 세로 위치 보정 ]
draw_animated_guide 는 라이브 세션 프레임 기준(cy = h//2 + 225)으로 손을 그리는데,
이 오프셋이 라이브 세션의 카메라 구도에 맞춰져 있어 640x480 export 캔버스에서는
가이드가 하단으로 쏠려 보인다(실측: grip 약 124px, tapping 약 57px 아래로 쏠림).
draw_animated_guide 내부는 건드리지 않고, 렌더된 프레임 픽셀에서 가이드가 그려진
y범위를 직접 측정(배경과의 차이로 감지)한다. 시프트는 '가이드로 인식된 픽셀만'
옮기고, 배경은 항상 build_gradient_bg 로 만든 완전한 그라데이션(0~H 연속)을
그대로 유지한다 — 프레임 전체를 통째로 시프트하면 이동된 그라데이션과 원본
그라데이션이 만나는 자리에 가로 이음매가 생기므로 그 방식은 쓰지 않는다.
────────────────────────────────────────────────────────────
"""

import json
import os
import numpy as np
import cv2
import imageio.v2 as imageio

# ── hand_tracking 에서 실제 드로잉 함수 가져오기 ──────────────────
try:
    from hand_tracking import draw_animated_guide
except Exception as e:
    raise SystemExit(
        f"[에러] hand_tracking.draw_animated_guide import 실패: {e}\n"
        f"  - 이 파일을 hand_tracking.py 와 같은 폴더에 두었는지\n"
        f"  - hand_tracking.py 가 import 시점에 카메라/MediaPipe 를 켜지 않는지 확인."
    )

# ── 설정 ────────────────────────────────────────────────────────
FRAME_W, FRAME_H = 640, 480          # [확인2] 라이브 세션과 동일 (hand_tracking.py 캡처 해상도와 일치 확인됨)
FPS = 30                              # [확인3] hand_tracking.py 의 GUIDE_FPS(30.0)와 동일하게 맞춤

# 배경: 어두운 teal 그라데이션 (홀로그램이 빛나 보이게).
# 빛나는 가이드는 어두운 배경에서 가장 잘 읽힌다. UI 의 teal 톤과도 결이 맞음.
BG_TOP_RGB = (14, 42, 48)            # 위쪽(살짝 밝은 deep teal)
BG_BOTTOM_RGB = (6, 20, 24)         # 아래쪽(거의 검정에 가까운 teal)

OUTPUT_DIR = os.path.join("..", "frontend", "public", "videos")
GUIDE_DATA_DIR = "guide_data"         # [확인1] json 은 ai/ 바로 밑이 아니라 guide_data/ 하위에 있음

# 태핑 시작 정지구간 자동 판정이 실패(애매)할 때만 쓰이는 수동 폴백(프레임 수).
# None 이면 자동 판정 실패 시 트림 없이 처음부터 렌더한다.
TAPPING_START_TRIM = None

# [확인1] 운동 → JSON → 좌우 매핑
GUIDES = [
    {"name": "tapping_left",  "json": "tapping.json",   "mirror": False, "is_tapping": True},
    {"name": "tapping_right", "json": "tapping.json",   "mirror": True,  "is_tapping": True},
    {"name": "grip_left",     "json": "full_fist.json", "mirror": False, "is_tapping": False},
    {"name": "grip_right",    "json": "full_fist.json", "mirror": True,  "is_tapping": False},
]
# ────────────────────────────────────────────────────────────────


def build_gradient_bg(w, h, top_rgb, bottom_rgb):
    """세로 그라데이션 배경(BGR) 생성."""
    top = np.array(top_rgb[::-1], dtype=np.float32)      # RGB→BGR
    bottom = np.array(bottom_rgb[::-1], dtype=np.float32)
    t = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]  # (h,1)
    col = top[None, :] * (1 - t) + bottom[None, :] * t       # (h,3)
    bg = np.repeat(col[:, None, :], w, axis=1)               # (h,w,3)
    return bg.astype(np.uint8)


def load_guide(json_path, mirror):
    """JSON → (N,21,3) float32. mirror=True 면 오른손용 x축 반전."""
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    guide = np.asarray(data, dtype=np.float32)   # (N,21,3) 기대
    if guide.ndim != 3 or guide.shape[1:] != (21, 3):
        raise ValueError(f"{json_path}: shape {guide.shape}, (N,21,3) 가 아님")
    if mirror:
        # 손목(0번)이 원점인 상대좌표이므로 x 부호만 뒤집으면 좌우 반전.
        # 만약 앱의 mirror_guide_to_right_hand() 가 이와 다르게 동작하면,
        # 그 함수를 import 해서 쓰는 편이 in-app 가이드와 정확히 일치한다.
        guide = guide.copy()
        guide[..., 0] *= -1.0
    return guide


def find_motion_start(guide_np, fps=FPS, smooth_win=5, rel_threshold=0.7,
                       sustain_frames=10, max_search_sec=5.0):
    """guide_np(N,21,3)에서 '실질적 움직임이 시작되는' 프레임 인덱스를 찾는다.

    인접 프레임 간 좌표 변화량(delta)을 smooth_win 프레임 이동평균으로 스무딩한 뒤,
    전체 시퀀스 중앙값의 rel_threshold 배를 sustain_frames 프레임 연속으로 넘는
    첫 지점을 '정지구간이 끝나고 실질적 움직임이 시작되는 인덱스'로 판정한다.
    (max_search_sec 안에서) 그런 지점을 못 찾으면 None을 반환한다(자동 판정 실패).
    """
    n = guide_np.shape[0]
    if n < smooth_win + sustain_frames:
        return None
    flat = guide_np.reshape(n, -1)
    deltas = np.linalg.norm(flat[1:] - flat[:-1], axis=1)
    kernel = np.ones(smooth_win, dtype=np.float32) / smooth_win
    smoothed = np.convolve(deltas, kernel, mode="valid")  # len = len(deltas)-smooth_win+1
    threshold = float(np.median(smoothed)) * rel_threshold

    max_search = min(len(smoothed), int(max_search_sec * fps))
    run = 0
    for i in range(max_search):
        if smoothed[i] > threshold:
            run += 1
            if run >= sustain_frames:
                start = i - sustain_frames + 1
                return max(0, start)
        else:
            run = 0
    return None


def get_tapping_start_idx(guide_np, label):
    """find_motion_start() 자동 판정을 우선 쓰고, 실패하면 TAPPING_START_TRIM 폴백을 쓴다."""
    auto_idx = find_motion_start(guide_np)
    if auto_idx is not None and auto_idx > 0:
        print(f"    [{label}] 시작 정지구간 자동 판정: {auto_idx}프레임 스킵 ({auto_idx / FPS:.2f}초)")
        return min(auto_idx, guide_np.shape[0] - 1)
    if TAPPING_START_TRIM is not None:
        print(f"    [{label}] 자동 판정 실패 → TAPPING_START_TRIM={TAPPING_START_TRIM}프레임 사용")
        return min(TAPPING_START_TRIM, guide_np.shape[0] - 1)
    print(f"    [{label}] 자동 판정 실패, TAPPING_START_TRIM 미설정 → 트림 없음")
    return 0


def render_guide(guide_np, base_bg, start_idx=0):
    """guide_np[start_idx:] 프레임을 RGB 프레임 리스트로 렌더 (원본 순서 유지, 트림만 적용)."""
    n = guide_np.shape[0]
    frames = []
    for i in range(start_idx, n):
        bg = base_bg.copy()
        # [확인4] 실제 시그니처에 맞춰 이 한 줄만 조정.
        out = draw_animated_guide(bg, i, guide_np)
        frame_bgr = out if out is not None else bg   # in-place/return 양쪽 대응
        frames.append(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB))
    return frames


def compute_guide_bbox_y(frames_rgb, base_bg_rgb, diff_threshold=5):
    """렌더된 프레임들에서 base_bg와 다른(=가이드가 그려진) 행의 y범위를 측정.

    draw_animated_guide 내부 좌표식을 들여다보지 않고, 실제로 그려진 픽셀만 보고
    측정하므로 draw_animated_guide 가 바뀌어도 항상 정확하다. 못 찾으면 (None, None).
    """
    min_y, max_y = None, None
    for f in frames_rgb:
        diff = np.abs(f.astype(np.int16) - base_bg_rgb.astype(np.int16)).sum(axis=2)  # (h,w)
        rows = np.where(diff.max(axis=1) > diff_threshold)[0]
        if rows.size == 0:
            continue
        y0, y1 = int(rows.min()), int(rows.max())
        min_y = y0 if min_y is None else min(min_y, y0)
        max_y = y1 if max_y is None else max(max_y, y1)
    return min_y, max_y


def shift_guide_only(frame_rgb, base_bg_rgb, shift, diff_threshold=5):
    """배경은 항상 완전한 그라데이션으로 유지하고, '가이드로 그려진 픽셀만' 세로로
    shift px 이동시켜 합성한다(+면 아래로, -면 위로). shift=0이면 그대로 반환.

    배경(base_bg_rgb)과 다른 픽셀(diff_threshold 초과)만 가이드로 간주해 그 픽셀만
    옮기므로, 배경 자체에는 빈 영역/이음매가 절대 생기지 않는다(0~H 연속 유지).
    """
    if shift == 0:
        return frame_rgb
    h = base_bg_rgb.shape[0]
    diff = np.abs(frame_rgb.astype(np.int16) - base_bg_rgb.astype(np.int16)).sum(axis=2)
    mask = diff > diff_threshold  # (h, w) — 가이드(+bloom)가 그려진 픽셀

    shifted_mask = np.zeros_like(mask)
    shifted_pixels = np.zeros_like(frame_rgb)
    if shift > 0:
        if shift < h:
            shifted_mask[shift:, :] = mask[: h - shift, :]
            shifted_pixels[shift:, :] = frame_rgb[: h - shift, :]
    else:
        s = -shift
        if s < h:
            shifted_mask[: h - s, :] = mask[s:, :]
            shifted_pixels[: h - s, :] = frame_rgb[s:, :]

    canvas = base_bg_rgb.copy()  # 항상 0~H 연속인 완전한 그라데이션
    canvas[shifted_mask] = shifted_pixels[shifted_mask]
    return canvas


def recenter_vertically(frames_rgb, base_bg_rgb, label):
    """frames_rgb에 그려진 가이드의 y bbox를 측정해 세로 중앙으로 오도록,
    가이드 픽셀만 이동시킨다(배경 그라데이션은 항상 그대로 유지)."""
    min_y, max_y = compute_guide_bbox_y(frames_rgb, base_bg_rgb)
    if min_y is None:
        print(f"    [{label}] 가이드 픽셀을 찾지 못해 세로 보정 건너뜀")
        return frames_rgb
    h = base_bg_rgb.shape[0]
    center = (min_y + max_y) / 2.0
    shift = int(round(h / 2.0 - center))
    print(
        f"    [{label}] 가이드 y범위: {min_y}~{max_y} (중앙 {center:.1f}) "
        f"→ 가이드만 세로 {shift:+d}px 이동 (배경은 그대로, 프레임 중앙 {h / 2:.1f})"
    )
    return [shift_guide_only(f, base_bg_rgb, shift) for f in frames_rgb]


def write_mp4(frames_rgb, out_path, fps):
    """브라우저 자동재생이 확실히 되도록 H.264 + yuv420p + faststart."""
    writer = imageio.get_writer(
        out_path, fps=fps, codec="libx264", quality=8,
        macro_block_size=None,
        ffmpeg_params=["-pix_fmt", "yuv420p", "-movflags", "+faststart"],
    )
    for f in frames_rgb:
        writer.append_data(f)
    writer.close()


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    base_bg = build_gradient_bg(FRAME_W, FRAME_H, BG_TOP_RGB, BG_BOTTOM_RGB)
    base_bg_rgb = cv2.cvtColor(base_bg, cv2.COLOR_BGR2RGB)

    for g in GUIDES:
        json_path = os.path.join(GUIDE_DATA_DIR, g["json"])
        if not os.path.exists(json_path):
            print(f"  ! 건너뜀: {json_path} 없음 ({g['name']})")
            continue
        print(f"  → {g['name']} 렌더 중 ({json_path}, mirror={g['mirror']})")
        guide = load_guide(json_path, g["mirror"])

        start_idx = get_tapping_start_idx(guide, g["name"]) if g["is_tapping"] else 0

        frames = render_guide(guide, base_bg, start_idx)
        frames = recenter_vertically(frames, base_bg_rgb, g["name"])

        out = os.path.join(OUTPUT_DIR, f"{g['name']}.mp4")
        write_mp4(frames, out, FPS)
        print(f"    완료: {out}  ({len(frames)} frames @ {FPS}fps)")

    print("끝. frontend/public/videos/ 확인.")


if __name__ == "__main__":
    main()
