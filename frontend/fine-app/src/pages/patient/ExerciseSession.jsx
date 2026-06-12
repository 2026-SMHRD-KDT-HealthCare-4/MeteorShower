import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function HandGuide() {
  const joints = [
    { x: 150, y: 370, key: 'wrist' },
    // Thumb
    { x: 105, y: 305, key: 't_cmc' },
    { x: 75,  y: 258, key: 't_mcp' },
    { x: 53,  y: 215, key: 't_ip'  },
    { x: 38,  y: 175, key: 't_tip' },
    // Index
    { x: 120, y: 243, key: 'i_mcp' },
    { x: 113, y: 193, key: 'i_pip' },
    { x: 108, y: 150, key: 'i_dip' },
    { x: 105, y: 110, key: 'i_tip' },
    // Middle
    { x: 149, y: 235, key: 'm_mcp' },
    { x: 146, y: 182, key: 'm_pip' },
    { x: 143, y: 140, key: 'm_dip' },
    { x: 141, y: 100, key: 'm_tip' },
    // Ring
    { x: 177, y: 240, key: 'r_mcp' },
    { x: 177, y: 190, key: 'r_pip' },
    { x: 176, y: 150, key: 'r_dip' },
    { x: 175, y: 113, key: 'r_tip' },
    // Pinky
    { x: 202, y: 252, key: 'p_mcp' },
    { x: 205, y: 208, key: 'p_pip' },
    { x: 207, y: 172, key: 'p_dip' },
    { x: 209, y: 140, key: 'p_tip' },
  ];

  const connections = [
    ['wrist', 't_cmc'], ['wrist', 'i_mcp'], ['wrist', 'm_mcp'], ['wrist', 'r_mcp'], ['wrist', 'p_mcp'],
    ['t_cmc', 't_mcp'], ['t_mcp', 't_ip'], ['t_ip', 't_tip'],
    ['i_mcp', 'i_pip'], ['i_pip', 'i_dip'], ['i_dip', 'i_tip'],
    ['m_mcp', 'm_pip'], ['m_pip', 'm_dip'], ['m_dip', 'm_tip'],
    ['r_mcp', 'r_pip'], ['r_pip', 'r_dip'], ['r_dip', 'r_tip'],
    ['p_mcp', 'p_pip'], ['p_pip', 'p_dip'], ['p_dip', 'p_tip'],
    ['i_mcp', 'm_mcp'], ['m_mcp', 'r_mcp'], ['r_mcp', 'p_mcp'],
  ];

  const map = Object.fromEntries(joints.map(j => [j.key, j]));

  return (
    <svg viewBox="0 0 300 420" className="w-full h-full" fill="none">
      <defs>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      {connections.map(([a, b], i) => {
        const from = map[a];
        const to = map[b];
        return (
          <line
            key={i}
            x1={from.x} y1={from.y} x2={to.x} y2={to.y}
            stroke="rgba(0,210,190,0.7)"
            strokeWidth="2.5"
            strokeLinecap="round"
            filter="url(#glow)"
          />
        );
      })}
      {joints.map(j => (
        <circle
          key={j.key}
          cx={j.x} cy={j.y} r="5"
          fill="rgba(0,220,200,0.9)"
          filter="url(#glow)"
        />
      ))}
    </svg>
  );
}

export default function ExerciseSession() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#0c1a1a]">

      {/* 배경 링 패턴 (카메라 화면 시뮬레이션) */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[500, 380, 260, 140].map((r, i) => (
          <div
            key={i}
            className="absolute rounded-full border border-teal-400/10"
            style={{ width: r, height: r }}
          />
        ))}
        <div className="absolute w-48 h-48 rounded-full bg-teal-500/5 blur-2xl" />
      </div>

      {/* 손 가이드라인 오버레이 */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-56 h-80 opacity-75">
          <HandGuide />
        </div>
      </div>

      {/* 데스크탑: 우측 세로 패널 */}
      <div className="hidden md:flex absolute right-5 top-5 flex-col gap-4 w-60">
        {/* CURRENT PHASE */}
        <div className="bg-black/45 backdrop-blur-md rounded-xl p-4 border border-white/10">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-1.5">Current Phase</p>
          <h3 className="text-white font-bold text-base mb-1">태핑 (Tapping)</h3>
          <p className="text-gray-300 text-xs leading-relaxed">손가락 마디의 유연성과 조절 능력을 강화하는 운동입니다.</p>
        </div>

        {/* 일치율 */}
        <div className="bg-black/45 backdrop-blur-md rounded-xl p-4 border border-white/10">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-300 text-xs">일치율 (Accuracy)</span>
            <span className="text-teal-300 text-xs font-bold">Excellent</span>
          </div>
          <p className="text-teal-300 text-2xl font-bold mb-2">95%</p>
          <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
            <div className="bg-teal-400 h-full rounded-full transition-all duration-700" style={{ width: '95%' }} />
          </div>
        </div>

        {/* 운동 진행률 */}
        <div className="bg-black/45 backdrop-blur-md rounded-xl p-4 border border-white/10">
          <p className="text-gray-300 text-xs mb-3">운동 진행률 (Progress)</p>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 shrink-0">
              <svg viewBox="0 0 64 64" className="w-full h-full">
                <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
                <circle
                  cx="32" cy="32" r="26" fill="none"
                  stroke="#6b9cf4" strokeWidth="6" strokeLinecap="round"
                  strokeDasharray="163.36" strokeDashoffset={163.36 * 0.3}
                  style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white text-xs font-bold">70%</span>
              </div>
            </div>
            <div className="space-y-2.5">
              <div className="flex justify-between gap-6">
                <span className="text-gray-400 text-xs">진행 세트</span>
                <span className="text-white text-xs font-bold">2/3</span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-gray-400 text-xs">현재 횟수</span>
                <span className="text-white text-xs font-bold">8/15</span>
              </div>
            </div>
          </div>
        </div>

        {/* 데스크탑 종료 버튼 */}
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-red-500/70 hover:bg-red-500 backdrop-blur-md text-white font-semibold rounded-xl border border-red-400/30 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined text-xl">stop_circle</span>
          운동 종료
        </button>
      </div>

      {/* 모바일: 하단 가로 바 */}
      <div className="md:hidden absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-md border-t border-white/10 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* 운동명 */}
          <div className="min-w-0">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider">Current Phase</p>
            <p className="text-white font-bold text-sm truncate">태핑 (Tapping)</p>
          </div>

          {/* 구분선 */}
          <div className="w-px h-10 bg-white/20 shrink-0" />

          {/* 일치율 */}
          <div className="text-center shrink-0">
            <p className="text-[10px] text-gray-400">일치율</p>
            <p className="text-teal-300 font-bold text-sm">95%</p>
          </div>

          {/* 구분선 */}
          <div className="w-px h-10 bg-white/20 shrink-0" />

          {/* 진행 세트 / 횟수 */}
          <div className="text-center shrink-0">
            <p className="text-[10px] text-gray-400">세트 / 횟수</p>
            <p className="text-white font-bold text-sm">2/3 · 8/15</p>
          </div>

          {/* 구분선 */}
          <div className="w-px h-10 bg-white/20 shrink-0" />

          {/* 종료 버튼 */}
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-500/80 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-all active:scale-95 shrink-0"
          >
            <span className="material-symbols-outlined text-base">stop_circle</span>
            종료
          </button>
        </div>
      </div>

      {/* 종료 확인 모달 */}
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
                onClick={() => navigate('/patient/exercise')}
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
