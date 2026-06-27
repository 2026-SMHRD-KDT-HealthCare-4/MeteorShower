import base64
import json
import os

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from openai import AsyncOpenAI

import rag
from utils.profanity import contains_profanity

router = APIRouter(prefix="/chat", tags=["chat"])
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

_BASE_SYSTEM = (
    "# Role\n"
    "- 당신은 노인들의 손 재활 운동을 돕는 친절하고 다정한 'AI 보조사'입니다.\n\n"

    "# Task & Scope\n"
    "- 손 재활 운동 방법, 통증 관리, 진행 상황 격려 등 재활 관련 질문에 성실하게 답변하세요.\n"
    "- 사용자가 외로움을 느끼지 않도록 따뜻한 일상적인 대화도 자연스럽게 나누세요.\n\n"

    "# Constraints (핵심 제약 조건)\n"
    "1. [문장 길이]: 모든 답변은 반드시 '2문장 이내'로 간결하게 작성하세요. (시니어 사용자의 가독성을 위함)\n"
    "2. [어조]: 항상 친근하고 따뜻한 '존댓말'을 사용하세요. (예: ~하셨어요?, ~해볼까요?)\n"
    "3. [쉬운 표현]: 노인 대상 서비스이므로 어려운 전문 용어는 피하고 알기 쉽게 설명하세요."
)

_PROFANITY_REPLY = "죄송해요, 좋은 말로 대화해요. 운동이나 재활에 대해 궁금한 게 있으면 편하게 물어보세요!"


def _build_system(rag_context: str) -> str:
    # RAG 검색 결과가 있을 때만 기본 시스템 프롬프트에 운동 정보를 추가
    if not rag_context:
        return _BASE_SYSTEM
    return (
        _BASE_SYSTEM
        + "\n\n아래는 관련 운동 정보입니다. 필요할 때 참고하세요:\n"
        + rag_context
    )


@router.post("/voice")
async def voice_chat(
    audio: UploadFile = File(...),
    history: str = Form(default="[]"),
) -> dict:
    # Whisper STT → 욕설 필터 → RAG 검색 → GPT 답변 → TTS 순서로 처리
    audio_bytes = await audio.read()

    # 1. Whisper STT
    transcript = await client.audio.transcriptions.create(
        model="whisper-1",
        file=(audio.filename, audio_bytes, audio.content_type),
    )
    user_text = transcript.text.strip()
    if not user_text:
        raise HTTPException(status_code=422, detail="음성을 인식하지 못했습니다.")

    # 2. 욕설 필터링
    if contains_profanity(user_text):
        speech = await client.audio.speech.create(
            model="tts-1", voice="nova", input=_PROFANITY_REPLY
        )
        return {
            "user_text": user_text,
            "bot_text": _PROFANITY_REPLY,
            "audio_base64": base64.b64encode(speech.content).decode(),
        }

    # 3. RAG 검색
    rag_context = rag.search_exercises(user_text)

    # 4. GPT
    try:
        msg_history = json.loads(history)
    except json.JSONDecodeError:
        msg_history = []

    messages = (
        [{"role": "system", "content": _build_system(rag_context)}]
        + [{"role": m["role"], "content": m["content"]} for m in msg_history]
        + [{"role": "user", "content": user_text}]
    )
    completion = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    bot_text = completion.choices[0].message.content

    # 5. TTS
    speech = await client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input=bot_text,
    )

    return {
        "user_text": user_text,
        "bot_text": bot_text,
        "audio_base64": base64.b64encode(speech.content).decode(),
    }


class TtsRequest(BaseModel):
    text: str


@router.post("/tts")
async def text_to_speech(body: TtsRequest) -> dict:
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="text is empty")
    speech = await client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input=body.text,
    )
    return {"audio_base64": base64.b64encode(speech.content).decode()}
