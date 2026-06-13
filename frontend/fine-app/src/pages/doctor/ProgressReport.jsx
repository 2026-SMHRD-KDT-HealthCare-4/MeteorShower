import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';

const patientInfo = [
  { label: '성명 (Name)', value: '김망나뇽' },
  { label: '환자번호 (Code)', value: 'F310957194583' },
  { label: '성별 (Gender)', value: '남자' },
  { label: '생년월일 (Birth)', value: '1960.01.02' },
  { label: '수술명 (Surgery)', value: '손가락 골절 수술', span: true },
  { label: '수술일 (Date)', value: '2026.01.01' },
  { label: '진행 단계 (Stage)', value: '손가락 굽히기 운동', span: true },
  { label: '재활 시작일', value: '2026.01.25' },
];

const exercises = [
  {
    name: '손가락 굽히기',
    fullName: '손가락 굽히기 운동 (Finger Flexion)',
    sets: 3,
    reps: 10,
    data: [72, 80, 88, 91],
    color: '#1a73e8',
    icon: 'back_hand',
  },
  {
    name: '손가락 펴기',
    fullName: '손가락 펴기 운동 (Finger Extension)',
    sets: 3,
    reps: 10,
    data: [65, 70, 78, 84],
    color: '#005bbf',
    icon: 'pan_tool',
  },
  {
    name: '엄지 맞닿기',
    fullName: '엄지 맞닿기 운동 (Thumb Opposition)',
    sets: 2,
    reps: 8,
    data: [60, 65, 72, 79],
    color: '#006398',
    icon: 'front_hand',
  },
];

const weeks = ['1주차', '2주차', '3주차', '4주차'];

const summaryStats = [
  { label: '평균 달성률', value: '84%', icon: 'target', color: 'text-doctor-primary', bg: 'bg-[#e8f0fe]' },
  { label: '4주 향상률', value: '+21%', icon: 'trending_up', color: 'text-[#1a73e8]', bg: 'bg-[#e8f0fe]' },
  { label: '재활 기간', value: '4주', icon: 'calendar_month', color: 'text-[#006398]', bg: 'bg-[#cce5ff]' },
  { label: '처방 운동 수', value: '3종', icon: 'fitness_center', color: 'text-doctor-primary', bg: 'bg-[#e8f0fe]' },
];

