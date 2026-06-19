"""notification_trigger.py 검증 스크립트 (실제 백엔드 전송 없이 httpx.post를 mock 처리)."""
from unittest.mock import patch

import notification_trigger as nt


class _FakeResponse:
    def raise_for_status(self):
        pass


def test_completed_returns_none():
    session_data = {"end_type": "완료", "patient_id": 1, "occurred_at": "2026-06-19T14:00:00"}
    assert nt.build_blocking_event(session_data) is None
    print("[PASS] end_type=완료 → None")


def test_target_adjusted_returns_none():
    session_data = {"end_type": "목표조정", "patient_id": 1, "occurred_at": "2026-06-19T14:00:00"}
    assert nt.build_blocking_event(session_data) is None
    print("[PASS] end_type=목표조정 → None")


def test_overload_rom_event():
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


def test_overload_count_event():
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


def test_overload_unknown_cause_returns_none():
    session_data = {
        "end_type": "운동차단",
        "patient_id": 1,
        "occurred_at": "2026-06-19T14:00:00",
        "overload_cause": "unknown",
    }
    assert nt.build_blocking_event(session_data) is None
    print("[PASS] 운동차단(원인 불명) → None")


def test_safety_timeout_event():
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


def test_send_notification_success():
    with patch.object(nt.httpx, "post", return_value=_FakeResponse()) as mock_post:
        ok = nt.send_notification_to_backend({"event_type": "운동차단"})
    assert ok is True
    called_url = mock_post.call_args.args[0]
    assert called_url.endswith(nt.NOTIFICATION_ENDPOINT)
    print("[PASS] send_notification_to_backend (성공 케이스)")


def test_send_notification_failure():
    import httpx as httpx_module
    with patch.object(nt.httpx, "post", side_effect=httpx_module.ConnectError("연결 실패")):
        ok = nt.send_notification_to_backend({"event_type": "운동차단"})
    assert ok is False
    print("[PASS] send_notification_to_backend (실패 케이스)")


def test_send_notification_no_url():
    original = nt.BACKEND_API_URL
    nt.BACKEND_API_URL = ""
    try:
        ok = nt.send_notification_to_backend({"event_type": "운동차단"})
    finally:
        nt.BACKEND_API_URL = original
    assert ok is False
    print("[PASS] send_notification_to_backend (BACKEND_API_URL 미설정 케이스)")


def test_full_flow_overload_to_backend():
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
