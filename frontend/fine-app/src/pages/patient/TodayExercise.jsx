import { Link } from 'react-router-dom';
import PatientNavBar from '../../components/PatientNavBar';

const exercises = [
  {
    id: 1,
    name: '왼손 손가락 두드리기',
    sets: 3,
    reps: 10,
    duration: '5분',
    status: 'done',
    progress: 100,
    videoTime: '01:20',
  },
  {
    id: 2,
    name: '오른손 쥐었다,펴기',
    sets: 3,
    reps: 5,
    duration: '5분',
    status: 'done',
    progress: 100,
    videoTime: '01:45',
  },
  {
    id: 3,
    name: '손가락 스트레칭',
    sets: 2,
    reps: 3,
    duration: '8분',
    status: 'in_progress',
    progress: 50,
    videoTime: '01:30',
  },
  {
    id: 4,
    name: '손목 회전 스트레칭',
    sets: 2,
    reps: 3,
    duration: '10분',
    status: 'waiting',
    progress: 0,
    videoTime: '01:10',
  },
];

function ExerciseCard({ ex }) {
  const isDone = ex.status === 'done';
  const isInProgress = ex.status === 'in_progress';

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-4 flex flex-col md:flex-row gap-gutter items-center transition-shadow duration-300
        ${isInProgress ? 'border-2 border-primary/20 shadow-md relative overflow-hidden' : 'border border-outline-variant hover:shadow-md'}
        ${isDone || ex.status === 'waiting' ? 'opacity-60' : ''}
      `}
    >
      {isInProgress && <div className="absolute top-0 left-0 w-1 h-full bg-primary" />}

      {/* Video thumbnail */}
      <div className="relative w-full md:w-48 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-high flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-5xl">fitness_center</span>
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{ex.videoTime}</div>
      </div>

      {/* Info */}
      <div className="flex-grow w-full">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="text-title-md text-primary font-display font-bold mb-1">{ex.name}</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">세트수 <b className="text-on-surface">{ex.sets}회</b></span>
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">세트당 횟수 <b className="text-on-surface">{ex.reps}회</b></span>
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">예상 소요 <b className="text-on-surface">{ex.duration}</b></span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            {isDone && (
              <span className="flex items-center gap-1 text-primary text-label-sm mb-1">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>완료
              </span>
            )}
            {isInProgress && (
              <span className="flex items-center gap-1 text-secondary text-label-sm mb-1 animate-pulse">
                <span className="material-symbols-outlined text-sm">pending</span>진행 중
              </span>
            )}
            {ex.status === 'waiting' && (
              <span className="flex items-center gap-1 text-on-surface-variant text-label-sm mb-1">
                <span className="material-symbols-outlined text-sm">schedule</span>대기
              </span>
            )}
            <span className="text-[10px] text-label-sm text-on-surface-variant">{ex.progress}%</span>
          </div>
        </div>
        <div className="w-full bg-surface-container h-1.5 rounded-full mb-4">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isDone ? 'bg-primary' : isInProgress ? 'bg-secondary' : 'bg-outline-variant'}`}
            style={{ width: `${ex.progress}%` }}
          />
        </div>
      </div>

      {/* Action */}
      <div className="w-full md:w-auto">
        {isDone ? (
          <button className="w-full md:w-32 h-12 border border-primary text-primary text-label-md rounded-lg hover:bg-primary/5 transition-colors">
            운동 완료
          </button>
        ) : (
          <Link
            to="/patient/exercise/session"
            className="w-full md:w-32 h-12 bg-primary text-white text-label-md rounded-lg shadow-sm hover:bg-primary-container transition-all active:scale-95 flex items-center justify-center"
          >
            운동 시작
          </Link>
        )}
      </div>
    </div>
  );
}

