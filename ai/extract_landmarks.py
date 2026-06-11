import json
import os
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "hand_landmarker.task")
VIDEO_PATH = os.path.join(BASE_DIR, "guide_videos", "full_fist.mp4")
OUTPUT_PATH = os.path.join(BASE_DIR, "guide_data", "full_fist.json")

MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task"
)

if not os.path.exists(MODEL_PATH):
    print("hand_landmarker.task 모델 다운로드 중...")
    urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    print("완료")

if not os.path.exists(VIDEO_PATH):
    raise FileNotFoundError(f"영상 파일을 찾을 수 없습니다: {VIDEO_PATH}")

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)

options = vision.HandLandmarkerOptions(
    base_options=python.BaseOptions(model_asset_path=MODEL_PATH),
    running_mode=vision.RunningMode.VIDEO,
    num_hands=1,
    min_hand_detection_confidence=0.5,
    min_hand_presence_confidence=0.5,
    min_tracking_confidence=0.5,
)

frames_data = []
skipped = 0

with vision.HandLandmarker.create_from_options(options) as landmarker:
    cap = cv2.VideoCapture(VIDEO_PATH)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_idx = 0

    print(f"처리 중: {VIDEO_PATH}  ({total}프레임, {fps:.1f}fps)")

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        timestamp_ms = int(frame_idx * 1000 / fps)
        frame_idx += 1

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = landmarker.detect_for_video(mp_image, timestamp_ms)

        # 손 미검출 또는 신뢰도 0.5 미만 프레임 스킵
        if not result.hand_landmarks or not result.handedness:
            skipped += 1
            continue

        landmarks = result.hand_landmarks[0]
        confidence = result.handedness[0][0].score
        if confidence < 0.5:
            skipped += 1
            continue

        # 손목(0번) 기준 상대 좌표로 정규화
        wrist = landmarks[0]
        frame_coords = [
            [round(lm.x - wrist.x, 6),
             round(lm.y - wrist.y, 6),
             round(lm.z - wrist.z, 6)]
            for lm in landmarks
        ]
        frames_data.append(frame_coords)

    cap.release()

with open(OUTPUT_PATH, "w") as f:
    json.dump(frames_data, f)

print(f"저장 완료: {len(frames_data)}프레임 저장, {skipped}프레임 스킵")
print(f"출력 파일: {OUTPUT_PATH}")
