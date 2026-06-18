# 피네(Fine)

> 실시간 Vision AI 기반 지능형 재활 운동 코칭 서비스

## 프로젝트 개요

피네(Fine)는 수술·부상 후 재활이 필요한 고령 환자가 자택에서 손 재활 운동을 수행할 때,
MediaPipe Hands와 OpenCV를 활용한 실시간 동작 감지로 치료사 수준의 코칭을 제공하는 시스템입니다.
의사가 처방한 기준값을 기반으로 자동 난이도를 조절하고, LLM 임상 요약 리포트를 생성하여
의료진 검증 후 환자·보호자에게 전송합니다.

### 주요 기능

| 기능 | 설명 |
|------|------|
| 실시간 손 추적 | MediaPipe Hands로 21개 랜드마크 실시간 감지 |
| 가이드 애니메이션 | 치료사 기준 동작을 뼈대로 화면에 재생 |
| 동작 일치율 | DTW 알고리즘으로 환자 동작 vs 가이드 비교 (0~100%) |
| 신호등 피드백 | 일치율에 따라 초록 / 노랑 / 빨강 신호로 즉시 표시 |
| 자동 카운팅 | OPEN→GRIP→OPEN 사이클 자동 인식 및 세트 관리 |
| 과부하 감지 | ROM 초과 시 경고 및 세션 자동 종료 |
| 다중 운동 | 의사 처방 순서대로 운동 진행, 완료 시 다음 운동으로 자동 전환 |
| 자동 난이도 조절 | 누적 운동 데이터 기반으로 의사 처방 범위 내에 난이도 맞춤 최적화 |
| LLM 리포트 1 | 세션 결과 자동 분석 후 일일 LLM 리포트를 의료진에게 발송 -> 의료진 검증 -> 환자·보호자 전송 |
| LLM 리포트 2 | 수술 시작 날짜로부터 7일간의 누적 데이터를 가지고 수치 그래프로 시각화 후 주간 리포트 생성 -> 의료진 검증 -> 환자·보호자 전송 |
| 재활 중단 감지 | 3일 이상 미접속 시 주치의·보호자 개입 요청 알림 |
| WebSocket 전송 | 분석 결과를 실시간으로 프론트엔드에 브로드캐스트 |

---

## 프로젝트 구조

```
Fine/
├── main.py                         # 엔트리포인트 (예정)
├── ai/                             # Vision AI 모듈
│   ├── hand_tracking.py            # 핵심 파이프라인 (MediaPipe · DTW · ROM · 카운팅 · 과부하)
│   ├── landmark_utils.py           # 좌표 정규화 · 특징 추출 · 손가락 각도 계산 공용 함수
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
├── backend/                        # 백엔드 서버 (기초 골격 구현 중)
│   ├── app/
│   │   ├── main.py                 # FastAPI 앱 진입점
│   │   └── routers/
│   │       ├── health.py           # 헬스체크 · DB 연결 체크
│   │       └── ws.py               # WebSocket 엔드포인트 (현재 echo 더미 구현)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── docker-compose.yml          # FastAPI + PostgreSQL 컨테이너 구성
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
| FastAPI | - | WebSocket 서버 · REST API |
| Uvicorn | - | ASGI 서버 (port 8000) |
| WebSocket | - | AI 분석 결과 실시간 브로드캐스트 |
| SQLAlchemy | - | PostgreSQL ORM / 연결 관리 |
| asyncpg / psycopg2 | - | PostgreSQL 드라이버 |
| Docker / docker-compose | - | 백엔드 + DB 컨테이너 구성 |

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
| PostgreSQL | 환자 정보 · 운동 처방 · 세션 기록 저장 (연결 골격만 구현, 스키마/데이터 연동 예정) |

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

### 5. 백엔드(DB) 서버 실행 (선택, 기초 골격 단계)

`backend/`는 인증·환자 정보·운동 처방 등을 다룰 DB 연동 서버의 골격입니다.
아직 AI WebSocket 서버(`ai/websocket_server.py`)와는 연결되어 있지 않습니다.

```bash
cd backend
# DB_USER, DB_PASSWORD, DB_NAME, DATABASE_URL 등을 담은 .env 파일 생성 후
docker-compose up --build
# → http://localhost:8000/health 로 동작 확인
```

> `.env` 파일은 저장소에 포함되어 있지 않으므로 직접 생성해야 합니다.

---

### WebSocket 메시지 형식

AI 서버가 프론트엔드로 전송하는 JSON 구조입니다.

```json
{
  "landmarks":     [[x, y, z], ...],
  "count":         5,
  "state":         "OPEN",
  "similarity":    78.3,
  "signal":        "green",
  "overload":      false,
  "session_end":   false,
  "exercise":      "full_fist",
  "set":           2,
  "total_sets":    3,
  "rom_score":     82.4,
  "joint_signals": { "0": "green", "4": "green", "8": "yellow", "...": "..." },
  "finger_angles": { "thumb": 118.2, "index": 62.5, "middle": 58.9, "ring": 71.3, "pinky": 65.0 }
}
```

| 필드 | 설명 |
|------|------|
| `similarity` | DTW 패턴 점수와 `rom_score`의 가중 평균(각 50%)으로 산출된 최종 일치율 |
| `rom_score` | 손가락 굴곡 각도가 목표 각도에 얼마나 도달했는지를 나타내는 0~100 점수 |
| `joint_signals` | 21개 손 랜드마크 인덱스(`"0"`~`"20"`, 문자열)별 신호등 색상. 손이 미검출 상태거나 그립/탭이 확정되지 않은 동안은 `null` |
| `finger_angles` | 손가락별(`thumb`/`index`/`middle`/`ring`/`pinky`) 굴곡 각도(도). 손 미검출 시 `null` |
