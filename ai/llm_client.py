"""OpenAI API를 호출해 일일/월간 리포트와 처방 조정안을 생성하고 백엔드로 전송하는 클라이언트."""
import json
import os

import httpx
from dotenv import load_dotenv
from openai import OpenAI, OpenAIError

from llm_prompts import (
    build_daily_report_prompt,
    build_monthly_report_prompt,
    build_prescription_prompt,
)

load_dotenv()

MODEL = "gpt-4o-mini"
TEMPERATURE = 0.3

# AI 서버는 DB에 직접 쓰지 않고 백엔드 REST API를 통해서만 리포트를 저장한다.
# 엔드포인트 경로는 아직 확정되지 않았으므로 상수로 분리해 추후 교체하기 쉽게 한다.
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "")
LLM_REPORT_ENDPOINT = "/api/llm-reports"

_client = None


def _get_client() -> OpenAI:
    """OpenAI 클라이언트를 지연 생성해 반환(이미 생성됐으면 캐시된 인스턴스 재사용)."""
    global _client
    if _client is None:
        _client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    return _client


def _call_chat_completion(system_prompt: str, user_prompt: str, json_mode: bool = False) -> str:
    """OpenAI Chat Completion 호출 → 응답 텍스트.

    실패 시 예외(OpenAIError 등)를 그대로 전파한다 — 분류·처리는 호출자(generate_*)가 담당.
    테스트에서는 이 함수만 mock하면 실제 API 호출 없이 전체 흐름을 검증할 수 있다.
    """
    kwargs = {"response_format": {"type": "json_object"}} if json_mode else {}
    response = _get_client().chat.completions.create(
        model=MODEL,
        temperature=TEMPERATURE,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        **kwargs,
    )
    return response.choices[0].message.content


def generate_daily_report(session_data: dict) -> dict:
    """일일 임상 소견(텍스트) 생성. 예외를 던지지 않고 항상 dict로 반환."""
    system_prompt, user_prompt = build_daily_report_prompt(session_data)
    try:
        content = _call_chat_completion(system_prompt, user_prompt, json_mode=False)
    except OpenAIError as e:
        return {"report_text": None, "success": False, "error": f"OpenAI API 호출 실패: {e}"}
    except Exception as e:
        return {"report_text": None, "success": False, "error": f"알 수 없는 오류: {e}"}

    return {"report_text": content, "success": True, "error": None}


def generate_monthly_report(cumulative_data: dict) -> dict:
    """월간 누적 리포트(summary + keywords) 생성. 예외를 던지지 않고 항상 dict로 반환."""
    system_prompt, user_prompt = build_monthly_report_prompt(cumulative_data)
    try:
        content = _call_chat_completion(system_prompt, user_prompt, json_mode=True)
    except OpenAIError as e:
        return {"summary": None, "keywords": None, "success": False, "error": f"OpenAI API 호출 실패: {e}"}
    except Exception as e:
        return {"summary": None, "keywords": None, "success": False, "error": f"알 수 없는 오류: {e}"}

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        return {"summary": None, "keywords": None, "success": False, "error": f"JSON 파싱 실패: {e}"}

    return {
        "summary": parsed.get("summary"),
        "keywords": parsed.get("keywords"),
        "success": True,
        "error": None,
    }


def generate_prescription_adjustment(data: dict) -> dict:
    """처방 조정안(exercises + reason) 생성. 예외를 던지지 않고 항상 dict로 반환."""
    system_prompt, user_prompt = build_prescription_prompt(data)
    try:
        content = _call_chat_completion(system_prompt, user_prompt, json_mode=True)
    except OpenAIError as e:
        return {"exercises": None, "reason": None, "success": False, "error": f"OpenAI API 호출 실패: {e}"}
    except Exception as e:
        return {"exercises": None, "reason": None, "success": False, "error": f"알 수 없는 오류: {e}"}

    try:
        parsed = json.loads(content)
    except json.JSONDecodeError as e:
        return {"exercises": None, "reason": None, "success": False, "error": f"JSON 파싱 실패: {e}"}

    return {
        "exercises": parsed.get("exercises"),
        "reason": parsed.get("reason"),
        "success": True,
        "error": None,
    }


def send_report_to_backend(report_data: dict) -> bool:
    """report_data를 백엔드 REST API로 POST.

    report_data는 llm_report 테이블 스키마와 호환되는 키를 담는다:
    {"patient_id", "report_date", "draft_content", "exercise_blocked"}.
    성공 시 True, 실패(네트워크 오류·4xx/5xx 응답 등) 시 False — 예외를 던지지 않는다.
    """
    if not BACKEND_API_URL:
        return False
    url = f"{BACKEND_API_URL}{LLM_REPORT_ENDPOINT}"
    try:
        response = httpx.post(url, json=report_data, timeout=10.0)
        response.raise_for_status()
        return True
    except httpx.HTTPError:
        return False
