import { useState } from 'react';
import DoctorNavBar from '../../components/DoctorNavBar';

const exercises = ['Tapping', 'Flexion', 'Extension', 'Grip', 'Rotation'];

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const accuracyData = [150, 130, 140, 110, 90, 105, 60];
const repData = [160, 140, 120, 100, 140, 90, 70];

function LineChart({ data, color }) {
  const max = 200;
  const width = 1000;
  const height = 200;
  const points = data.map((y, i) => {
    const x = (i / (data.length - 1)) * width;
    return `${x},${y}`;
  });
  const pathD = `M${points.join(' L')}`;
  const circlePoints = data.map((y, i) => ({ x: (i / (data.length - 1)) * width, y }));

  return (
    <div
      className="w-full h-[180px] border border-outline-variant rounded-lg relative overflow-hidden bg-white"
      style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, #e2e8e7 1px, transparent 0)', backgroundSize: '24px 24px' }}
    >
      <svg className="w-full h-full p-4" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <path d={pathD} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {circlePoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="6" fill={color} />
        ))}
      </svg>
      <div className="absolute bottom-2 left-4 right-4 flex justify-between text-[10px] font-semibold text-outline">
        {days.map((d) => <span key={d}>{d}</span>)}
      </div>
    </div>
  );
}

const summaryStats = [
  { label: '이번 주 총 수행 횟수', value: '342회', icon: 'fitness_center', color: 'text-primary', bg: 'bg-primary-fixed' },
  { label: '평균 일치율', value: '87%', icon: 'target', color: 'text-secondary', bg: 'bg-secondary-fixed' },
  { label: '연속 수행일', value: '12일', icon: 'local_fire_department', color: 'text-tertiary', bg: 'bg-tertiary-fixed' },
  { label: '전주 대비 향상', value: '+12%', icon: 'trending_up', color: 'text-primary', bg: 'bg-primary-fixed' },
];

export default function WeeklyReport() {
  const [activeExercise, setActiveExercise] = useState('Tapping');

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavBar />

      <main className="max-w-[1280px] mx-auto px-container-padding-mobile md:px-container-padding-desktop py-stack-lg">
        {/* Header */}
        <header className="mb-stack-lg">
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-primary tracking-tight">
            김망나뇽 환자님의 주간 레포트
          </h1>
          <p className="text-on-surface-variant text-body-md mt-1">
            2024년 3월 1주차 분석 결과입니다. (03.01 - 03.07)
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left: Charts */}
          <section className="lg:col-span-8 space-y-gutter">
            {/* Exercise tabs */}
            <nav className="flex overflow-x-auto pb-1 gap-stack-sm">
              {exercises.map((ex) => (
                <button
                  key={ex}
                  onClick={() => setActiveExercise(ex)}
                  className={`px-stack-md py-2 rounded-full text-label-md font-medium transition-all whitespace-nowrap
                    ${activeExercise === ex ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'}
                  `}
                >
                  {ex}
                </button>
              ))}
            </nav>

            {/* Chart cards */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-md md:p-stack-lg space-y-stack-lg shadow-card">
              {/* Accuracy */}
              <div className="space-y-stack-sm">
                <div className="flex justify-between items-end">
                  <h3 className="text-title-md font-bold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined text-xl">target</span>
                    일치율 (Accuracy)
                  </h3>
                  <span className="text-label-sm text-primary bg-primary-container/30 px-2 py-0.5 rounded-full font-semibold">+12% vs last week</span>
                </div>
                <LineChart data={accuracyData} color="#1a73e8" />
              </div>

              {/* Sets/Reps */}
              <div className="space-y-stack-sm">
                <h3 className="text-title-md font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">fitness_center</span>
                  세트 / 횟수 (Sets & Reps)
                </h3>
                <LineChart data={repData} color="#4858ab" />
              </div>

              {/* Bar chart - completion rate */}
              <div className="space-y-stack-sm">
                <h3 className="text-title-md font-bold text-primary flex items-center gap-2">
                  <span className="material-symbols-outlined text-xl">bar_chart</span>
                  일별 완료율 (Daily Completion)
                </h3>
                <div className="w-full h-[180px] bg-white border border-outline-variant rounded-lg p-4 flex items-end gap-2">
                  {[85, 70, 90, 60, 95, 45, 80].map((pct, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-md bg-primary transition-all duration-700"
                        style={{ height: `${pct}%`, maxHeight: '140px' }}
                      />
                      <span className="text-[10px] text-outline font-semibold">{days[i]}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Right: Summary */}
          <aside className="lg:col-span-4 space-y-gutter">
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

            {/* AI Feedback */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-card">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-primary-fixed rounded-lg flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary-container text-lg">psychology</span>
                </div>
                <h3 className="text-title-md font-bold text-on-surface font-display">AI 분석 의견</h3>
              </div>
              <p className="text-body-md text-on-surface-variant leading-relaxed">
                이번 주 태핑 운동의 일치율이 전주 대비 12% 향상되었습니다. 특히 목요일과 금요일의 수행 정확도가 눈에 띄게 개선되었습니다. 지속적인 연습이 효과를 나타내고 있습니다.
              </p>
              <div className="mt-4 flex gap-2 flex-wrap">
                <span className="px-3 py-1 bg-primary-fixed text-on-primary-fixed rounded-full text-label-sm font-semibold">정확도 향상</span>
                <span className="px-3 py-1 bg-secondary-fixed text-on-secondary-fixed rounded-full text-label-sm font-semibold">꾸준한 수행</span>
              </div>
            </div>

            {/* Exercise breakdown */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 shadow-card">
              <h3 className="text-title-md font-bold text-on-surface mb-4 font-display">운동별 달성률</h3>
              <div className="space-y-3">
                {[
                  { name: '태핑', value: 87 },
                  { name: '굴곡', value: 72 },
                  { name: '신전', value: 90 },
                  { name: '그립', value: 65 },
                  { name: '회전', value: 80 },
                ].map((ex) => (
                  <div key={ex.name}>
                    <div className="flex justify-between text-label-md mb-1">
                      <span className="text-on-surface">{ex.name}</span>
                      <span className="text-primary font-semibold">{ex.value}%</span>
                    </div>
                    <div className="w-full bg-surface-container h-2 rounded-full">
                      <div className="bg-primary h-full rounded-full transition-all duration-700" style={{ width: `${ex.value}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Print */}
            <button
              onClick={() => window.print()}
              className="w-full h-12 border-2 border-primary text-primary font-semibold rounded-xl flex items-center justify-center gap-2 hover:bg-primary hover:text-white transition-all"
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
