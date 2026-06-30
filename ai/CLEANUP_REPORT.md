# ai/ 청소 리포트

이 문서는 `ai/` 폴더의 정리 후보를 grep 근거와 함께 나열한다. **아무것도 자동으로
삭제하지 않았다** — 최종 삭제 판단은 사용자가 직접 한다.

사용 여부는 `ai/`, `backend/`, `frontend/src` 전체를 grep으로 확인했다(ai 모듈이
backend API나 프론트에서 호출될 가능성을 배제하기 위함).

## 삭제 후보

| 대상 | 종류 | 근거(grep 결과) | 권장 |
|---|---|---|---|
| `websocket_server.py:12` `JWTError` | 미사용 import | `from jose import JWTError, jwt` — 파일 전체에서 `JWTError`는 이 import 줄에만 등장. `websocket_endpoint`의 인증 실패 처리는 `except Exception as e:`로 모든 예외를 잡아서, `JWTError`를 따로 잡는 코드가 없음 | 삭제 |
| `hand_tracking.py:73-74` `WINDOW_STRETCH`, `WINDOW_STRIDE` | 미사용 상수 | `grep -rn "WINDOW_STRETCH\|WINDOW_STRIDE" ai/ backend/ frontend/src` → 정의된 줄(73, 74) 외에 레포 전체 어디에도 등장하지 않음 | 삭제 |
| `hand_tracking.py:117-123` `FINGER_LANDMARK_GROUPS` | 미사용 상수 | `grep -rn "FINGER_LANDMARK_GROUPS" ai/ backend/ frontend/src` → 정의 줄(117) 외에는 `feedback_trigger.py:10`의 **주석**("hand_tracking.FINGER_LANDMARK_GROUPS와 동일한 그룹")에서만 언급. 실제 코드 참조 없음 | 삭제 |
| `hand_tracking.py:132` `FINGER_NAMES` | 미사용 상수 | `grep -rn "FINGER_NAMES" ai/ backend/ frontend/src` → 정의 줄(132) 외 등장 없음 | 삭제 |
| `hand_tracking.py:654-657` `guide_tap_finger` 지역 변수 | dead 코드(미사용 변수) | `get_guide_tap_finger(...)` 호출 결과를 `guide_tap_finger`에 할당하지만, `run_tracking()` 본문 어디에서도 이 변수를 다시 읽지 않음. (참고: `get_guide_tap_finger` 함수 자체는 이 한 곳에서만 호출되므로, 변수와 함께 호출문 전체를 정리하면 함수도 같이 미사용이 됨 — 아래 항목 참고) | 삭제(할당문) |
| `hand_tracking.py:279` `get_guide_tap_finger` | 미사용에 가까운 함수 | 호출부가 `hand_tracking.py:654-657` 단 한 곳뿐이고, 그 결과(`guide_tap_finger`)가 이후 사용되지 않음(바로 위 항목). 즉 호출은 되지만 반환값이 버려지는 죽은 호출 | `guide_tap_finger` 할당과 함께 삭제 검토 |
| `hand_tracking.py:253` `_load_guide_features` | 미사용 함수 | `grep -rn "_load_guide_features" ai/ backend/ frontend/src` → 정의 줄(253) 외 호출 없음. (참고: `_load_guide`는 `run_tracking` 내에서 실제로 사용됨 — 별도 함수) | 삭제 |

## stale 편집 마커 (과거 변경 흔적 — 정보용, 삭제는 선택)

| 대상 | 종류 | 근거 | 권장 |
|---|---|---|---|
| `hand_tracking.py:22, 152, 226, 952, 1144` (5곳) | stale 마커("★ 수정됨:") | `grep -n "★ 수정됨" hand_tracking.py` → 모두 "이 부분을 과거에 수정했다"는 일회성 작업 메모로, 현재 코드를 이해하는 데는 불필요. 코드 자체는 정상 동작 중이라 로직과 무관 | 주석만 제거 검토(코드는 보존) |
| `hand_tracking.py:142` | stale 마커("# 새로 추가:") | 탭핑 전용 타겟(`TAP_FINGER_ROM_TARGETS`) 도입 시점의 메모. 해당 상수는 현재도 활발히 쓰이고 있어 코드는 보존, 마커 문구만 정리 대상 | 주석만 제거 검토(코드는 보존) |

## 운영 경로에서 미사용(테스트에서만 호출됨) — 파일은 보존 권장 대상이므로 파일 삭제는 비권장

