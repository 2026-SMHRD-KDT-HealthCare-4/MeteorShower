"""llm_client.py 데이터 흐름 검증용 스크립트 (mock 기반, 실제 OpenAI 호출 없음).

OpenAI 계정에 크레딧이 없어도 동작 확인 가능: _call_chat_completion()과
httpx.post()를 mock으로 대체해 "프롬프트 생성 → LLM 호출 → 응답 파싱 →
백엔드 전송"까지 전체 흐름만 검증한다. 실제 운영 코드는 호출하지 않음.
"""
import json
from unittest.mock import patch

from openai import OpenAIError

import llm_client

SAMPLE_DAILY = {
    "patient_name": "홍길동", "gender": "남", "birth_date": "1950-01-01",
    "surgery_name": "수근관절 수술", "surgery_date": "2026-05-01",
    "rehab_start_date": "2026-05-10", "rehab_stage": "2단계",
    "session_date": "2026-06-18", "session_status": "정상종료",
    "is_blocked": False,
    "exercise_duration": 20, "exercise_list": "full_fist, tapping",
    "overall_compliance": 85, "accuracy_average": 80,
    "thumb_score": 90, "index_score": 85, "middle_score": 80, "ring_score": 75, "pinky_score": 70,
    "thumb_mcp": 100, "thumb_ip": 80,
    "index_mcp": 90, "index_pip": 80, "index_dip": 70,
    "middle_mcp": 90, "middle_pip": 80, "middle_dip": 70,
    "ring_mcp": 90, "ring_pip": 80, "ring_dip": 70,
    "pinky_mcp": 90, "pinky_pip": 80, "pinky_dip": 70,
    "questionnaire_result": "특이사항 없음",
    "overload_occurred": "없음",
}

SAMPLE_MONTHLY = {
    "patient_name": "홍길동", "surgery_name": "수근관절 수술", "rehab_duration": 4, "exercise_count": 2,
    "weekly_data": [{"week": 1, "achievement": 80, "compliance": 75, "block_count": 0, "overload_count": 1}],
    "exercise_data": [{"name": "full_fist", "achievement": 90, "compliance": 85}],
    "rom_data": [{"finger": "검지", "joint": "PIP", "target": 90, "min": 60, "max": 95, "achievement": 85}],
}

SAMPLE_PRESCRIPTION = {
    "overall_compliance": 70, "session_status": "정상종료", "overload_occurred": "없음",
    "finger_scores": {"thumb": 90}, "finger_rom": {"thumb": 100},
    "weekly_achievement": [80, 85], "weekly_compliance": [70, 75], "total_overload_count": 2,
    "current_exercises": ["full_fist"], "current_sets": 3, "current_reps": 10,
    "target_rom": 90, "target_count": 10,
}


class _FakeResponse:
    def raise_for_status(self) -> None:
        pass


def test_daily_report_success() -> None:
    with patch.object(llm_client, "_call_chat_completion", return_value="- 정상 수행, ROM 양호"):
        result = llm_client.generate_daily_report(SAMPLE_DAILY)
    assert result == {"report_text": "- 정상 수행, ROM 양호", "success": True, "error": None}
    print("[PASS] generate_daily_report (성공 케이스)")


def test_daily_report_api_failure() -> None:
    with patch.object(llm_client, "_call_chat_completion", side_effect=OpenAIError("rate limit exceeded")):
        result = llm_client.generate_daily_report(SAMPLE_DAILY)
    assert result["success"] is False
    assert result["report_text"] is None
    assert "OpenAI API 호출 실패" in result["error"]
    print("[PASS] generate_daily_report (API 실패 케이스)")


def test_monthly_report_success() -> None:
    mock_json = json.dumps({"summary": "재활 경과가 양호합니다.", "keywords": ["호전", "순응도"]})
    with patch.object(llm_client, "_call_chat_completion", return_value=mock_json):
        result = llm_client.generate_monthly_report(SAMPLE_MONTHLY)
    assert result["success"] is True
    assert result["summary"] == "재활 경과가 양호합니다."
    assert result["keywords"] == ["호전", "순응도"]
    print("[PASS] generate_monthly_report (성공 케이스)")


