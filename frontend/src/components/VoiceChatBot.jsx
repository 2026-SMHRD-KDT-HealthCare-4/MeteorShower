import { useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';

function BotFace({ isSpeaking, isRecording }) {
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none">
      <line x1="20" y1="1" x2="20" y2="7" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="4" r="2.5" fill={isRecording ? '#ef4444' : '#99f6e4'} />
      <circle cx="14" cy="17" r="4" fill="white" />
      <circle cx="26" cy="17" r="4" fill="white" />
      <circle cx="15" cy="18" r="2" fill="#0a2020" />
      <circle cx="27" cy="18" r="2" fill="#0a2020" />
      <circle cx="15.8" cy="16.2" r="0.8" fill="rgba(255,255,255,0.9)" />
      <circle cx="27.8" cy="16.2" r="0.8" fill="rgba(255,255,255,0.9)" />
      {isSpeaking || isRecording ? (
        <ellipse cx="20" cy="29" rx="5" ry="3" fill="white" />
      ) : (
        <path d="M14 28 Q20 33 26 28" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
      )}
    </svg>
  );
}

function BotCharacter({ isSpeaking, isRecording, isOpen, onClick }) {
  return (
    <button
      onClick={onClick}
      className="relative w-14 h-14 select-none"
      aria-label="챗봇 열기"
    >
      {isSpeaking && (
        <span className="absolute inset-0 rounded-full bg-teal-400/40 animate-ping pointer-events-none" />
      )}
      <div
        className={`relative w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/30 border-2 transition-all duration-200 ${
          isOpen ? 'border-teal-200/70 scale-105' : 'border-teal-300/40'
        }`}
      >
        <BotFace isSpeaking={isSpeaking} isRecording={isRecording} />
      </div>
      {isRecording && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#0c1a1a] animate-pulse pointer-events-none" />
      )}
    </button>
  );
}

export default function VoiceChatBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '안녕하세요! 운동 중 궁금한 점이 있으면 아래 마이크를 눌러 질문해주세요.' },
  ]);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const startRecording = async () => {
    if (isLoading || isSpeaking || isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        sendVoice(blob, mimeType);
      };

      recorder.start();
      setIsRecording(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '마이크 권한이 필요합니다. 브라우저 설정을 확인해주세요.' },
      ]);
    }
  };

  const stopRecording = () => {
    if (!isRecording) return;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const sendVoice = async (blob, mimeType) => {
    setIsLoading(true);
    const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
    const formData = new FormData();
    formData.append('audio', blob, `recording.${ext}`);
    formData.append(
      'history',
      JSON.stringify(messages.map((m) => ({ role: m.role, content: m.text })))
    );

    try {
      const res = await fetch(`${API_BASE}/chat/voice`, { method: 'POST', body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail ?? '서버 오류');
      }
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { role: 'user', text: data.user_text },
        { role: 'assistant', text: data.bot_text },
      ]);

      const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
      audioRef.current = audio;
      setIsSpeaking(true);
      audio.onended = () => setIsSpeaking(false);
      audio.play();
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: err.message === '음성을 인식하지 못했습니다.' ? err.message : '오류가 발생했습니다. 다시 시도해주세요.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="absolute bottom-20 left-4 z-40 md:bottom-6 flex flex-col items-start gap-2">
      {isOpen && (
        <div className="w-72 bg-[#0f2020]/95 backdrop-blur-md rounded-2xl border border-teal-500/20 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-teal-900/40 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full transition-colors ${
                  isSpeaking ? 'bg-teal-400 animate-pulse' : 'bg-teal-700'
                }`}
              />
              <span className="text-white text-sm font-semibold">운동 도우미</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-lg leading-none">close</span>
            </button>
          </div>

          {/* Messages */}
          <div className="h-52 overflow-y-auto px-3 py-2 space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-teal-500 text-white rounded-br-sm'
                      : 'bg-white/10 text-gray-200 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white/10 px-3 py-2 rounded-2xl rounded-bl-sm flex gap-1">
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Mic button */}
          <div className="px-4 py-3 border-t border-white/10 flex flex-col items-center gap-1">
            <button
              onMouseDown={startRecording}
              onMouseUp={stopRecording}
              onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
              onTouchEnd={stopRecording}
              disabled={isLoading}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                isLoading
                  ? 'bg-white/10 cursor-not-allowed'
                  : isRecording
                  ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/40'
                  : 'bg-teal-500 hover:bg-teal-400 active:scale-95 shadow-md shadow-teal-500/30'
              }`}
            >
              <span className="material-symbols-outlined text-white text-xl">
                {isRecording ? 'mic' : 'mic_none'}
              </span>
            </button>
            <p className="text-[10px] text-gray-500 select-none">
              {isLoading
                ? '처리 중...'
                : isRecording
                ? '말씀하세요 — 놓으면 전송'
                : '누르고 말하기'}
            </p>
          </div>
        </div>
      )}

      <BotCharacter
        isSpeaking={isSpeaking}
        isRecording={isRecording}
        isOpen={isOpen}
        onClick={() => setIsOpen((o) => !o)}
      />
    </div>
  );
}