| 대상 | 종류 | 근거 | 권장 |
|---|---|---|---|
| `llm_client.py:91` `generate_prescription_adjustment` | 운영 미연결 함수 | `backend/app/services/llm_report_generator.py`는 `sys.path`에 `ai/`를 추가한 뒤 `from llm_client import generate_daily_report`(216번째 줄), `from llm_client import generate_monthly_report`(300번째 줄)만 동적 import함. `generate_prescription_adjustment`는 `ai/test_llm_client.py`에서만 호출(`grep -rn "generate_prescription_adjustment" ai/ backend/ frontend/src`) | 보존 — `llm_client.py`는 사용자 지정 보존 대상. 처방 조정 기능이 아직 backend에 연결 안 된 것으로 보임(정보 공유 목적) |
| `llm_client.py:114` `send_report_to_backend` | 운영 미연결 함수 | 위와 동일한 근거(`grep -rn "send_report_to_backend" ai/ backend/ frontend/src` → `ai/test_llm_client.py`에서만 호출). backend는 리포트를 자체 DB(`create_or_update_mock_report`)에 직접 저장하고 있어 이 HTTP POST 경로 자체가 안 쓰이는 듯 | 보존 — 위와 동일 |

## 보존 권장 (삭제 후보로 올리지 않음 — 지시사항에 따른 명시적 보존 목록)

| 대상 | 종류 | 근거 | 권장 |
|---|---|---|---|
| `test_feedback_trigger.py`, `test_llm_client.py`, `test_notification_trigger.py` | 파일(테스트) | 각각 `feedback_trigger.py`, `llm_client.py`, `notification_trigger.py`의 단위 테스트. `if __name__ == "__main__":`으로 직접 실행 가능 | 보존 |
| `extract_landmarks.py` | 파일(오프라인 도구) | `grep -rn "extract_landmarks" ai/ backend/ frontend/src` → 어디서도 import 안 됨(런타임 미사용이 정상). 가이드 영상→JSON 변환 1회성 스크립트 | 보존 |
| `feedback_trigger.py`(`FeedbackTracker`, `reduce_to_finger_signals`) | 파일/기능 전체 | `grep -n "feedback_trigger\|FeedbackTracker" hand_tracking.py` → **결과 없음**. 즉 메인 트래킹 루프(`run_tracking`)에 전혀 연결되어 있지 않음을 확인. 신호등 지속시간 기반 피드백 메시지 생성 기능 자체는 완성돼 있고 테스트도 통과하지만, `hand_tracking.py`의 `payload`에 아직 연결되지 않은 상태로 보임 | 보존(추후 연결 예정 기능으로 추정) |
| `llm_client.py`, `llm_prompts.py` | 파일 | 위 "운영 경로에서 미사용" 표 참고 — 일부 함수는 운영 미연결이지만 `generate_daily_report`/`generate_monthly_report`는 backend에서 실제로 쓰임 | 보존 |
| `guide_data/`, `hand_landmarker.task`, `.env`, `Dockerfile`, `docker-compose.yml`, `requirements.txt`, `captures/` | 파일/디렉토리 | 지시사항에 따른 명시적 보존 대상(설정·자산·런타임 산출물) | 보존 |

## 확인 결과 — 후보 없음으로 판단한 항목

- **도달 불가능한(dead) 코드 블록**: `ast` 기반 검토 및 패턴 검색 결과 발견되지 않음.
- **주석 처리된 채 방치된 코드 블록**: 패턴 검색(`# ` + 코드형 토큰) 결과 매치된 줄은 모두 일반 설명 주석(false positive)이었고, 실제로 비활성화된 코드 줄은 없었음.
- **어디서도 import되지 않는 파일**: 없음. 모든 `.py` 파일이 직접 import되거나(`hand_tracking.py`↔`guide_render.py`/`landmark_utils.py`/`notification_trigger.py`), 진입점이거나(`websocket_server.py` — `start_all.bat`에서 `python websocket_server.py`로 직접 실행), backend에서 동적 import되거나(`llm_client.py`), 명시적 보존 대상(`extract_landmarks.py`, `feedback_trigger.py`, `test_*.py`)이다.
- **`guide_render.py`, `landmark_utils.py`, `notification_trigger.py`**: 모두 `hand_tracking.py`에서 실제로 import되어 사용 중임을 확인(`HAND_CONNECTIONS`/`draw_animated_guide`, `translate_to_wrist`/`compute_palm_normal`/...,  `build_blocking_event`/`send_notification_to_backend`).
