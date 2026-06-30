"""notification_trigger.py 검증 스크립트 (실제 백엔드 전송 없이 httpx.post를 mock 처리)."""
from unittest.mock import patch

import notification_trigger as nt


class _FakeResponse:
    """httpx.Response의 최소 mock — raise_for_status()가 항상 성공으로 통과한다."""

    def raise_for_status(self) -> None:
        """4xx/5xx 에러가 없는 것처럼 동작하는 no-op."""
        pass


def test_completed_returns_none() -> None:
    """end_type이 '완료'이면 알림 이벤트를 생성하지 않고 None을 반환하는지 검증."""
    session_data = {"end_type": "완료", "patient_id": 1, "occurred_at": "2026-06-19T14:00:00"}
    assert nt.build_blocking_event(session_data) is None
    print("[PASS] end_type=완료 → None")


def test_target_adjusted_returns_none() -> None:
    """end_type이 '목표조정'이면 None을 반환하는지 검증."""
    session_data = {"end_type": "목표조정", "patient_id": 1, "occurred_at": "2026-06-19T14:00:00"}
    assert nt.build_blocking_event(session_data) is None
    print("[PASS] end_type=목표조정 → None")


def test_overload_rom_event() -> None:
    """overload_cause='rom'일 때 OVERLOAD_ROM 이벤트 구조가 올바른지 검증."""
    session_data = {
        "end_type": "운동차단",
        "patient_id": 1,
        "occurred_at": "2026-06-19T14:32:10",
        "overload_cause": "rom",
        "measured_rom": 0.91,
        "threshold_rom": 0.8,
    }
    event = nt.build_blocking_event(session_data)
    assert event == {
        "event_type":  "운동차단",
        "patient_id":  1,
        "occurred_at": "2026-06-19T14:32:10",
        "reason_code": "OVERLOAD_ROM",
        "details": {
            "metric":          "WRIST_TO_FINGERTIP_DISTANCE",
            "measured_value":  0.91,
            "threshold_value": 0.8,
        },
    }
    print("[PASS] 운동차단(rom) → OVERLOAD_ROM 이벤트")


def test_overload_count_event() -> None:
    """overload_cause='count'일 때 OVERLOAD_COUNT 이벤트에 doctor_id까지 포함되는지 검증."""
    session_data = {
        "end_type": "운동차단",
        "patient_id": 2,
        "doctor_id": 7,
        "occurred_at": "2026-06-19T14:40:00",
        "overload_cause": "count",
        "measured_count": 11,
        "target_count": 7,
        "exercise_name": "full_fist",
    }
    event = nt.build_blocking_event(session_data)
    assert event["reason_code"] == "OVERLOAD_COUNT"
    assert event["doctor_id"] == 7
    assert event["details"] == {
        "metric":          "COUNT",
        "measured_value":  11,
        "threshold_value": 7,
        "exercise":        "full_fist",
    }
    print("[PASS] 운동차단(count) → OVERLOAD_COUNT 이벤트, doctor_id 포함")


def test_overload_unknown_cause_returns_none() -> None:
    """overload_cause가 알 수 없는 값이면 None을 반환하는지 검증."""
    session_data = {
        "end_type": "운동차단",
        "patient_id": 1,
        "occurred_at": "2026-06-19T14:00:00",
        "overload_cause": "unknown",
    }
    assert nt.build_blocking_event(session_data) is None
    print("[PASS] 운동차단(원인 불명) → None")


def test_safety_timeout_event() -> None:
    """안전종료 이벤트가 SAFETY_TIMEOUT 코드와 손가락·신호 상세를 포함하는지 검증."""
    session_data = {
        "end_type": "안전종료",
        "patient_id": 3,
        "occurred_at": "2026-06-19T15:00:00",
        "finger": "약지",
        "signal_level": "red",
        "duration_sec": 12.4,
    }
    event = nt.build_blocking_event(session_data)
    assert event["reason_code"] == "SAFETY_TIMEOUT"
    assert event["details"] == {"finger": "약지", "signal": "red", "duration_sec": 12.4}
    print("[PASS] 안전종료 → SAFETY_TIMEOUT 이벤트")


def test_send_notification_success() -> None:
    """HTTP POST가 성공하면 True를 반환하고 올바른 엔드포인트로 전송하는지 검증."""
    with patch.object(nt.httpx, "post", return_value=_FakeResponse()) as mock_post:
        ok = nt.send_notification_to_backend({"event_type": "운동차단"})
    assert ok is True
    called_url = mock_post.call_args.args[0]
    assert called_url.endswith(nt.NOTIFICATION_ENDPOINT)
    print("[PASS] send_notification_to_backend (성공 케이스)")


def test_send_notification_failure() -> None:
    """네트워크 오류 시 예외 없이 False를 반환하는지 검증."""
    import httpx as httpx_module
    with patch.object(nt.httpx, "post", side_effect=httpx_module.ConnectError("연결 실패")):
        ok = nt.send_notification_to_backend({"event_type": "운동차단"})
    assert ok is False
    print("[PASS] send_notification_to_backend (실패 케이스)")


def test_send_notification_no_url() -> None:
    """BACKEND_API_URL이 비어있으면 HTTP 호출 없이 False를 반환하는지 검증."""
    original = nt.BACKEND_API_URL
    nt.BACKEND_API_URL = ""
    try:
        ok = nt.send_notification_to_backend({"event_type": "운동차단"})
    finally:
        nt.BACKEND_API_URL = original
    assert ok is False
    print("[PASS] send_notification_to_backend (BACKEND_API_URL 미설정 케이스)")


def test_full_flow_overload_to_backend() -> None:
    """이벤트 생성 → 백엔드 전송까지 전체 흐름이 정상 동작하는지 검증."""
    session_data = {
        "end_type": "운동차단",
        "patient_id": 1,
        "occurred_at": "2026-06-19T14:32:10",
        "overload_cause": "rom",
        "measured_rom": 0.91,
        "threshold_rom": 0.8,
    }
    event = nt.build_blocking_event(session_data)
    assert event is not None

    with patch.object(nt.httpx, "post", return_value=_FakeResponse()):
        ok = nt.send_notification_to_backend(event)
    assert ok is True
    print("[PASS] 전체 흐름 (이벤트 생성 → backend 전송)")


if __name__ == "__main__":
    test_completed_returns_none()
    test_target_adjusted_returns_none()
    test_overload_rom_event()
    test_overload_count_event()
    test_overload_unknown_cause_returns_none()
    test_safety_timeout_event()
    test_send_notification_success()
    test_send_notification_failure()
    test_send_notification_no_url()
    test_full_flow_overload_to_backend()
    print("\nALL TESTS PASSED")
