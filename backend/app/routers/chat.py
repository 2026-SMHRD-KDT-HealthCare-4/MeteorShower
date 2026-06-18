import base64
import json
import os

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from openai import AsyncOpenAI

router = APIRouter(prefix="/chat", tags=["chat"])
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))

SYSTEM_PROMPT = (
    "당신은 손 재활 운동을 돕는 AI 보조사입니다. "
    "환자가 운동 중 궁금한 점을 음성으로 질문합니다. "
    "운동 방법, 통증 관리, 진행 상황 격려 등에 친절하고 간결하게 답변하세요. "
    "답변은 2~3문장으로 짧게 해주세요."
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

    # 2. GPT
    try:
        msg_history = json.loads(history)
    except json.JSONDecodeError:
        msg_history = []

    messages = (
        [{"role": "system", "content": SYSTEM_PROMPT}]
        + [{"role": m["role"], "content": m["content"]} for m in msg_history]
        + [{"role": "user", "content": user_text}]
    )
    completion = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
    )
    bot_text = completion.choices[0].message.content

    # 3. TTS
    speech = await client.audio.speech.create(
        model="tts-1",
        voice="nova",
        input=bot_text,
    )
    audio_base64 = base64.b64encode(speech.content).decode()

    return {
        "user_text": user_text,
        "bot_text": bot_text,
        "audio_base64": audio_base64,
    }