function LineChart({ data, color }) {
  const width = 1000;
  const height = 200;
  const padLeft = 10;
  const padRight = 10;
  const padTop = 30;
  const padBottom = 20;

  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const points = data.map((val, i) => ({
    x: padLeft + (i / (data.length - 1)) * chartW,
    y: padTop + chartH - (val / 100) * chartH,
    val,
  }));

  const pathD = `M${points.map((p) => `${p.x},${p.y}`).join(' L')}`;
  const areaD = `${pathD} L${points[points.length - 1].x},${padTop + chartH} L${points[0].x},${padTop + chartH} Z`;

  return (
    <div
      className="w-full h-[200px] border border-outline-variant rounded-lg relative overflow-hidden bg-white"
      style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #e2e8e7 1px, transparent 0)', backgroundSize: '24px 24px' }}
    >
      <svg className="w-full h-full px-2" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={areaD} fill={color} fillOpacity="0.08" />
        <path d={pathD} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="7" fill={color} />
            <text x={p.x} y={p.y - 14} textAnchor="middle" fill={color} fontSize="22" fontWeight="bold">
              {p.val}%
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-1 left-4 right-4 flex justify-between text-[11px] font-semibold text-outline">
        {weeks.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
    </div>
  );
}

export default function ProgressReport() {
  const navigate = useNavigate();
  const [activeIdx, setActiveIdx] = useState(0);
  const active = exercises[activeIdx];

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavBar />

      {/* Action bar */}
      <div className="w-full max-w-[1280px] mx-auto px-4 md:px-10 mt-6 mb-4 flex justify-between items-center">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-on-surface-variant hover:text-doctor-primary transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-label-md font-medium">Back to Dashboard</span>
        </button>
        <button
          onClick={() => window.print()}
          className="bg-doctor-primary text-white px-6 py-2 rounded-full text-label-md font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined">print</span>
          Print Report
        </button>
      </div>

      <main className="max-w-[1280px] mx-auto px-4 md:px-10 pb-12">
        {/* Header */}
        <header className="mb-8">
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-doctor-primary tracking-tight">
            김망나뇽 환자님의 재활 진행 레포트
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            재활 4주차 누적 진행 결과입니다. (2026.01.25 ~ 2026.02.15)
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Charts */}
          <section className="lg:col-span-8 space-y-6">
            {/* Exercise tabs */}
            <nav className="flex overflow-x-auto pb-1 gap-3">
              {exercises.map((ex, i) => (
                <button
                  key={ex.name}
                  onClick={() => setActiveIdx(i)}
                  className={`px-4 py-2 rounded-full text-label-md font-medium transition-all whitespace-nowrap flex items-center gap-2
                    ${activeIdx === i ? 'text-white shadow-md' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'}
                  `}
                  style={activeIdx === i ? { background: ex.color } : {}}
                >
                  <span className="material-symbols-outlined text-sm">{ex.icon}</span>
                  {ex.name}
                </button>
              ))}
            </nav>

            {/* Chart card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 space-y-6 shadow-card">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-title-md font-bold text-on-surface flex items-center gap-2">
                    <span className="material-symbols-outlined" style={{ color: active.color }}>{active.icon}</span>
                    {active.fullName}
                  </h3>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">{active.sets}세트 × {active.reps}회</p>
                </div>
                <span
                  className="text-label-sm px-3 py-1 rounded-full font-semibold"
                  style={{ background: active.color + '18', color: active.color }}
                >
                  +{active.data[3] - active.data[0]}% 향상
                </span>
              </div>

              {/* 4주 일치율 라인차트 */}
              <div className="space-y-2">
                <h4 className="text-label-md font-semibold text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">target</span>
                  4주차 일치율 (Accuracy)
                </h4>
                <LineChart data={active.data} color={active.color} />
              </div>

              {/* 주차별 완료율 (bar) */}
              <div className="space-y-2">
                <h4 className="text-label-md font-semibold text-on-surface-variant flex items-center gap-1">
                  <span className="material-symbols-outlined text-base">bar_chart</span>
                  주차별 완료율 (Weekly Completion)
                </h4>
                <div className="w-full h-[160px] bg-white border border-outline-variant rounded-lg p-4 flex items-end gap-4">
                  {active.data.map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[11px] font-bold" style={{ color: active.color }}>{val}%</span>
                      <div
                        className="w-full rounded-t-md transition-all duration-700"
                        style={{ height: `${val}%`, maxHeight: '100px', background: active.color }}
                      />
                      <span className="text-[10px] text-outline font-semibold">{weeks[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* All exercises summary */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-card">
              <h3 className="text-title-md font-bold text-on-surface mb-4 font-display">전체 운동 4주 비교</h3>
              <div className="space-y-5">
                {exercises.map((ex) => (
                  <div key={ex.name}>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-label-md font-semibold text-on-surface flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm" style={{ color: ex.color }}>{ex.icon}</span>
                        {ex.name}
                      </span>
                      <span className="text-label-sm font-bold" style={{ color: ex.color }}>
                        {ex.data[0]}% → {ex.data[3]}%
                        <span className="ml-2 text-xs text-on-surface-variant">(+{ex.data[3] - ex.data[0]}%)</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {ex.data.map((val, i) => (
                        <div key={i} className="flex flex-col gap-1">
                          <div className="w-full bg-surface-container h-2 rounded-full">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${val}%`, background: ex.color }}
                            />
                          </div>
                          <div className="flex justify-between text-[10px] text-on-surface-variant">
                            <span>{weeks[i]}</span>
                            <span className="font-bold" style={{ color: ex.color }}>{val}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Right: Summary */}
          <aside className="lg:col-span-4 space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              {summaryStats.map((s) => (
                <div key={s.label} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-4 shadow-card">
                  <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center mb-2`}>
                    <span className={`material-symbols-outlined ${s.color}`}>{s.icon}</span>
                  </div>
                  <p className="text-label-sm text-on-surface-variant mb-1">{s.label}</p>
                  <p className={`text-title-md font-bold ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Patient info */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-card">
              <h3 className="text-title-md font-bold text-on-surface mb-4 font-display flex items-center gap-2">
                <span className="material-symbols-outlined text-doctor-primary">person</span>
                환자 정보
              </h3>
              <div className="space-y-2">
                {patientInfo.map((info, i) => (
                  <div key={i} className="flex justify-between text-label-md border-b border-outline-variant pb-1.5 last:border-0">
                    <span className="text-on-surface-variant">{info.label}</span>
                    <span className="font-semibold text-on-surface text-right">{info.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Overall Assessment */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-5 shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-[#e8f0fe] rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#1a73e8] text-lg">psychology</span>
                </div>
                <h3 className="text-title-md font-bold text-on-surface font-display">종합 평가</h3>
              </div>
              <p className="text-body-md text-on-surface-variant leading-relaxed">
                환자 김망나뇽님은 재활 4주차에 걸쳐 모든 운동 항목에서 꾸준한 향상을 보이고 있습니다. 특히 손가락 굽히기 운동에서 초기 대비 19%의 일치율 향상이 관찰되었으며, 전반적인 회복 경과가 매우 긍정적입니다.
              </p>
              <div className="mt-3 flex gap-2 flex-wrap">
                <span className="px-3 py-1 bg-[#e8f0fe] text-doctor-primary rounded-full text-label-sm font-semibold">정확도 향상</span>
                <span className="px-3 py-1 bg-[#cce5ff] text-[#006398] rounded-full text-label-sm font-semibold">꾸준한 수행</span>
              </div>
            </div>

            {/* Print */}
            <button
              onClick={() => window.print()}
              className="w-full h-12 border-2 border-doctor-primary text-doctor-primary font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-doctor-primary hover:text-white transition-all"
            >
              <span className="material-symbols-outlined">print</span>
              리포트 출력
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}