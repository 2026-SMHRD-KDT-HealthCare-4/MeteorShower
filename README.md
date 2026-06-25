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
- 의사가 회원가입한 환자를 검색해 담당 환자로 등록하고, 수술·재활 정보를 입력 및 관리합니다.
- 의사가 환자별로 손가락·관절 단위 목표 가동범위(ROM)와 운동 처방(종류·세트·횟수·요일별 일정)을 설정합니다.
- 매일 운동이 끝나면 AI가 그날 결과를 바탕으로 리포트 초안을 작성하고, 의사가 검토·수정해 승인하면 환자 또는 보호자에게 전달됩니다.
- 의사가 대시보드에서 검토 대기 리포트와 이번 주 처방 현황을 한눈에 확인하고, 환자별로 주차별 누적 달성률 및일치율을 추적합니다.
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
| 환자 목록 · 검색 · 등록 | 담당 환자 관리, 환자 검색 → 선택 → 수술/재활 정보·ROM 입력 순으로 진행하는 등록 화면 (`PatientRegister.jsx`) |
| 환자 의료정보 · ROM · 처방 설정 | 수술명·부위·재활단계 수정, 손가락·관절 단위 목표 가동범위 설정, 운동·세트·요일별 스케줄 처방 (`PatientInfo.jsx`) |
| 일일 리포트 검토 | LLM 초안 생성 → 수정 → 승인, 승인 시 다음 처방 등록 및 환자 알림 (`DailyReport.jsx`) |
| 누적 진행률 리포트 | 환자별 주차별 달성률·일치율 조회 (`ProgressReport.jsx`) — 이 통계는 집계값이며, 화면에 있는 "종합 평가"·키워드는 LLM이 생성하도록 설계되어 있지만 현재는 항상 빈 값으로 표시됩니다(자세한 내용은 [알려진 제한사항](#알려진-제한사항) 참고) |
| 대시보드 | 리포트 검토 대기 환자, 이번 주 처방 현황 (`GET /doctor/me/dashboard`) |
| 프로필 관리 | 이메일 · 전화번호 수정 (`DoctorProfile.jsx`, `PATCH /auth/doctor/me`) |

**AI 동작 분석 (`ai/hand_tracking.py`)**

| 기능 | 설명 |
|------|------|
| 실시간 손 추적 | MediaPipe `HandLandmarker`(VIDEO 모드, `num_hands=1`, 검출/추적 신뢰도 0.7)로 21개 랜드마크 추출 |
| 동작 판별 | OPEN/GRIP/TAP 상태를 관절 각도가 아닌 손목-손끝 거리 비교로 판별 (`get_hand_state`, `get_tap_state`) |
| 일치율 산출 | 가이드 동작과의 DTW 유사도 + 관절 각도 기반 ROM 점수를 가중합 |
| 신호등 피드백 | 관절별 green/yellow/red 판정, 지속 시 한국어 피드백 문장 생성(`feedback_trigger.py`) → 프론트엔드가 TTS(`/chat/tts`)로 음성 변환 |
| 과부하 감지 | 손목-손끝 평균 거리 또는 카운트가 임계값 초과 시 단계적으로 세션 강제 종료 |
| 적응형 난이도 | 초반 동작을 기준으로 느려짐·ROM 저하를 감지해 DTW 허용 오차를 완화 |

일치율은 DTW 기반 유사도(`similarity`)와 ROM 점수(`rom_score`)를 각각 50%씩 가중합한 값입니다(`DTW_WEIGHT = ROM_WEIGHT = 0.5`). 손바닥 법선 벡터로 계산하는 "손 방향 틀어짐" 각도는 이 가중합과 비율로 섞이는 것이 아니라, 30도까지는 영향이 없고 30~90도 구간에서 최종 일치율에 최대 30%까지 곱셈 페널티로 추가 적용됩니다(`ORIENT_TOLERANCE_DEG`, `ORIENT_MAX_PENALTY`). 적응형 난이도 로직은 코드 주석에 "재활 피드백용 heuristic이며 UPDRS 점수를 재현하는 검증된 알고리즘이 아니다"라고 명시되어 있습니다.

## 프로젝트 구조

```
MeteorShower/
├── ai/                              # Vision AI 분석 서버
│   ├── hand_tracking.py             # 핵심 파이프라인: 동작 판별·DTW·ROM·신호등·과부하·적응형 난이도
│   ├── landmark_utils.py            # 좌표 정규화, 손가락/손바닥 각도 계산
│   ├── websocket_server.py          # FastAPI WebSocket 서버 (포트 8000), JWT로 patient_id 추출
│   ├── feedback_trigger.py          # 신호등 지속시간 추적 → 음성 피드백 메시지 생성
│   ├── notification_trigger.py      # 과부하/세션 종료 이벤트를 백엔드로 POST (현재 대상 엔드포인트 없음)
│   ├── llm_client.py / llm_prompts.py  # OpenAI 호출 래퍼 (backend/app/services가 직접 import)
│   ├── extract_landmarks.py         # 가이드 영상 → 랜드마크 JSON 추출 도구
│   ├── hand_landmarker.task         # MediaPipe 모델 파일 (최초 실행 시 자동 다운로드)
│   ├── Dockerfile / docker-compose.yml  # 컨테이너 빌드 (requirements.txt와 패키지 목록이 다름, 아래 참고)
│   ├── guide_videos/                # 가이드 동작 원본 영상 (.gitignore 처리, 로컬에만 존재)
│   ├── guide_data/                  # 추출된 랜드마크 시퀀스 JSON (full_fist.json, tapping.json)
│   └── captures/                    # 과부하 감지 시 자동 저장되는 캡처 프레임
├── backend/                         # FastAPI REST API 서버
│   ├── app/
│   │   ├── main.py                  # 앱 진입점, 라우터 등록, 시작 시 RAG 색인
│   │   ├── routers/                 # auth, patients, notifications, doctor_notifications,
│   │   │                            # doctor_dashboard, reports, chat, health, ws(echo 더미)
│   │   ├── models/                  # SQLAlchemy 모델 16개 (테이블 1:1 대응)
│   │   ├── schemas/                 # Pydantic 요청/응답 스키마
│   │   ├── crud/                    # doctor/patient/report 쿼리 헬퍼
│   │   ├── services/llm_report_generator.py  # 리포트용 통계 집계 + ai/llm_client.py 호출
│   │   ├── rag.py                   # ChromaDB 기반 운동 정보 검색 (chat 라우터에서 사용)
│   │   └── alembic/versions/        # 마이그레이션 10개
│   ├── venv/                        # 백엔드 전용 가상환경
│   ├── Dockerfile / docker-compose.yml
│   └── requirements.txt
├── venv/                            # AI 서버 전용 가상환경 (프로젝트 루트에 위치)
├── frontend/                        # React + Vite
│   ├── Dockerfile / docker-compose.yml
│   └── src/
│       ├── api.js                   # 백엔드(8001) REST 클라이언트
│       ├── context/AuthContext.jsx  # 로그인 토큰 보관
│       ├── components/              # NavBar(알림함 드롭다운 포함), VoiceChatBot 등 공통 컴포넌트
│       └── pages/
│           ├── LandingPage.jsx
│           ├── patient/             # PatientLogin, PatientSignup, SocialCallback/Signup,
│           │                        # TodayExercise, ExerciseSession(AI 8000 WebSocket 연동),
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
| NumPy | 2.4.6 | DTW 거리 행렬, 가이드 좌표 정규화 |
| FastAPI / Uvicorn | 0.136.3 / 0.49.0 | WebSocket 서버 |
| websockets | 16.0 | WebSocket 프로토콜 구현체 |
| openai | 2.43.0 | 일일 리포트 텍스트 생성 (Chat Completions) |
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
| openai | `chat.py`가 음성 챗봇(Whisper STT·GPT·TTS)에서 직접 호출하고, `ai/llm_client.py`를 통해 일일 리포트 생성에서도 간접적으로 사용 |
| chromadb | 운동 정보 RAG 검색용 벡터 DB (`backend/chroma_db/`, `.gitignore` 처리) |

`backend/requirements.txt`에는 `mediapipe`, `opencv-python-headless`도 적혀 있지만, `backend/` 코드 어디에서도 `cv2`나 `mediapipe`를 직접 import하지 않습니다 — 실제로는 쓰이지 않는 의존성입니다.

### 프론트엔드 (`frontend/package.json`)

| 항목 | 버전 | 용도 |
|------|------|------|
| React | 19.2.6 | UI |
| React Router | 7.17.0 | 페이지 라우팅 |
| Vite | 8.0.12 | 개발 서버/빌드 (기본 포트 5173) |
| Tailwind CSS | 3.4.19 | 스타일링 |
| eslint-plugin-react-hooks | 7.1.1 | React 19의 `react-hooks/refs` 등 신규 규칙 포함 |

### 데이터베이스

PostgreSQL, SQLAlchemy 모델 16개(`backend/app/models/`): `doctor`, `patient`, `social_account`, `doctor_notification`, `patient_notification`, `exercise`, `exercise_schedule`, `prescription`, `prescription_exercise`, `prescription_finger_setting`, `patient_rom_setting`, `finger_accuracy`, `rehab_exercise_session`, `rehab_exercise_log`, `rehab_exercise_capture`, `llm_report`. 마이그레이션은 Alembic으로 관리하며 현재 head는 `h3c4d5e6f7g8`(총 10개 리비전)입니다.

`patient_rom_setting`, `prescription_finger_setting`, `finger_accuracy` 세 테이블 모두 `joint_type` 컬럼에 `CHECK (joint_type IN ('MCP', 'PIP', 'DIP', 'IP'))` 제약이 걸려 있습니다(라이브 DB 직접 조회로 확인, 마이그레이션 파일과 일치). 이 제약은 `finger_type` 값을 참조하지 않는 단순 값 목록 검사이며, "엄지는 MCP/IP만, 나머지 손가락은 MCP/PIP/DIP만 허용"이라는 규칙은 DB·API 어디에도 강제되어 있지 않습니다 — 자세한 내용은 [알려진 제한사항](#알려진-제한사항)에 정리했습니다.

## 환경 설정 및 실행 방법

### 사전 요구사항

- Python 3.12
- Node.js (frontend 의존성은 React 19/Vite 8 기준)
- PostgreSQL 인스턴스
- 웹캠

### 가상환경이 두 개로 분리되어 있는 이유

AI 서버는 `cv2.imshow` 디버그 창을 띄울 수 있는 GUI 포함 빌드(`opencv-python`)가 필요하고, 백엔드는 서버 환경에서 GUI가 필요 없는 `opencv-python-headless`를 명시하고 있습니다(실제로는 위에서 설명했듯 백엔드 코드가 OpenCV를 쓰지 않지만, requirements.txt에는 남아 있습니다). `opencv-python`과 `opencv-python-headless`를 같은 가상환경에 함께 설치하면 마지막에 설치된 쪽이 우선되어 GUI 기능이 깨지는 충돌이 발생하므로, 두 서버는 처음부터 별도의 가상환경을 씁니다.

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

`hand_landmarker.task` 모델 파일이 없으면 최초 실행 시 자동으로 다운로드됩니다. `ai/.env`에 `SECRET_KEY`와 `OPENAI_API_KEY`가 필요합니다. `SECRET_KEY`는 **백엔드의 `SECRET_KEY`와 반드시 같은 값**이어야 합니다 — AI 서버가 WebSocket 연결 시 쿼리 파라미터로 받은 JWT(`?token=...`)를 이 키로 직접 디코딩해 `patient_id`를 추출하기 때문입니다(`websocket_server.py`).

가이드 영상이 필요하면(최초 1회) `ai/guide_videos/`에 `full_fist.mp4`, `tapping.mp4`를 넣고 `python ai/extract_landmarks.py`를 실행해 `ai/guide_data/*.json`을 생성합니다. `guide_videos/`는 `.gitignore` 처리되어 있어 저장소에는 포함되어 있지 않습니다.

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

`backend/.env`에 `DATABASE_URL`(또는 `DB_USER`/`DB_PASSWORD`/`DB_NAME`/`DB_HOST`/`DB_PORT`), `SECRET_KEY`, `OPENAI_API_KEY`, `FRONTEND_URL`, 소셜 로그인을 쓰려면 `KAKAO_CLIENT_ID`/`KAKAO_CLIENT_SECRET`/`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`이 필요합니다. 카카오 로컬 API(병원 검색)는 `KAKAO_CLIENT_ID`를 REST API 키로 재사용합니다.

서버 시작 시 `main.py`의 `lifespan`이 DB의 모든 운동(`Exercise`)을 ChromaDB(`backend/chroma_db/`)에 색인합니다 — 색인이 실패해도 서버는 정상 기동합니다.

### 3. 프론트엔드

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

기본값으로 백엔드는 `http://localhost:8001`, AI 서버는 `ws://localhost:8000/ws`를 바라봅니다. 다른 주소를 쓰려면 `frontend/.env`에 `VITE_API_URL`, `VITE_WS_URL`을 설정합니다(현재 저장소에는 `frontend/.env` 파일이 없고 기본값만 적용됩니다).

### 한 번에 띄우기

`start_all.bat`은 AI 서버(루트 `venv/`), 백엔드(`backend/venv/`), 프론트엔드를 각각 별도의 `cmd` 창으로 띄우는 스크립트입니다. `.gitignore`에 등록되어 있어 저장소에는 포함되어 있지 않고(`.example` 템플릿도 없음), 팀원 각자 로컬에서 위 명령들을 옮겨 직접 만들어 써야 합니다.

### Docker로 실행하기

`ai/`, `backend/`, `frontend/` 세 디렉토리 모두 자체 `Dockerfile`과 `docker-compose.yml`을 갖고 있어 `docker-compose up --build`로 각각 띄울 수 있습니다. 다만 세 구성 모두 로컬 venv 실행과는 차이가 있어 그대로 쓰기는 어렵습니다.

- `ai/Dockerfile`은 `ai/requirements.txt`를 쓰지 않고 `mediapipe`, `opencv-python-headless`, `fastapi`, `uvicorn[standard]`, `numpy`만 직접 `pip install`합니다. `openai`, `python-jose`, `httpx`, `python-dotenv`가 빠져 있어 `llm_client.py`(openai), `websocket_server.py`(python-jose), `notification_trigger.py`(httpx) import 시 실패할 수 있습니다.
- `ai/docker-compose.yml`은 `devices: /dev/video0:/dev/video0`로 웹캠을 매핑하는데, 이는 Linux 전용 디바이스 경로라 Windows 호스트에서는 그대로 동작하지 않습니다.
- `backend/docker-compose.yml`은 컨테이너 내부 포트 8000(Dockerfile의 `EXPOSE 8000`, `CMD`의 `--port 8000`)을 호스트 포트 8001로 매핑합니다 — venv로 직접 실행할 때 `--port 8001`을 쓰는 것과는 다른 방식으로 같은 결과를 냅니다.
- `frontend/Dockerfile`은 `npm run dev -- --host`로 Vite 개발 서버를 그대로 컨테이너에서 실행합니다(프로덕션 빌드가 아닙니다).

## 알려진 제한사항

AI 서버의 `notification_trigger.send_notification_to_backend()`는 운동 차단(과부하) 발생 시 백엔드의 `/api/doctor-notifications`로 POST를 시도하지만, 백엔드에는 이 경로가 없습니다. `doctor_notifications.py`의 실제 prefix는 `/doctor/me/notifications`이고 거기에는 GET·PATCH만 있어 POST를 받지 않습니다. 즉 AI가 감지한 과부하 이벤트는 현재 백엔드 DB나 의사 알림으로 이어지지 않습니다.

같은 이유로 `ai/llm_client.py`의 `send_report_to_backend()`(POST `/api/llm-reports`)도 대상 엔드포인트가 없습니다(실제 경로는 `/reports/llm`). 이 함수와 `generate_monthly_report()`, `generate_prescription_adjustment()`는 `ai/test_llm_client.py`에서만 호출되고, 운영 코드(라우터·`hand_tracking.py`) 어디에서도 호출되지 않는 미사용 코드입니다. 실제로 동작하는 LLM 호출은 일일 리포트 생성(`generate_daily_report`, `services/llm_report_generator.generate_daily_report_content`)뿐이며, 이는 백엔드가 `ai/llm_client.py`를 직접 import해서 같은 프로세스 안에서 호출하는 구조입니다(REST 호출이 아닙니다). OpenAI 호출이 실패하면 예외를 던지지 않고 `_fallback_report_text()`가 만든 정형 텍스트로 대체됩니다.

`generate_monthly_report()`가 만드는 `summary`/`keywords` 형태는 `ProgressReport.jsx`의 "종합 평가" 섹션과 정확히 대응되도록 설계된 것으로 보이지만, 실제로 이어져 있지 않습니다. `GET /patients/{id}/weekly-progress`(`get_patient_weekly_progress()`)는 항상 주차별 통계 배열만 반환하고 `summary`/`keywords` 필드를 채우지 않으므로, 프론트엔드는 `Array.isArray(progressData)`가 항상 true가 되어 `summary`를 `null`로 처리합니다. 그 결과 "종합 평가"는 항상 `-`, 키워드는 항상 빈 목록으로 표시됩니다.

비슷하게, `patient.overall_evaluation` 컬럼(마이그레이션 `g2b3c4d5e6f7`에서 추가, "누적 리포트 승인 후 전달되는 종합 소견"이라는 주석이 달려 있음)도 이를 읽거나 쓰는 라우터·crud 코드가 전혀 없어 항상 빈 채로 남습니다.

`rehab_exercise_capture` 테이블도 모델과 `rehab_exercise_session`과의 관계만 정의돼 있을 뿐, 실제로 데이터를 쓰거나 읽는 라우터·crud 코드가 없습니다. `hand_tracking.py`의 `save_capture()`가 과부하 발생 시 저장하는 캡처 이미지는 `ai/captures/`에 JPG 파일로만 남고 DB나 백엔드로 전달되지 않습니다. 프론트엔드의 "치료 사진 갤러리"(`PatientInfo.jsx`)는 `sessionGallery = []`로 빈 배열이 하드코딩돼 있어 실제로 아무 사진도 표시되지 않고, `DailyReport.jsx`의 "치료 중 촬영 사진"은 `sessionPhotos`라는 고정된 4개 mock 항목(실제 이미지 없이 그라디언트 색상 박스만 표시)을 보여줍니다. 즉 AI가 저장하는 캡처, DB 테이블, 프론트엔드 갤러리 UI 세 곳이 서로 연결되어 있지 않습니다.

`ExerciseSession.jsx`는 환자가 운동 종료 모달에서 "확인"을 누르면 `end_type: '안전종료'`로 운동 결과를 저장하려 합니다(`saveExerciseResult('안전종료')`). 그런데 백엔드 `ExerciseSessionCreateRequest.end_type`은 `Literal['완료', '운동차단', '중도종료']`만 허용하므로 `'안전종료'`는 422 검증 오류가 날 수 있습니다.

`patient_rom_setting`, `prescription_finger_setting`, `finger_accuracy`의 `joint_type` CHECK 제약은 `IN ('MCP', 'PIP', 'DIP', 'IP')` 값 목록만 검사하고 `finger_type`을 참조하지 않습니다. `FingerAccuracyRequest` 등 Pydantic 스키마도 `finger_type`/`joint_type`을 각각 독립된 `Literal`로만 검증하며 둘을 함께 보는 검증 로직이 없습니다. 따라서 "엄지는 MCP/IP만, 나머지 손가락은 MCP/PIP/DIP만 허용"이라는 규칙은 DB와 API 어디에도 강제되어 있지 않습니다 — 마이그레이션 `h3c4d5e6f7g8`가 과거 데이터의 엄지 PIP 값을 IP로 한 번 이전해 준 것일 뿐, 이후 새로 들어오는 데이터를 제한하지 않습니다. 또한 `prescription_finger_setting`과 `finger_accuracy`에는 초기 마이그레이션(`f578c369e907`)이 만든 이름 없는 레거시 CHECK 제약(`prescription_finger_setting_finger_type_check` 등)이 이후 추가된 동일 내용의 명명된 제약과 함께 중복으로 남아 있습니다.

WebSocket 연결 시 `patient_id`는 JWT에서 직접 추출하지만, `doctor_id`는 클라이언트가 `start` 메시지에 넣어 보낸 값을 그대로 신뢰합니다(`websocket_server.py`의 `start_tracking(doctor_id=msg.get("doctor_id"), ...)`) — 서버 측에서 그 의사가 실제로 해당 환자의 담당의인지 검증하지 않습니다.

`backend/app/routers/ws.py`의 `/ws`는 받은 텍스트를 그대로 돌려보내는 echo 엔드포인트로, 실제 동작 분석과는 무관한 더미 구현입니다. AI 동작 분석은 항상 별도 프로세스인 `ai/websocket_server.py`(포트 8000)를 통해 이루어집니다.

세 서비스의 Docker 구성(`Dockerfile`/`docker-compose.yml`)은 로컬 venv 실행과 패키지 목록·포트 매핑이 달라 그대로는 동작하지 않을 수 있습니다 — 자세한 내용은 [Docker로 실행하기](#docker로-실행하기)에 정리했습니다.
