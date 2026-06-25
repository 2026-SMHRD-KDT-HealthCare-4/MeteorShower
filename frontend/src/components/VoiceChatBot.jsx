import { useEffect, useRef, useState } from 'react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';

const RMS_THRESHOLD   = 0.012; // 이 볼륨 이상이면 목소리로 판단
const SPEECH_FRAMES   = 8;     // N프레임 연속이어야 녹음 시작 (오감지 방지)
const SILENCE_FRAMES  = 40;    // 40 × 50ms = 2초 침묵이면 자동 전송

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
    <button onClick={onClick} className="relative w-14 h-14 select-none" aria-label="챗봇 열기">
      {isSpeaking && (
        <span className="absolute inset-0 rounded-full bg-teal-400/40 animate-ping pointer-events-none" />
      )}
      <div className={`relative w-14 h-14 rounded-full bg-gradient-to-br from-teal-400 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/30 border-2 transition-all duration-200 ${isOpen ? 'border-teal-200/70 scale-105' : 'border-teal-300/40'}`}>
        <BotFace isSpeaking={isSpeaking} isRecording={isRecording} />
      </div>
      {isRecording && (
        <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-[#0c1a1a] animate-pulse pointer-events-none" />
      )}
    </button>
  );
}

export default function VoiceChatBot() {
  const [isOpen, setIsOpen]         = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [vadActive, setVadActive]     = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', text: '안녕하세요! 👂 버튼을 켜면 말할 때 자동으로 전송되고, 🎤 버튼을 길게 눌러 직접 녹음할 수도 있어요.' },
  ]);

  const audioRef       = useRef(null);
  const messagesEndRef = useRef(null);
  // push-to-talk
  const manualRecRef   = useRef(null);
  const manualChunks   = useRef([]);
  // VAD
  const vadRef         = useRef({ active: false, audioCtx: null, stream: null, recorder: null, chunks: [], speechCnt: 0, silenceCnt: 0 });
  const isLoadingRef   = useRef(false);
  const isSpeakingRef  = useRef(false);

  useEffect(() => { isLoadingRef.current = isLoading; }, [isLoading]);
  useEffect(() => { isSpeakingRef.current = isSpeaking; }, [isSpeaking]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // ── VAD (Web Audio API) ───────────────────────────────────────────
  const startVad = async () => {
    const state = vadRef.current;
    try {
      state.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessages((p) => [...p, { role: 'assistant', text: '마이크 권한이 필요합니다.' }]);
      return;
    }

    state.audioCtx = new AudioContext();
    const source   = state.audioCtx.createMediaStreamSource(state.stream);
    const analyser = state.audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const buf = new Float32Array(analyser.frequencyBinCount);
    state.speechCnt  = 0;
    state.silenceCnt = 0;
    state.recorder   = null;
    state.chunks     = [];
    state.active     = true;

    const tick = () => {
      if (!state.active) return;

      analyser.getFloatTimeDomainData(buf);
      const rms = Math.sqrt(buf.reduce((s, v) => s + v * v, 0) / buf.length);
      const loud = rms > RMS_THRESHOLD;

      if (loud) {
        state.silenceCnt = 0;
        state.speechCnt++;
        if (state.speechCnt >= SPEECH_FRAMES && !state.recorder) {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
          state.recorder = new MediaRecorder(state.stream, { mimeType });
          state.chunks   = [];
          state.recorder.ondataavailable = (e) => state.chunks.push(e.data);
          state.recorder.onstop = () => {
            const blob = new Blob(state.chunks, { type: state.recorder.mimeType });
            sendVoice(blob, state.recorder.mimeType);
            state.recorder = null;
            state.chunks   = [];
          };
          state.recorder.start();
          setIsRecording(true);
        }
      } else {
        state.speechCnt = 0;
        if (state.recorder?.state === 'recording') {
          state.silenceCnt++;
          if (state.silenceCnt >= SILENCE_FRAMES) {
            state.recorder.stop();
            setIsRecording(false);
            state.silenceCnt = 0;
          }
        }
      }
      setTimeout(tick, 50);
    };
    tick();
    setVadActive(true);
  };

  const stopVad = () => {
    const state = vadRef.current;
    state.active = false;
    state.recorder?.state === 'recording' && state.recorder.stop();
    state.stream?.getTracks().forEach((t) => t.stop());
    state.audioCtx?.close();
    state.recorder = null;
    setVadActive(false);
    setIsRecording(false);
  };

  const toggleVad = () => (vadActive ? stopVad() : startVad());

  // ── Push-to-talk ─────────────────────────────────────────────────
  const startManual = async () => {
    if (isLoading || isSpeaking || isRecording || vadActive) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
      const rec = new MediaRecorder(stream, { mimeType });
      manualRecRef.current = rec;
      manualChunks.current = [];
      rec.ondataavailable = (e) => manualChunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        sendVoice(new Blob(manualChunks.current, { type: mimeType }), mimeType);
      };
      rec.start();
      setIsRecording(true);
    } catch {
      setMessages((p) => [...p, { role: 'assistant', text: '마이크 권한이 필요합니다.' }]);
    }
  };

  const stopManual = () => {
    if (!isRecording || vadActive) return;
    manualRecRef.current?.stop();
    setIsRecording(false);
  };

  // ── 공통 전송 ─────────────────────────────────────────────────────
  const sendVoice = async (blob, mimeType) => {
    if (isLoadingRef.current || isSpeakingRef.current) return;
    setIsLoading(true);
    const ext = mimeType.includes('wav') ? 'wav' : mimeType.includes('webm') ? 'webm' : 'mp4';
    const fd  = new FormData();
    fd.append('audio', blob, `rec.${ext}`);
    fd.append('history', JSON.stringify(messages.map((m) => ({ role: m.role, content: m.text }))));

    try {
      const res  = await fetch(`${API_BASE}/chat/voice`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail ?? '서버 오류');
      const data = await res.json();
      setMessages((p) => [...p, { role: 'user', text: data.user_text }, { role: 'assistant', text: data.bot_text }]);
      const audio = new Audio(`data:audio/mp3;base64,${data.audio_base64}`);
      audioRef.current = audio;
      setIsSpeaking(true);
      audio.onended = () => setIsSpeaking(false);
      audio.play();
    } catch (err) {
      setMessages((p) => [...p, { role: 'assistant', text: err.message === '음성을 인식하지 못했습니다.' ? err.message : '오류가 발생했습니다. 다시 시도해주세요.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const statusText = isLoading
    ? '처리 중...'
    : isSpeaking
    ? '답변 중...'
    : isRecording
    ? '말씀하세요...'
    : vadActive
    ? '듣는 중 — 말하면 자동 전송'
    : '마이크를 길게 눌러 직접 녹음';

  return (
    <div className="absolute bottom-20 left-4 z-40 md:bottom-6 flex flex-col items-start gap-2">
      {isOpen && (
        <div className="w-72 bg-[#0f2020]/95 backdrop-blur-md rounded-2xl border border-teal-500/20 shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-teal-900/40 border-b border-white/10">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full transition-colors ${isSpeaking ? 'bg-teal-400 animate-pulse' : vadActive ? 'bg-green-400 animate-pulse' : 'bg-teal-700'}`} />
              <span className="text-white text-sm font-semibold">운동 도우미</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-lg leading-none">close</span>
            </button>
          </div>

          {/* Messages */}
          <div className="h-52 overflow-y-auto px-3 py-2 space-y-2">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed ${msg.role === 'user' ? 'bg-teal-500 text-white rounded-br-sm' : 'bg-white/10 text-gray-200 rounded-bl-sm'}`}>
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

          {/* Controls */}
          <div className="px-4 py-3 border-t border-white/10 flex flex-col items-center gap-2">
            <div className="flex items-center gap-3">
              {/* VAD 자동 감지 토글 */}
              <button
                onClick={toggleVad}
                disabled={isLoading || isSpeaking}
                title={vadActive ? '자동 감지 끄기' : '자동 감지 켜기'}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isLoading || isSpeaking
                    ? 'bg-white/10 cursor-not-allowed'
                    : vadActive
                    ? 'bg-green-500 shadow-lg shadow-green-500/40'
                    : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <span className="material-symbols-outlined text-white text-xl">
                  {vadActive ? 'hearing' : 'hearing_disabled'}
                </span>
              </button>

              {/* 수동 push-to-talk */}
              <button
                onMouseDown={startManual}
                onMouseUp={stopManual}
                onTouchStart={(e) => { e.preventDefault(); startManual(); }}
                onTouchEnd={stopManual}
                disabled={isLoading || vadActive}
                title="누르고 말하기"
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isLoading || vadActive
                    ? 'bg-white/10 cursor-not-allowed'
                    : isRecording
                    ? 'bg-red-500 scale-110 shadow-lg shadow-red-500/40'
                    : 'bg-teal-500 hover:bg-teal-400 active:scale-95 shadow-md shadow-teal-500/30'
                }`}
              >
                <span className="material-symbols-outlined text-white text-xl">
                  {isRecording && !vadActive ? 'mic' : 'mic_none'}
                </span>
              </button>
            </div>

            <p className="text-[10px] text-gray-500 select-none text-center">{statusText}</p>
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
