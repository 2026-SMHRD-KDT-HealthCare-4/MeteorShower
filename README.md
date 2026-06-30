# 피네(Fine)

> 실시간 Vision AI 기반 지능형 재활 운동 코칭 서비스

## 프로젝트 개요

피네(Fine)는 수술·부상 후 재활이 필요한 고령 환자가 자택에서 손 재활 운동을 수행할 때,
MediaPipe Hands와 OpenCV를 활용한 실시간 동작 감지로 치료사 수준의 코칭을 제공하는 시스템입니다.
의사가 처방한 기준값을 기반으로 자동 난이도를 조절하고, LLM 임상 요약 리포트를 생성하여
의료진 검증을 마친 후 환자·보호자에게 전송합니다.

### 주요 서비스

피네(Fine)로 할 수 있는 것은 다음과 같습니다.

- 환자가 자택에서 웹캠으로 재활 운동을 하면, AI가 손 동작을 실시간으로 분석해 동작이 가이드와 얼마나 일치하는지 또는 관절별로 어디가 부족한지 화면 표시와 음성 안내로 즉시 알려줍니다.
- 환자의 동작이 처음보다 느려지거나 가동범위가 줄어들면, AI가 판정 기준을 자동으로 완화해 운동을 계속 이어갈 수 있게 합니다.
- 운동 중 무리한 동작(과부하)이 감지되면 AI가 자동으로 운동을 멈춥니다(다만 이 이벤트가 의사에게 알림으로 전달되지는 않습니다 — [알려진 제한사항](#알려진-제한사항) 참고).
- 의사가 회원가입한 환자를 검색해 담당 환자로 등록하고, 수술·재활 정보를 입력 및 관리합니다. 등록 직후 환자는 "대기" 상태이며, 환자 본인이 승인해야 "승인" 상태로 바뀝니다.
- 의사가 환자별로 손가락·관절 단위 목표 가동범위(ROM)와 운동 처방(종류·세트·횟수·요일별 일정)을 설정합니다.
- 매일 운동이 끝나면 AI가 그날 결과를 바탕으로 리포트 초안을 작성하고, 의사가 검토·수정해 승인하면 환자 또는 보호자에게 전달됩니다.
- 의사가 대시보드에서 검토 대기 리포트와 이번 주 처방 현황을 한눈에 확인하고, 환자별로 주차별 누적 달성률 및 일치율을 확인합니다.
- 환자가 운동 전 사전 문진에서 이상을 호소하면 운동이 차단되고, 의사에게 알림이 가며, 환자에게는 주변 병원을 찾아줍니다.
- 환자가 자신의 운동 및 진료 일정을 캘린더로 확인합니다.
- 환자가 운동 중 음성으로 챗봇에게 말을 걸어 재활 관련 질문을 하고 답변을 들을 수 있습니다(Whisper STT + GPT + TTS, 운동 정보 RAG 검색 포함).
- 카카오·구글·네이버 계정으로 간편하게 회원가입·로그인할 수 있습니다(환자만 해당).
- 처방 등록, 운동 차단 같은 주요 이벤트가 생기면 알림함으로 확인할 수 있습니다.

### 주요 기능

시스템은 서로 독립적으로 실행되는 세 프로세스로 구성됩니다 — AI 분석 서버(`ai/websocket_server.py`, 포트 8000), 백엔드 API 서버(`backend/app/main.py`, 포트 8001), 프론트엔드(`frontend/`, 포트 5173). AI 서버와 백엔드는 같은 PostgreSQL DB를 보지만 서로 직접 호출하는 구간은 제한적이며, 자세한 내용은 [알려진 제한사항](#알려진-제한사항)에 정리했습니다.

**공통**

| 기능 | 설명 |
|------|------|
| 회원가입 · 로그인 | 환자/의사 각각 아이디·비밀번호 가입 및 로그인, 아이디 중복 확인 (`auth.py`) |
| 소셜 로그인 | 카카오·구글·네이버 OAuth, 신규 사용자는 추가 정보 입력 후 환자로 가입 (`/auth/social/{provider}`) |
| 알림함 | 헤더의 알림 드롭다운에서 읽음/안읽음 표시와 함께 알림 목록 확인 (`DoctorNavBar.jsx`/`PatientNavBar.jsx`). 실제로 발생하는 알림 타입은 "처방등록"(환자 대상, 리포트 승인·처방 저장 시)과 "운동차단"(의사 대상, 환자가 사전 문진에서 차단됐을 때) 두 가지뿐입니다 |

**환자 화면**

| 기능 | 설명 |
|------|------|
| 계정 승인 | 의사가 담당 환자로 등록하면 `approval_status`가 "대기"로 설정되고, 환자가 직접 승인해야 운동 화면에 접근할 수 있음 (`PatientApproval.jsx`, `PATCH /patients/me/approve`). 미승인 상태면 `ProtectedRoute.jsx`가 다른 페이지 접근을 막고 승인 페이지로 보냄 |
| 오늘의 운동 | 처방받은 운동 목록과 진행 상태 확인 (`GET /patients/me/today-exercises`) |
| 사전 문진 / 운동 차단 | 안전 체크 실패 시 운동을 막고 담당 의사에게 알림 발송 (`POST /patients/me/exercise-blocked`) |
| 병원 찾기 | 운동 차단 시 카카오 로컬 API로 반경 내 병원 검색 (`GET /patients/me/nearby-hospitals`) |
| 실시간 운동 세션 | 웹캠으로 AI 서버에 연결해 동작 코칭을 받음 (`ExerciseSession.jsx`, AI 8000 WebSocket) |
| 진료 기록 · 리포트 조회 | 의사가 승인한 일일 리포트 열람 (`MedicalRecords.jsx`) |
| 프로필 관리 | 연락처 · 보호자 이메일 · 보호자 리포트 수신 동의(`report_consent`) 수정 |
| 음성 챗봇 | Whisper STT → RAG 검색 → GPT-4o-mini 응답 → TTS 음성 합성 (`POST /chat/voice`) |

**의사 화면**

| 기능 | 설명 |
|------|------|
| 환자 목록 · 검색 · 등록 | 담당 환자 관리, 환자 검색 → 선택 → 수술/재활 정보·ROM 입력 순으로 진행하는 등록 화면 (`PatientRegister.jsx`). 등록 직후 환자는 "대기" 상태이며 환자 본인 승인 전까지는 보호자처럼 의사만 관리하는 상태로 남음 |
| 환자 의료정보 · ROM · 처방 설정 | 수술명·부위·재활단계 수정, 손가락·관절 단위 목표 가동범위 설정, 운동·세트·요일별 스케줄 처방 (`PatientInfo.jsx`) |
| 일일 리포트 검토 | LLM 초안 생성 → 수정 → 승인, 승인 시 다음 처방 등록 및 환자 알림 (`DailyReport.jsx`) |
| 누적 진행률 리포트 | 환자별 주차별 달성률·일치율 조회 (`ProgressReport.jsx`) |
| 대시보드 | 리포트 검토 대기 환자, 이번 주 처방 현황 (`GET /doctor/me/dashboard`) |
| 프로필 관리 | 이메일 · 전화번호 수정 (`DoctorProfile.jsx`, `PATCH /auth/doctor/me`) |

**AI 동작 분석 (`ai/hand_tracking.py`)**

| 기능 | 설명 |
|------|------|
| 실시간 손 추적 | MediaPipe `HandLandmarker`(VIDEO 모드, `num_hands=1`, 검출/추적 신뢰도 0.7)로 21개 랜드마크 추출 |
| 동작 판별 | OPEN/GRIP/TAP 상태를 관절 각도가 아닌 손목-손끝 거리 비교로 판별 (`get_hand_state`, `get_tap_state`) |
| 일치율 산출 | 가이드 동작과의 DTW 유사도 + 관절 각도 기반 ROM 점수를 가중합 (NumPy 기반 직접 구현, 외부 DTW 라이브러리 미사용) |
| 신호등 피드백 | 관절별 green/yellow/red 판정, 지속 시 한국어 피드백 문장 생성(`feedback_trigger.py`) → 프론트엔드가 TTS(`/chat/tts`)로 음성 변환 |
| 과부하 감지 | 손목-손끝 평균 거리 또는 카운트가 임계값 초과 시 단계적으로 세션 강제 종료, GIF 캡처 저장 |
| 적응형 난이도 | 초반 동작을 기준으로 느려짐·ROM 저하를 감지해 DTW 허용 오차를 완화 |

일치율은 DTW 기반 유사도(`similarity`)와 ROM 점수(`rom_score`)를 각각 50%씩 가중합한 값입니다(`DTW_WEIGHT = ROM_WEIGHT = 0.5`). 손바닥 법선 벡터로 계산하는 "손 방향 틀어짐" 각도는 이 가중합과 비율로 섞이는 것이 아니라, 30도까지는 영향이 없고 30~90도 구간에서 최종 일치율에 최대 30%까지 곱셈 페널티로 추가 적용됩니다(`ORIENT_TOLERANCE_DEG`, `ORIENT_MAX_PENALTY`). 적응형 난이도 로직은 코드 주석에 "재활 피드백용 heuristic이며 UPDRS 점수를 재현하는 검증된 알고리즘이 아니다"라고 명시되어 있습니다.

## 프로젝트 구조

```
MeteorShower/
├── ai/                              # Vision AI 분석 서버
│   ├── hand_tracking.py             # 핵심 파이프라인: 동작 판별·DTW·ROM·신호등·과부하·GIF 캡처
│   ├── guide_render.py              # 가이드 홀로그램(손 모양) 시각화 전담 (hand_tracking.py에서 분리)
│   ├── landmark_utils.py            # 좌표 정규화, 손가락/손바닥 각도 계산
│   ├── websocket_server.py          # FastAPI WebSocket 서버 (포트 8000), JWT로 patient_id 추출
│   ├── feedback_trigger.py          # 신호등 지속시간 추적 → 음성 피드백 메시지 생성
│   ├── notification_trigger.py      # 과부하/세션 종료 이벤트를 백엔드로 POST (현재 대상 엔드포인트 없음)
│   ├── llm_client.py / llm_prompts.py  # OpenAI 호출 래퍼 (backend/app/services가 직접 import)
│   ├── extract_landmarks.py         # 가이드 영상 → 랜드마크 JSON 추출 도구
│   ├── hand_landmarker.task         # MediaPipe 모델 파일 (최초 실행 시 자동 다운로드)
│   ├── Dockerfile / docker-compose.yml
│   ├── guide_videos/                # 가이드 동작 원본 영상 (.gitignore 처리, 로컬에만 존재)
│   ├── guide_data/                  # 추출된 랜드마크 시퀀스 JSON (full_fist.json, tapping.json)
│   └── captures/                    # 과부하 감지 시 자동 저장되는 GIF 캡처 (로컬 임시 저장)
├── backend/                         # FastAPI REST API 서버
│   ├── app/
│   │   ├── main.py                  # 앱 진입점, 라우터 등록, 시작 시 RAG 색인
│   │   ├── routers/                 # auth, patients, notifications, doctor_notifications,
│   │   │                            # doctor_dashboard, reports, chat, health
│   │   ├── models/                  # SQLAlchemy 모델 16개 (테이블 1:1 대응)
│   │   ├── schemas/                 # Pydantic 요청/응답 스키마
│   │   ├── crud/                    # doctor/patient/report DB 쿼리 헬퍼
│   │   ├── services/
│   │   │   ├── llm_report_generator.py  # 리포트 통계 집계 + ai/llm_client.py 호출
│   │   │   └── firebase_storage.py      # Firebase Storage 업로드 (재활 캡처 사진)
│   │   ├── utils/profanity.py       # 챗봇 욕설 필터
│   │   ├── rag.py                   # ChromaDB 기반 운동 정보 검색 (chat 라우터에서 사용)
│   │   └── alembic/versions/        # 마이그레이션 파일
│   ├── venv/                        # 백엔드 전용 가상환경
│   ├── Dockerfile / docker-compose.yml
│   └── requirements.txt
├── venv/                            # AI 서버 전용 가상환경 (프로젝트 루트에 위치)
├── frontend/                        # React + Vite
│   ├── Dockerfile / docker-compose.yml
│   └── src/
│       ├── api.js                   # 백엔드(8001) REST 클라이언트
│       ├── context/AuthContext.jsx  # 로그인 토큰 보관
│       ├── components/              # NavBar(알림함 드롭다운 포함), VoiceChatBot 등
│       └── pages/
│           ├── LandingPage.jsx
│           ├── patient/             # PatientLogin, PatientSignup, SocialCallback/Signup,
│           │                        # PatientApproval(계정 승인), TodayExercise,
│           │                        # ExerciseSession(AI 8000 WebSocket 연동),
│           │                        # MedicalRecords, PatientProfile
│           └── doctor/              # DoctorLogin, DoctorSignup, DoctorPatientList,
│                                     # PatientRegister, PatientInfo, DailyReport,
│                                     # ProgressReport, DoctorProfile
└── start_all.bat                    # AI/백엔드/프론트엔드를 각각 별도 콘솔로 실행 (.gitignore 처리, 로컬 전용)
```

## 기술 스택

### AI 서버 (`ai/requirements.txt`)

| 항목 | 버전 | 용도 |
|------|------|------|
| Python | 3.12 | 메인 언어 |
| MediaPipe | 0.10.35 | `mediapipe.tasks.vision.HandLandmarker`로 21개 손 랜드마크 검출 |
| OpenCV | 4.13.0.92 (`opencv-python`, GUI 포함) | 웹캠 입력, 스켈레톤 렌더링, JPEG 인코딩 |
| Pillow | 12.2.0 | `PIL.Image`로 과부하 캡처 GIF 생성 (`hand_tracking.py`) |
| NumPy | 2.4.6 | DTW 거리 행렬 직접 구현, 가이드 좌표 정규화 |
| FastAPI / Uvicorn | 0.136.3 / 0.49.0 | WebSocket 서버 |
| websockets | 16.0 | WebSocket 프로토콜 구현체 |
| openai | 2.43.0 | 일일 리포트 텍스트 생성 (`gpt-4o-mini`, Chat Completions) |
| python-jose | - | WebSocket 연결 시 JWT 디코딩 (`patient_id` 추출) |
| httpx | 0.28.1 | 백엔드로 이벤트 POST (`notification_trigger.py`) |

### 백엔드 (`backend/requirements.txt`)

| 항목 | 용도 |
|------|------|
| FastAPI / Uvicorn[standard] | REST API 서버 (포트 8001) |
| SQLAlchemy / Alembic | PostgreSQL ORM 및 마이그레이션 |
| psycopg2-binary / asyncpg | PostgreSQL 드라이버 |
| python-jose, bcrypt | JWT 발급/검증, 비밀번호 해시 |
| httpx | 카카오/구글/네이버 소셜 로그인 API 호출 |
| openai | `chat.py`가 음성 챗봇(Whisper-1 STT · GPT-4o-mini · TTS-1)에서 직접 호출, `ai/llm_client.py`를 통해 리포트 생성에서도 간접 사용 |
| chromadb | 운동 정보 RAG 검색용 벡터 DB (`backend/chroma_db/`, `.gitignore` 처리) |
| firebase-admin | 재활 운동 캡처 사진을 Firebase Storage에 업로드 (`services/firebase_storage.py`) |

`backend/requirements.txt`에는 `mediapipe`, `opencv-python-headless`도 포함되어 있지만, `backend/` 코드 어디에서도 직접 import하지 않습니다.

### 프론트엔드 (`frontend/package.json`)

| 항목 | 버전 | 용도 |
|------|------|------|
| JavaScript (JSX) | - | 메인 언어 |
| React | 19.2.6 | UI |
| React Router | 7.17.0 | 페이지 라우팅 |
| Vite | 8.0.12 | 개발 서버/빌드 (기본 포트 5173) |
| Tailwind CSS | 3.4.19 | 스타일링 |
| Web Audio API (브라우저 내장) | - | 음성 챗봇의 VAD(음성 활동 감지) 직접 구현 (`AudioContext`, `AnalyserNode`, webrtcvad 미사용) |

### 데이터베이스

PostgreSQL, SQLAlchemy 모델 16개(`backend/app/models/`): `doctor`, `patient`, `social_account`, `doctor_notification`, `patient_notification`, `exercise`, `exercise_schedule`, `prescription`, `prescription_exercise`, `prescription_finger_setting`, `patient_rom_setting`, `finger_accuracy`, `rehab_exercise_session`, `rehab_exercise_log`, `rehab_exercise_capture`, `llm_report`. 마이그레이션은 Alembic으로 관리합니다.

## 환경 설정 및 실행 방법

### 사전 요구사항

- Python 3.12
- Node.js (React 19/Vite 8 기준)
- PostgreSQL 인스턴스
- 웹캠

### 가상환경이 두 개로 분리되어 있는 이유

AI 서버는 `cv2.imshow` 디버그 창을 띄울 수 있는 GUI 포함 빌드(`opencv-python`)가 필요하고, 백엔드는 `opencv-python-headless`를 명시하고 있습니다. `opencv-python`과 `opencv-python-headless`를 같은 가상환경에 함께 설치하면 마지막에 설치된 쪽이 우선되어 GUI 기능이 깨지는 충돌이 발생하므로, 두 서버는 처음부터 별도의 가상환경을 씁니다.

- AI 서버용 가상환경: 프로젝트 루트의 `venv/` (`ai/` 디렉토리 안이 아닙니다)
- 백엔드용 가상환경: `backend/venv/`

### 1. AI 서버

```bash
python -m venv venv
venv\Scripts\activate            # Windows
pip install -r ai/requirements.txt
cd ai
python websocket_server.py       # ws://localhost:8000/ws 에서 대기
```

`hand_landmarker.task` 모델 파일이 없으면 최초 실행 시 자동으로 다운로드됩니다. `ai/.env`에 `SECRET_KEY`와 `OPENAI_API_KEY`가 필요합니다. `SECRET_KEY`는 **백엔드의 `SECRET_KEY`와 반드시 같은 값**이어야 합니다 — AI 서버가 WebSocket 연결 시 쿼리 파라미터로 받은 JWT(`?token=...`)를 이 키로 디코딩해 `patient_id`를 추출하기 때문입니다.

가이드 영상이 필요하면(최초 1회) `ai/guide_videos/`에 `full_fist.mp4`, `tapping.mp4`를 넣고 `python ai/extract_landmarks.py`를 실행해 `ai/guide_data/*.json`을 생성합니다. `guide_videos/`는 `.gitignore` 처리되어 저장소에는 포함되어 있지 않습니다.

### 2. 백엔드

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd app
alembic upgrade head
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

`backend/.env`에 필요한 환경 변수:

| 변수 | 용도 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 문자열 (또는 `DB_USER`/`DB_PASSWORD`/`DB_NAME`/`DB_HOST`/`DB_PORT`로 분리 가능) |
| `SECRET_KEY` | JWT 서명 키 (AI 서버와 동일한 값 사용) |
| `OPENAI_API_KEY` | GPT/Whisper/TTS 호출 |
| `FRONTEND_URL` | CORS 허용 오리진 |
| `FIREBASE_SERVICE_ACCOUNT_PATH` | Firebase Admin SDK 서비스 계정 JSON 파일 경로 (재활 캡처 사진 저장용) |
| `FIREBASE_STORAGE_BUCKET` | Firebase Storage 버킷 이름 |
| `KAKAO_CLIENT_ID` / `KAKAO_CLIENT_SECRET` | 카카오 소셜 로그인 및 병원 검색 API |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | 구글 소셜 로그인 |
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | 네이버 소셜 로그인 |

서버 시작 시 `main.py`의 `lifespan`이 DB의 모든 운동(`Exercise`)을 ChromaDB에 색인합니다 — 색인이 실패해도 서버는 정상 기동합니다.

### 3. 프론트엔드

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

기본값으로 백엔드는 `http://localhost:8001`, AI 서버는 `ws://localhost:8000/ws`를 바라봅니다. 다른 주소를 쓰려면 `frontend/.env`에 `VITE_API_URL`, `VITE_WS_URL`을 설정합니다.

### 한 번에 띄우기

`start_all.bat`은 AI 서버, 백엔드, 프론트엔드를 각각 별도의 `cmd` 창으로 띄우는 스크립트입니다. `.gitignore`에 등록되어 있어 저장소에는 포함되어 있지 않고, 각자 로컬에서 직접 만들어 써야 합니다.

### Docker로 실행하기

`ai/`, `backend/`, `frontend/` 세 디렉토리 모두 자체 `Dockerfile`과 `docker-compose.yml`을 갖고 있습니다.

- `ai/Dockerfile`은 `python:3.12-slim` 기반으로 `libgl1`/`libglib2.0-0`/`libgles2`/`libegl1`(OpenCV·MediaPipe 런타임 의존 라이브러리)을 설치한 뒤 `ai/requirements.txt`를 그대로 사용해 설치합니다.
- `ai/docker-compose.yml`에는 웹캠 디바이스 마운트(`devices`)가 없습니다. 컨테이너 안에서 `cv2.VideoCapture(0)`으로 호스트의 실제 웹캠에 접근할 수 없으므로, 이 구성으로는 로컬 웹캠을 쓰는 실시간 동작 분석을 그대로 띄울 수 없습니다.
- `backend/Dockerfile`은 `--reload` 없이 `uvicorn main:app --host 0.0.0.0 --port 8000`으로 실행합니다(개발용 자동 리로드가 꺼진 상태). `backend/docker-compose.yml`이 컨테이너 내부 8000번을 호스트 8001번으로 매핑합니다.
- `frontend/Dockerfile`은 멀티스테이지 빌드입니다. `node:20-alpine`에서 `npm run build`로 정적 파일을 생성한 뒤 `nginx:alpine`으로 옮겨 `nginx.conf`(SPA 라우팅을 위한 `try_files` 설정)와 함께 80번 포트로 서빙합니다. 빌드 시점에 `VITE_API_URL`/`VITE_WS_URL`을 `ARG`로 주입하며 기본값은 `https://yourdomain.com/api`, `wss://yourdomain.com/ai/ws`로, 로컬 개발이 아니라 실제 배포 도메인을 가정한 빌드입니다.

## 백엔드 구조

### 관심사 분리 (SoC)

백엔드는 역할별로 레이어를 나눠 구성되어 있습니다.

- **`routers/`**: HTTP 요청을 받아 입력을 검증하고, crud 또는 service를 호출한 뒤 응답을 반환합니다. 비즈니스 로직이 직접 들어가지 않습니다.
- **`crud/`** (`doctor.py`, `patient.py`, `report.py`): DB 쿼리만 담당합니다. SQLAlchemy 세션을 받아 조회·저장·수정을 처리하고 결과를 반환합니다.
- **`services/`** (`llm_report_generator.py`, `firebase_storage.py`): 비즈니스 로직 계층입니다. `llm_report_generator.py`는 운동 데이터를 집계하고 `ai/llm_client.py`를 호출해 리포트 초안을 생성합니다. `firebase_storage.py`는 Firebase Admin SDK를 통해 이미지를 Storage에 업로드하고 다운로드 URL을 반환합니다.
- **`models/`**: SQLAlchemy ORM 모델 정의. 테이블 1:1 대응입니다.
- **`schemas/`**: Pydantic 모델로 요청/응답의 타입과 제약을 선언합니다.
- **`main.py`**: FastAPI 앱을 생성하고 라우터를 등록합니다. `lifespan` 이벤트에서 RAG용 ChromaDB 색인을 실행합니다.

### JWT 인증 흐름

로그인(`POST /auth/doctor/login` 또는 `/auth/patient/login`)이 성공하면 `create_token(user_id, role)`이 JWT를 생성해 클라이언트에 반환합니다. 이후 모든 요청은 `Authorization: Bearer <token>` 헤더 또는 WebSocket 연결 시 `?token=<token>` 쿼리 파라미터로 토큰을 전달합니다. 서버는 `get_token_payload()` 의존성에서 JWT를 디코딩해 `sub`(user_id)와 `role`을 추출하고, 각 라우터의 `_require_role()` 함수가 의사/환자 권한을 분리합니다.

- 서버는 토큰을 저장하지 않습니다(stateless).
- 비밀번호는 bcrypt로 해시해 저장하며, 평문은 어디에도 남지 않습니다.
- AI 서버(`websocket_server.py`)도 동일한 `SECRET_KEY`로 JWT를 디코딩해 `patient_id`를 추출합니다.

### SQLAlchemy ORM 연관관계

주요 엔티티의 연결 체인은 다음과 같습니다.

```
Doctor ──┐
         ├─→ Patient ─→ Prescription ─→ PrescriptionExercise ─→ ExerciseSchedule
         │                                        │                      │
         │                            PrescriptionFingerSetting   RehabExerciseSession
         │                                                                │
         └─→ LlmReport                                           RehabExerciseLog
                                                                         │
                                                               FingerAccuracy
                                                               RehabExerciseCapture
```

`PatientRomSetting`, `SocialAccount`, `PatientNotification`, `DoctorNotification`은 위 체인과 별도로 `Patient`·`Doctor`에 직접 연결됩니다.

### Alembic 마이그레이션

스키마 변경은 `alembic/versions/`에 파이썬 파일로 기록됩니다. 팀원이 스키마를 수정하면 `alembic revision --autogenerate -m "설명"`으로 새 파일을 생성하고 저장소에 커밋합니다. 다른 팀원은 `alembic upgrade head`를 실행해 로컬 DB에 최신 스키마를 반영합니다.

### Docker 구성

세 서비스가 독립적인 컨테이너로 분리되어 있습니다.

| 서비스 | 내부 포트 | 호스트 포트 | 비고 |
|--------|-----------|-------------|------|
| ai | 8000 | 8000 | 웹캠 디바이스 마운트 없음 (컨테이너 안에서 호스트 웹캠 접근 불가) |
| backend | 8000 | 8001 | 앱 코드(`./app:/app`) 볼륨 마운트, `--reload` 없이 실행 |
| frontend | 80 | - | `npm run build` 결과를 nginx로 서빙하는 프로덕션 빌드 |

ai와 backend가 각각 8000번 내부 포트를 쓰지만, backend를 8001로 외부 매핑해 충돌을 피합니다. frontend는 개발 서버가 아니라 정적 빌드 결과물을 nginx가 80번 포트로 서빙하는 구조입니다.

## 알려진 제한사항

AI 서버의 `notification_trigger.send_notification_to_backend()`는 운동 차단(과부하) 발생 시 백엔드의 `/api/doctor-notifications`로 POST를 시도하지만, 백엔드에는 이 경로가 없습니다. `doctor_notifications.py`의 실제 prefix는 `/doctor/me/notifications`이고 거기에는 GET·PATCH만 있어 POST를 받지 않습니다. 즉 AI가 감지한 과부하 이벤트는 현재 백엔드 DB나 의사 알림으로 이어지지 않습니다.

같은 이유로 `ai/llm_client.py`의 `send_report_to_backend()`(POST `/api/llm-reports`)도 대상 엔드포인트가 없습니다(실제 경로는 `/reports/llm`). 이 함수와 `generate_prescription_adjustment()`는 `ai/test_llm_client.py`에서만 호출되고, 운영 코드에서는 사용되지 않습니다. 실제로 동작하는 LLM 호출은 일일 리포트 생성(`generate_daily_report_content`)뿐이며, 백엔드가 `ai/llm_client.py`를 직접 import해서 같은 프로세스 안에서 호출하는 구조입니다(REST 호출이 아닙니다). OpenAI 호출이 실패하면 `_fallback_report_text()`가 만든 정형 텍스트로 대체됩니다.

`patient_rom_setting`, `prescription_finger_setting`, `finger_accuracy`의 `joint_type` CHECK 제약은 `IN ('MCP', 'PIP', 'DIP', 'IP')` 값 목록만 검사하고 `finger_type`을 참조하지 않습니다. "엄지는 MCP/IP만, 나머지 손가락은 MCP/PIP/DIP만 허용"이라는 규칙은 DB와 API 어디에도 강제되어 있지 않으며, 마이그레이션 `h3c4d5e6f7g8`가 과거 데이터를 한 번 이전해 준 것일 뿐입니다.

WebSocket 연결 시 `patient_id`는 JWT에서 추출하지만, `doctor_id`는 클라이언트가 `start` 메시지에 넣어 보낸 값을 그대로 신뢰합니다. 서버 측에서 그 의사가 실제로 해당 환자의 담당의인지 검증하지 않습니다.

`ai/hand_tracking.py`가 과부하 감지 시 저장하는 GIF 캡처는 `ai/captures/` 디렉토리에 로컬 파일로만 남습니다. 백엔드가 Firebase Storage로 업로드하는 캡처 사진 기능(`firebase_storage.py`, `patients.py`)은 별도 HTTP 엔드포인트를 통해 동작하며, AI 서버가 자동으로 그 엔드포인트를 호출하는 연결이 현재 없습니다. 즉 AI 서버 캡처(자동, 로컬)와 백엔드 Firebase 업로드(수동 엔드포인트)는 아직 직접 연결되어 있지 않습니다.

`ai/docker-compose.yml`에는 웹캠 디바이스 마운트가 없어 컨테이너 안에서 호스트 웹캠에 접근할 수 없고, `frontend/Dockerfile`은 로컬 개발이 아니라 배포 도메인을 가정한 프로덕션 빌드(`nginx` 서빙)이므로 로컬에서 `docker-compose up`만으로 전체 스택을 띄우기는 어렵습니다 — 자세한 내용은 [Docker로 실행하기](#docker로-실행하기) 참고.

`patient_notification.notification_type` CHECK 제약은 `'처방등록'`, `'운동미수행'` 두 값을 허용하고 `nudge_step` 컬럼도 추가되어 있지만(마이그레이션 `j5e6f7g8h9i0`), 실제로 `notification_type="운동미수행"`인 알림을 생성하는 코드는 라우터·crud·services 어디에도 없습니다. 즉 운동을 안 한 환자에게 단계적으로 알림을 보내는 기능은 DB 스키마만 준비되어 있고 동작하는 코드는 아직 없습니다.

## 한계 및 면책 고지

이 섹션은 ISO/IEC TS 42119(AI 시험·검증)와 ISO 42001(AI 관리체계)의 권고 기준을 참고해 작성했습니다.

### 의료적 한계

피네는 의사의 처방을 기반으로 동작하는 재활 보조 도구로, 의학적 진단이나 치료를 대체하지 않습니다. 시스템이 제공하는 운동 일치율, 신호등 피드백, 세션 종료 판정은 사용자의 동작을 안내하는 보조 정보이며, 임상적 판단의 근거로 사용해서는 안 됩니다. 사전 문진에서 이상이 감지된 환자에게 제공되는 주변 병원 검색 기능은 편의를 위한 정보 제공이며, 의학적 처치나 진단 행위가 아닙니다.

### AI 알고리즘 한계

일치율 산출에 사용되는 DTW:ROM 5:5 가중합 구조와 손 방향 페널티 계수는 연구 목적의 휴리스틱이며, 임상적 유효성이 검증된 알고리즘이 아닙니다. 코드 내부에도 "재활 피드백용 heuristic이며 UPDRS 점수를 재현하는 검증된 알고리즘이 아니다"라고 명시되어 있습니다. 적응형 난이도 자동 완화는 운동 지속성을 돕기 위한 기능이며, 의사가 처방한 목표값 자체를 변경하지 않습니다.

### 보안 및 개인정보 한계

현재 구현된 보안 조치는 다음과 같습니다. 비밀번호는 bcrypt로 해시해 저장하며 평문은 저장하지 않습니다. API 접근은 JWT로 인증하고, 의사/환자 역할을 모든 엔드포인트에서 구분합니다. 소셜 로그인은 OAuth 2.0 흐름을 따릅니다.

현재 구현되지 않은 보안 조치도 있습니다. DB 레벨 컬럼 암호화가 적용되어 있지 않습니다. PostgreSQL 연결에 SSL/TLS가 구성되어 있지 않습니다. DB 자동 백업 및 접근 이력(Audit Log) 기능이 없습니다. 프로덕션 배포 시에는 이 항목들을 별도로 적용해야 합니다.

### 엣지 케이스 처리

실제 코드에서 처리하는 케이스와 그렇지 않은 케이스를 구분합니다.

**처리됨:**
- 손 미감지가 연속 30프레임 이상 지속되면 유사도 버퍼와 카운트를 초기화해 이전 데이터가 누적되지 않게 합니다.
- 웹캠이 물리적으로 끊어지거나 프레임 읽기에 실패하면(`if not ret: break`) 추적 루프가 종료됩니다.
- MediaPipe 검출/추적 신뢰도 0.7 미만의 결과는 유효한 손으로 인정하지 않아, 조명이 불량하거나 손이 부분적으로 가려진 경우 해당 프레임의 카운팅과 DTW 계산이 건너뜁니다.
- 환자가 종료 버튼을 누르면 WebSocket으로 `{"action":"stop"}`이 전송되고 `stop_event.set()`으로 추적 스레드가 안전하게 종료됩니다.

**미처리:**
- 세션 도중 반대 손으로 전환하는 기능이 없습니다. 손 방향(`hand="left"/"right"`)은 세션 시작 시 고정되며 중간에 변경되지 않습니다.
- 극단적인 저조도나 역광 환경에서 MediaPipe가 손을 아예 감지하지 못할 경우, 별도 오류 메시지 없이 손 미감지 상태로 처리됩니다(세션이 자동으로 종료되지 않습니다).

### LLM 프롬프트 보안

현재 프롬프트 인젝션 방어 로직은 별도로 구현되어 있지 않습니다. 다만 두 가지 가드가 존재합니다. 첫째, `utils/profanity.py`의 욕설 필터가 STT 변환 텍스트에 적용되며, 감지 시 고정된 안내 문구를 반환하고 LLM을 호출하지 않습니다. 둘째, 챗봇 시스템 프롬프트가 "손 재활 관련 질문에 2~3문장으로 답하라"는 역할 지침을 포함하지만, 이는 언어 모델의 best-effort 설정이며 모든 비관련 입력을 차단하는 기술적 보장은 아닙니다.
