import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { patientApi } from '../../api';
import VoiceChatBot from '../../components/VoiceChatBot';

const WS_URL = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8000/ws';

// 운동 카드 이름(예: "왼손 태핑 (Tapping)", "오른손 그립 (Grip)")에서
// 손(hand)과 운동 종류(exercise_name)를 추출.
// 좌/우는 손 방향(가이드 미러링)만 결정하고, 운동 종류는 태핑 여부로만 결정한다.
function parseExerciseName(name = '') {
  const hand = name.includes('왼손') ? 'left' : 'right';
  const isTapping = ['태핑', 'tapping', '두드리기'].some((kw) => name.toLowerCase().includes(kw.toLowerCase()));
  const exerciseName = isTapping ? 'tapping' : 'full_fist';
  return { hand, exerciseName };
}

const HAND_LABEL = { left: '왼손', right: '오른손' };
const TYPE_LABEL = { full_fist: '그립', tapping: '태핑' };

export default function ExerciseSession() {
  const navigate = useNavigate();
  const location = useLocation();
  const exerciseInfo = location.state?.exercise;
  const [showModal, setShowModal] = useState(false);
  const [phase, setPhase]         = useState('idle'); // idle | connecting | running | ended
  const [frame, setFrame]         = useState(null);
  const [wsData, setWsData]       = useState(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [selectedHand, setSelectedHand] = useState(null); // 세션 시작 시 보낸 hand('left'/'right')

  const wsRef    = useRef(null);
  const phaseRef = useRef('idle');
  const savedRef = useRef(false);
  const latestDataRef = useRef(null);

  const updatePhase = (p) => { phaseRef.current = p; setPhase(p); };

  const saveExerciseResult = useCallback((endType = '완료') => {
    if (savedRef.current || !exerciseInfo?.schedule_id) return Promise.resolve();
    savedRef.current = true;
    const latest = latestDataRef.current ?? {};
    const progress = latest.similarity == null ? null : Number(latest.similarity.toFixed(2));

    return patientApi.saveExerciseSession({
      schedule_id: exerciseInfo.schedule_id,
      performed_reps: latest.count ?? 0,
      performed_sets: latest.set ?? exerciseInfo.sets ?? 1,
      progress_rate: progress,
      end_type: endType,
    })
      .then(() => setSaveMessage('운동 결과가 저장되었습니다.'))
      .catch((err) => {
        savedRef.current = false;
        setSaveMessage(err.message);
      });
  }, [exerciseInfo]);

  const stopSession = useCallback(() => {
    if (wsRef.current) {
      try { wsRef.current.send(JSON.stringify({ action: 'stop' })); } catch {}
      wsRef.current.close();
      wsRef.current = null;
    }
    updatePhase('idle');
    setFrame(null);
    setWsData(null);
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    updatePhase('connecting');

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      const { hand, exerciseName } = parseExerciseName(exerciseInfo?.name);
      setSelectedHand(hand);
      ws.send(JSON.stringify({ action: 'start', hand, exercise_name: exerciseName }));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.status === 'tracking_started') {
        updatePhase('running');
        return;
      }
      if (msg.frame) setFrame(msg.frame);
      setWsData(msg);
      latestDataRef.current = msg;
      if (msg.session_end) {
        saveExerciseResult('완료').finally(() => updatePhase('ended'));
      }
    };

    ws.onerror = () => updatePhase('idle');
    ws.onclose = () => {
      if (phaseRef.current !== 'ended') updatePhase('idle');
    };
  }, [saveExerciseResult, exerciseInfo]);

  useEffect(() => () => wsRef.current?.close(), []);

  const similarity    = wsData?.similarity ?? null;
  const count         = wsData?.count ?? 0;
  const targetCount   = wsData?.target_count ?? exerciseInfo?.reps ?? 10;
  const set           = wsData?.set ?? 1;
  const totalSets     = wsData?.total_sets ?? 2;
  const exercise      = wsData?.exercise ?? '—';
  const signal        = wsData?.signal ?? 'gray';
  // 실제로 추적 중인 hand(시작 시 보낸 값) + exercise(서버가 확인해준 값)를 조합 —
  // 화면 표시가 항상 실제 추적 상태와 일치하도록 함. 서버 응답 전(연결 중)에는
  // 선택했던 카드 이름으로 대체 표시.
  const exerciseLabel = (selectedHand && TYPE_LABEL[exercise])
    ? `${HAND_LABEL[selectedHand]} ${TYPE_LABEL[exercise]}`
    : (exerciseInfo?.name ?? '—');
  const accuracyLabel = similarity == null ? '—' : similarity >= 80 ? 'Excellent' : similarity >= 50 ? 'Good' : 'Keep Going';
  const signalClass   = signal === 'green' ? 'text-teal-300' : signal === 'yellow' ? 'text-yellow-300' : 'text-red-400';
  const barClass      = signal === 'green' ? 'bg-teal-400'   : signal === 'yellow' ? 'bg-yellow-400'   : 'bg-red-400';

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0c1a1a]">

      {/* 카메라 프레임 */}
      {frame ? (
        <img
          src={`data:image/jpeg;base64,${frame}`}
          alt=""
          className="absolute inset-0 w-full h-full object-contain"
        />
      ) : (
        <div className="absolute inset-0 bg-[#0c1a1a]" />
      )}
      <div className="absolute inset-0 bg-black/30" />

      {/* running이지만 frame이 아직 없을 때 */}
      {phase === 'running' && !frame && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
          <span className="material-symbols-outlined animate-spin text-teal-400 text-4xl">progress_activity</span>
          <p className="text-white text-sm">카메라 연결 중... (최대 30초 소요)</p>
        </div>
      )}

      {/* idle: 시작 버튼 */}
      {phase === 'idle' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-6">
          <div className="text-center">
            <p className="text-white text-2xl font-bold mb-2">운동을 시작할 준비가 됐나요?</p>
            <p className="text-gray-400 text-sm">AI 서버(포트 8000)에 연결 후 카메라가 켜집니다</p>
          </div>
          <button
            onClick={connect}
            className="px-10 py-4 bg-teal-500 hover:bg-teal-400 text-white font-bold text-lg rounded-2xl shadow-xl shadow-teal-500/30 active:scale-95 transition-all"
          >
            운동 시작하기
          </button>
        </div>
      )}

      {/* connecting */}
      {phase === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <span className="material-symbols-outlined animate-spin text-teal-400 text-5xl">progress_activity</span>
            <p className="text-white mt-4 text-lg">카메라 초기화 중...</p>
          </div>
        </div>
      )}

      {/* session ended overlay */}
      {phase === 'ended' && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-30">
          <div className="text-center">
            <span className="material-symbols-outlined text-teal-400 text-6xl mb-4 block">check_circle</span>
            <p className="text-white text-3xl font-bold mb-2">운동 완료!</p>
            <p className="text-gray-300 text-sm mb-2">수고하셨습니다</p>
            {saveMessage && <p className="text-teal-300 text-sm mb-6">{saveMessage}</p>}
            <button
              onClick={() => { stopSession(); navigate('/patient/exercise'); }}
              className="px-8 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all"
            >
              돌아가기
            </button>
          </div>
        </div>
      )}

      {/* 우측 패널 */}
      {phase === 'running' && (
        <div className="hidden md:flex absolute right-5 top-5 flex-col gap-4 w-60">
          <div className="bg-black/45 backdrop-blur-md rounded-xl p-4 border border-white/10">
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Current Phase</p>
            <h3 className="text-white font-bold text-base">{exerciseLabel}</h3>
          </div>

          <div className="bg-black/45 backdrop-blur-md rounded-xl p-4 border border-white/10">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-300 text-xs">일치율 (Accuracy)</span>
              <span className={`text-xs font-bold ${signalClass}`}>{accuracyLabel}</span>
            </div>
            <p className={`text-2xl font-bold mb-2 ${signalClass}`}>
              {similarity != null ? `${similarity.toFixed(0)}%` : '—'}
            </p>
            <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barClass}`}
                style={{ width: `${similarity ?? 0}%` }}
              />
            </div>
          </div>

          <div className="bg-black/45 backdrop-blur-md rounded-xl p-4 border border-white/10">
            <p className="text-gray-300 text-xs mb-3">운동 진행률 (Progress)</p>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 shrink-0">
                <svg viewBox="0 0 64 64" className="w-full h-full">
                  <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                  <circle
                    cx="32" cy="32" r="26" fill="none"
                    stroke="#6b9cf4" strokeWidth="6" strokeLinecap="round"
                    strokeDasharray="163.36"
                    strokeDashoffset={163.36 * (1 - (set - 1) / totalSets)}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-white text-xs font-bold">{Math.round(((set - 1) / totalSets) * 100)}%</span>
                </div>
              </div>
              <div className="space-y-2.5">
                <div className="flex justify-between gap-6">
                  <span className="text-gray-400 text-xs">진행 세트</span>
                  <span className="text-white text-xs font-bold">{set}/{totalSets}</span>
                </div>
                <div className="flex justify-between gap-6">
                  <span className="text-gray-400 text-xs">현재 횟수</span>
                  <span className="text-white text-xs font-bold">{count}/{targetCount}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500/70 hover:bg-red-500 backdrop-blur-md text-white font-semibold rounded-xl border border-red-400/30 transition-all active:scale-95"
          >
            <span className="material-symbols-outlined text-xl">stop_circle</span>
            운동 종료
          </button>
        </div>
      )}

      {/* 모바일 하단 바 */}
      {phase === 'running' && (
        <div className="md:hidden absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md border-t border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">Phase</p>
              <p className="text-white font-bold text-sm truncate">{exerciseLabel}</p>
            </div>
            <div className="w-px h-10 bg-white/20 shrink-0" />
            <div className="text-center shrink-0">
              <p className="text-[10px] text-gray-400">일치율</p>
              <p className={`font-bold text-sm ${signalClass}`}>
                {similarity != null ? `${similarity.toFixed(0)}%` : '—'}
              </p>
            </div>
            <div className="w-px h-10 bg-white/20 shrink-0" />
            <div className="text-center shrink-0">
              <p className="text-[10px] text-gray-400">세트 / 횟수</p>
              <p className="text-white font-bold text-sm">{set}/{totalSets} · {count}/{targetCount}</p>
            </div>
            <div className="w-px h-10 bg-white/20 shrink-0" />
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-95 shrink-0"
            >
              <span className="material-symbols-outlined text-base">stop_circle</span>
              종료
            </button>
          </div>
        </div>
      )}

      <VoiceChatBot />

      {showModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 w-80 shadow-2xl">
            <div className="flex justify-center mb-4">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-500 text-3xl">warning</span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-center text-on-surface mb-2">운동을 종료하시겠습니까?</h3>
            <p className="text-sm text-on-surface-variant text-center mb-6 leading-relaxed">
              현재까지의 운동 기록이 저장됩니다.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 h-12 border border-outline-variant rounded-xl text-on-surface font-medium hover:bg-surface-container-low transition-colors"
              >
                취소
              </button>
              <button
                onClick={() => { saveExerciseResult('안전종료').finally(() => { stopSession(); navigate('/patient/exercise'); }); }}
                className="flex-1 h-12 bg-red-500 text-white rounded-xl font-semibold hover:brightness-110 transition-all"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
