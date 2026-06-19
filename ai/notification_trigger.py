import os

import httpx

# 엔드포인트는 아직 확정되지 않았으므로 상수로 분리해 추후 교체하기 쉽게 한다.
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "")
NOTIFICATION_ENDPOINT = "/api/doctor-notifications"

# hand_tracking.py의 실제 과부하/세션 종료 로직 기준으로 정의된 코드.
#
# OVERLOAD_ROM   : compute_overload_rom(landmarks) > TARGET_ROM(기본 0.8) 으로 강제 종료.
#                  손목-손가락끝 평균 거리(스칼라) 기준이라 손가락별 각도가 아님 → "finger" 없음.
# OVERLOAD_COUNT : count > ex["target_count"] 로 강제 종료. 세트 완료 시 count가 즉시
#                  0으로 리셋되므로 실제로는 거의 발생하지 않는 방어적 분기.
# SAFETY_TIMEOUT : red 신호 장시간 지속 등 안전종료. 현재 hand_tracking.py에는 이 사유로
#                  세션을 강제 종료하는 코드가 없음 — feedback_trigger.py와 연동해
#                  추후 실제 트리거를 추가할 수 있도록 코드만 미리 정의해 둔다.
# QUESTIONNAIRE_BLOCK : 사전 문진 차단은 AI 세션이 시작되기 전 프론트엔드에서 처리되므로
#                  AI가 관측할 수 없는 이벤트라 이 모듈에서 다루지 않는다.
REASON_CODE_OVERLOAD_ROM   = "OVERLOAD_ROM"
REASON_CODE_OVERLOAD_COUNT = "OVERLOAD_COUNT"
REASON_CODE_SAFETY_TIMEOUT = "SAFETY_TIMEOUT"

_NOTIFIABLE_END_TYPES = ("안전종료", "운동차단")


def build_blocking_event(session_data: dict):
    """세션 종료 데이터(session_data) → doctor_notification용 구조화 이벤트.

    end_type이 "완료" 또는 "목표조정"이면 알림 대상이 아니므로 None을 반환한다.

    session_data 공통 필수 키:
      - end_type:    "완료" | "목표조정" | "안전종료" | "운동차단"
      - patient_id:  int
      - occurred_at: ISO 8601 문자열

    end_type == "운동차단"일 때 추가 필요:
      - overload_cause: "rom" | "count"
      - "rom"인 경우  : measured_rom, threshold_rom
      - "count"인 경우: measured_count, target_count, exercise_name

    end_type == "안전종료"일 때 추가 필요:
      - finger (한글 이름), signal_level ("red"|"yellow"), duration_sec

    선택: doctor_id (있으면 그대로 포함).
    """
    end_type = session_data.get("end_type")
    if end_type not in _NOTIFIABLE_END_TYPES:
        return None

    event = {
        "event_type":  end_type,
        "patient_id":  session_data["patient_id"],
        "occurred_at": session_data["occurred_at"],
    }
    if "doctor_id" in session_data:
        event["doctor_id"] = session_data["doctor_id"]

    if end_type == "운동차단":
        cause = session_data.get("overload_cause")
        if cause == "rom":
            event["reason_code"] = REASON_CODE_OVERLOAD_ROM
            event["details"] = {
                "metric":          "WRIST_TO_FINGERTIP_DISTANCE",
                "measured_value":  session_data["measured_rom"],
                "threshold_value": session_data["threshold_rom"],
            }
        elif cause == "count":
            event["reason_code"] = REASON_CODE_OVERLOAD_COUNT
            event["details"] = {
                "metric":          "COUNT",
                "measured_value":  session_data["measured_count"],
                "threshold_value": session_data["target_count"],
                "exercise":        session_data["exercise_name"],
            }
        else:
            return None   # 원인 불명 → 이벤트 생성 보류
    else:  # "안전종료"
        event["reason_code"] = REASON_CODE_SAFETY_TIMEOUT
        event["details"] = {
            "finger":       session_data["finger"],
            "signal":       session_data["signal_level"],
            "duration_sec": session_data["duration_sec"],
        }

    return event


def send_notification_to_backend(event_data: dict) -> bool:
    """event_data를 백엔드 REST API로 POST.

    성공 시 True, 실패(네트워크 오류·4xx/5xx 응답 등) 시 False — 예외를 던지지 않는다.
    """
    if not BACKEND_API_URL:
        return False
    url = f"{BACKEND_API_URL}{NOTIFICATION_ENDPOINT}"
    try:
        response = httpx.post(url, json=event_data, timeout=10.0)
        response.raise_for_status()
        return True
    except httpx.HTTPError:
        return False