export default function TodayExercise() {
  const completedCount = exercises.filter((e) => e.status === 'done').length;
  const totalCount = exercises.length;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <PatientNavBar />

      <main className="max-w-[1280px] mx-auto px-container-padding-mobile md:px-container-padding-desktop py-stack-lg">
        {/* Header */}
        <header className="mb-stack-lg">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-headline-lg font-display font-bold text-primary mb-1">김망나뇽님 안녕하세요!</h1>
            </div>
            <div className="hidden md:flex items-center gap-stack-sm bg-surface-container-low px-4 py-2 rounded-xl">
              <span className="material-symbols-outlined text-primary">local_fire_department</span>
              <span className="text-label-md text-primary font-semibold">OO일 연속 훈련 중</span>
            </div>
          </div>
        </header>

        {/* Progress Bento */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-lg">
          <div className="md:col-span-2 bg-primary-container text-on-primary-container p-4 md:p-stack-lg rounded-xl flex flex-col gap-3 md:gap-6 relative overflow-hidden shadow-sm">
            <div className="relative z-10">
              {/* 오늘 달성률 */}
              <h2 className="text-label-lg md:text-title-md font-display font-bold mb-2">오늘 운동 달성률</h2>
              <div className="flex items-center gap-3">
                <span className="text-headline-lg md:text-display-lg font-display font-bold shrink-0">85%</span>
                <div className="flex-1 bg-white/20 h-2 md:h-3 rounded-full overflow-hidden">
                  <div className="bg-primary-fixed-dim h-full w-[85%] transition-all duration-1000 ease-out" />
                </div>
              </div>
            </div>

            {/* 주간 달성률 */}
            <div className="relative z-10">
              <h3 className="text-label-lg md:text-title-md font-display font-bold mb-2 md:mb-3">주간 운동 달성률</h3>
              <div className="flex gap-2 items-end h-16 md:h-24">
                {[
                  { day: '월', rate: 100 },
                  { day: '화', rate: 80 },
                  { day: '수', rate: 60 },
                  { day: '목', rate: 85 },
                  { day: '금', rate: 40 },
                  { day: '토', rate: 0 },
                  { day: '일', rate: 0 },
                ].map(({ day, rate }) => (
                  <div key={day} className="flex-1 flex flex-col items-center gap-1 h-full">
                    <span className="text-xs opacity-70 shrink-0">{rate > 0 ? `${rate}%` : ''}</span>
                    <div className="flex-1 w-full flex items-end">
                      <div
                        className="w-full rounded-t-md transition-all duration-700"
                        style={{
                          height: rate > 0 ? `${rate}%` : '4px',
                          background: rate > 0 ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)',
                        }}
                      />
                    </div>
                    <span className="text-label-sm font-semibold shrink-0">{day}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="absolute -right-4 -bottom-4 opacity-10">
              <span className="material-symbols-outlined text-[160px]" style={{ fontVariationSettings: "'FILL' 1" }}>rebase_edit</span>
            </div>
          </div>

          <div className="hidden md:flex bg-surface-container-lowest border border-outline-variant p-stack-lg rounded-xl flex-col items-center justify-center text-center shadow-sm">
            <div className="relative w-32 h-32 mb-4">
              <svg className="w-full h-full" viewBox="0 0 128 128">
                <circle className="text-surface-container-highest stroke-current" cx="64" cy="64" fill="transparent" r="56" strokeWidth="8" />
                <circle
                  className="text-primary stroke-current"
                  cx="64" cy="64" fill="transparent" r="56"
                  strokeLinecap="round" strokeWidth="8"
                  style={{
                    strokeDasharray: '351.85',
                    strokeDashoffset: `${351.85 * (1 - completedCount / totalCount)}`,
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                    transition: 'stroke-dashoffset 0.35s',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-title-md font-bold text-primary">{completedCount}/{totalCount}</span>
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">완료 항목</span>
              </div>
            </div>
          </div>
        </section>

        {/* Exercise List */}
        <div className="flex items-center justify-between mb-stack-md">
          <h3 className="text-title-md font-display font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">format_list_bulleted</span>
            오늘의 운동 루틴
          </h3>
        </div>

        <div className="space-y-stack-md">
          {exercises.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} />
          ))}
        </div>
      </main>
    </div>
  );
}
