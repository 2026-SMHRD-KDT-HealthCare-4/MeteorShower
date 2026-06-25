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
    "당신은 손 재활 운동을 돕는 친절한 AI 보조사입니다. "
    "운동 방법, 통증 관리, 진행 상황 격려 등 재활 관련 질문에 성실하게 답변하고, "
    "일상적인 대화도 자연스럽게 나눌 수 있습니다. "
    "답변은 2~3문장으로 간결하게 해주세요."
)

_PROFANITY_REPLY = "죄송해요, 좋은 말로 대화해요 😊 운동이나 재활에 대해 궁금한 게 있으면 편하게 물어보세요!"


def _build_system(rag_context: str) -> str:
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
):
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
async def text_to_speech(body: TtsRequest):
    if not body.text.strip():
        raise HTTPException(status_code=422, detail="text is empty")
    speech = await client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input=body.text,
    )
    return {"audio_base64": base64.b64encode(speech.content).decode()}
