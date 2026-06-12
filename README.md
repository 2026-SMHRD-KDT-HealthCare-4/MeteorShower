# Fine (피네)

> 실시간 Vision AI 기반 지능형 재활 운동 코칭 서비스

## 프로젝트 개요

Fine은 웹캠과 AI를 활용해 재활 환자가 집에서 혼자 운동할 때도
치료사 수준의 피드백을 받을 수 있는 코칭 시스템입니다.

### 주요 기능

| 기능 | 설명 |
|------|------|
| 실시간 손 추적 | MediaPipe Hands로 21개 랜드마크 실시간 감지 |
| 가이드 애니메이션 | 치료사 기준 동작을 뼈대로 화면에 재생 |
| 동작 일치율 | DTW 알고리즘으로 환자 동작 vs 가이드 비교 (0~100%) |
| 신호등 피드백 | 일치율에 따라 초록 / 노랑 / 빨강 신호로 즉시 표시 |
| 자동 카운팅 | OPEN→GRIP→OPEN 사이클 자동 인식 및 세트 관리 |
| 과부하 감지 | ROM 초과 시 경고 및 세션 자동 종료 |
| 다중 운동 | 운동 목록을 순서대로 진행, 완료 시 자동 전환 |
| WebSocket 전송 | 분석 결과를 실시간으로 프론트엔드에 브로드캐스트 |
| 환자/의사 포털 | 오늘의 운동 처방, 진도 리포트, 주간 보고서 |

---

## 프로젝트 구조

```
Fine/
├── main.py                         # 엔트리포인트 (예정)
├── ai/                             # Vision AI 모듈
│   ├── hand_tracking.py            # 핵심 파이프라인 (MediaPipe · DTW · 카운팅 · 과부하)
│   ├── websocket_server.py         # FastAPI WebSocket 서버 (port 8000)
│   ├── extract_landmarks.py        # 가이드 영상 → JSON 랜드마크 추출 도구
│   ├── hand_landmarker.task        # MediaPipe 모델 파일 (최초 실행 시 자동 다운로드)
│   ├── test_ws.py                  # WebSocket 연결 테스트 스크립트
│   ├── guide_videos/               # 치료사 기준 동작 영상
│   │   ├── full_fist.mp4
│   │   └── tapping.mp4
│   ├── guide_data/                 # 추출된 랜드마크 시퀀스 (N, 21, 3) — wrist 기준 정규화
│   │   ├── full_fist.json
│   │   └── tapping.json
│   └── captures/                   # 과부하 감지 시 자동 저장되는 캡처 프레임
├── backend/                        # 백엔드 서버 (개발 예정)
└── frontend/
    └── fine-app/                   # React + Vite 프론트엔드
        ├── src/
        │   ├── App.jsx             # 라우팅 설정
        │   ├── components/         # 공통 컴포넌트
        │   └── pages/
        │       ├── LandingPage/    # 서비스 소개 페이지
        │       ├── patient/        # 환자 화면
        │       │   ├── PatientLogin/
        │       │   ├── PatientSignup/
        │       │   ├── TodayExercise/   # 오늘의 운동 (WebSocket 연동)
        │       │   ├── MedicalRecords/  # 운동 기록 조회
        │       │   └── PatientProfile/
        │       └── doctor/         # 의사 화면
        │           ├── DoctorLogin/
        │           ├── DoctorPatientList/
        │           ├── WeeklyReport/    # 주간 운동 보고서
        │           └── ProgressReport/ # 환자 진도 리포트
        └── public/
```

---

## 기술 스택

### AI / Vision
| 항목 | 버전 | 용도 |
|------|------|------|
| Python | 3.12 | 메인 언어 |
| MediaPipe | 0.10.35 | 손 21개 랜드마크 실시간 감지 (`mediapipe.tasks` API) |
| OpenCV | 4.13.0.92 | 웹캠 입력 · 뼈대 렌더링 · 프레임 캡처 |
| NumPy | - | DTW 거리 행렬 계산 |

### 백엔드 / 통신
| 항목 | 버전 | 용도 |
|------|------|------|
| FastAPI | - | WebSocket 서버 |
| Uvicorn | - | ASGI 서버 (port 8000) |
| WebSocket | - | AI 분석 결과 실시간 브로드캐스트 |

### 프론트엔드
| 항목 | 버전 | 용도 |
|------|------|------|
| React | 19 | UI 프레임워크 |
| React Router | 7 | 환자 / 의사 페이지 라우팅 |
| Vite | 8 | 빌드 도구 |
| Tailwind CSS | 3 | 스타일링 |

### 데이터베이스
| 항목 | 용도 |
|------|------|
| PostgreSQL | 환자 정보 · 운동 처방 · 세션 기록 저장 (개발 예정) |

---

## 환경 설정 및 실행 방법

### 사전 요구사항
- Python 3.12
- Node.js 18 이상
- 웹캠

---

### 1. AI 서버 설정

```bash
# 가상환경 생성 및 활성화
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

# 패키지 설치
pip install mediapipe==0.10.35 opencv-python==4.13.0.92 fastapi uvicorn numpy
```

> `hand_landmarker.task` 모델 파일은 최초 실행 시 자동으로 다운로드됩니다.

---

### 2. 가이드 데이터 추출 (최초 1회)

`ai/guide_videos/` 폴더에 기준 동작 영상을 넣은 뒤 실행합니다.  
추출된 JSON은 `ai/guide_data/`에 저장됩니다.

```bash
python ai/extract_landmarks.py
```

---

### 3. AI WebSocket 서버 실행

```bash
python ai/websocket_server.py
# → ws://localhost:8000/ws 에서 대기
```

---

### 4. 프론트엔드 실행

```bash
cd frontend/fine-app
npm install
npm run dev
# → http://localhost:5173
```

---

### WebSocket 메시지 형식

AI 서버가 프론트엔드로 전송하는 JSON 구조입니다.

```json
{
  "landmarks":   [[x, y, z], ...],
  "count":       5,
  "state":       "OPEN",
  "similarity":  78.3,
  "signal":      "green",
  "overload":    false,
  "session_end": false,
  "exercise":    "full_fist",
  "set":         2,
  "total_sets":  3
}
```