def test_monthly_report_json_parse_failure() -> None:
    with patch.object(llm_client, "_call_chat_completion", return_value="이건 JSON이 아닙니다"):
        result = llm_client.generate_monthly_report(SAMPLE_MONTHLY)
    assert result["success"] is False
    assert "JSON 파싱 실패" in result["error"]
    print("[PASS] generate_monthly_report (JSON 파싱 실패 케이스)")


def test_prescription_success() -> None:
    mock_json = json.dumps({
        "exercises": [{"name": "full_fist", "sets": 3, "reps": 8}],
        "reason": "과부하 이력으로 횟수를 소폭 하향 조정했습니다.",
    })
    with patch.object(llm_client, "_call_chat_completion", return_value=mock_json):
        result = llm_client.generate_prescription_adjustment(SAMPLE_PRESCRIPTION)
    assert result["success"] is True
    assert result["exercises"][0]["name"] == "full_fist"
    print("[PASS] generate_prescription_adjustment (성공 케이스)")


def test_prescription_api_failure() -> None:
    with patch.object(llm_client, "_call_chat_completion", side_effect=OpenAIError("insufficient_quota")):
        result = llm_client.generate_prescription_adjustment(SAMPLE_PRESCRIPTION)
    assert result["success"] is False
    assert result["exercises"] is None and result["reason"] is None
    assert "OpenAI API 호출 실패" in result["error"]
    print("[PASS] generate_prescription_adjustment (API 실패 케이스)")


def test_send_report_to_backend_success() -> None:
    with patch.object(llm_client.httpx, "post", return_value=_FakeResponse()) as mock_post:
        ok = llm_client.send_report_to_backend({
            "patient_id": 1,
            "report_date": "2026-06-18",
            "draft_content": "테스트 리포트 본문",
            "exercise_blocked": False,
        })
    assert ok is True
    called_url = mock_post.call_args.args[0]
    assert called_url.endswith(llm_client.LLM_REPORT_ENDPOINT)
    print("[PASS] send_report_to_backend (성공 케이스)")


def test_send_report_to_backend_failure() -> None:
    import httpx as httpx_module
    with patch.object(llm_client.httpx, "post", side_effect=httpx_module.ConnectError("연결 실패")):
        ok = llm_client.send_report_to_backend({
            "patient_id": 1,
            "report_date": "2026-06-18",
            "draft_content": "테스트 리포트 본문",
            "exercise_blocked": False,
        })
    assert ok is False
    print("[PASS] send_report_to_backend (실패 케이스)")


def test_send_report_to_backend_no_url() -> None:
    original = llm_client.BACKEND_API_URL
    llm_client.BACKEND_API_URL = ""
    try:
        ok = llm_client.send_report_to_backend({"patient_id": 1})
    finally:
        llm_client.BACKEND_API_URL = original
    assert ok is False
    print("[PASS] send_report_to_backend (BACKEND_API_URL 미설정 케이스)")


def test_full_flow_daily_to_backend() -> None:
    """프롬프트 생성 → LLM 호출 → 응답 파싱 → 백엔드 전송까지 전체 흐름."""
    with patch.object(llm_client, "_call_chat_completion", return_value="- 차단 없이 정상 수행됨\n- ROM 양호"):
        report = llm_client.generate_daily_report(SAMPLE_DAILY)
    assert report["success"]

    report_data = {
        "patient_id": 1,
        "report_date": SAMPLE_DAILY["session_date"],
        "draft_content": report["report_text"],
        "exercise_blocked": SAMPLE_DAILY["is_blocked"],
    }

    with patch.object(llm_client.httpx, "post", return_value=_FakeResponse()):
        ok = llm_client.send_report_to_backend(report_data)
    assert ok is True
    print("[PASS] 전체 흐름 (daily report 생성 → 파싱 → backend 전송)")


if __name__ == "__main__":
    test_daily_report_success()
    test_daily_report_api_failure()
    test_monthly_report_success()
    test_monthly_report_json_parse_failure()
    test_prescription_success()
    test_prescription_api_failure()
    test_send_report_to_backend_success()
    test_send_report_to_backend_failure()
    test_send_report_to_backend_no_url()
    test_full_flow_daily_to_backend()
    print("\nALL TESTS PASSED")
