import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PatientNavBar from '../../components/PatientNavBar';

// TODO: 실제 API에서 받아올 데이터
const MOCK_USER = {
  name: '김망나뇽',
};

const INITIAL_EXERCISES = [
  { id: 1, name: '왼손 손가락 두드리기', sets: 3, reps: 10, duration: '5분', status: 'done',        videoTime: '01:20' },
  { id: 2, name: '오른손 쥐었다 펴기',   sets: 3, reps: 5,  duration: '5분', status: 'done',        videoTime: '01:45' },
  { id: 3, name: '손가락 스트레칭',      sets: 2, reps: 3,  duration: '8분', status: 'in_progress', videoTime: '01:30' },
  { id: 4, name: '손목 회전 스트레칭',   sets: 2, reps: 3,  duration: '10분', status: 'waiting',    videoTime: '01:10' },
];

// in_progress → waiting → done 순서로 정렬
const STATUS_ORDER = { in_progress: 0, waiting: 1, done: 2 };

const QUESTIONS = [
  '주먹을 쥐었다 필 때 공간이 있나요?',
  '손가락을 구부릴 때 걸리는 느낌이 있나요?',
];

function PreExamModal({ onConfirm, onClose }) {
  const [answers, setAnswers] = useState([null, null]);
  const [submitted, setSubmitted] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const allAnswered = answers.every((a) => a !== null);

  const handleConfirm = () => {
    setSubmitted(true);
    if (!allAnswered) return;
    if (answers.some((a) => a === 'yes')) {
      setBlocked(true);
    } else {
      onConfirm();
    }
  };

  const setAnswer = (idx, val) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[idx] = val;
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={!blocked ? onClose : undefined} />
      <div className="relative bg-surface-container-lowest rounded-2xl shadow-xl w-full max-w-md p-6 flex flex-col gap-5">

        {!blocked ? (
          <>
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>health_and_safety</span>
              <div>
                <h2 className="text-title-md font-bold text-on-surface">운동 전 사전 문진</h2>
                <p className="text-label-sm text-on-surface-variant">안전한 운동을 위해 현재 상태를 확인해주세요</p>
              </div>
            </div>

            <div className="space-y-4">
              {QUESTIONS.map((q, idx) => (
                <div key={idx} className="bg-surface-container p-4 rounded-xl space-y-3">
                  <p className="text-body-md text-on-surface font-medium">
                    <span className="text-primary font-bold mr-1">Q{idx + 1}.</span>{q}
                  </p>
                  <div className="flex gap-3">
                    {[{ val: 'yes', label: '예' }, { val: 'no', label: '아니오' }].map(({ val, label }) => {
                      const selected = answers[idx] === val;
                      return (
                        <button
                          key={val}
                          onClick={() => setAnswer(idx, val)}
                          className={`flex-1 h-10 rounded-lg text-label-md font-semibold border-2 transition-all
                            ${selected
                              ? val === 'yes'
                                ? 'bg-error border-error text-white'
                                : 'bg-primary border-primary text-white'
                              : 'border-outline-variant text-on-surface-variant hover:border-outline'
                            }`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            {submitted && !allAnswered && (
              <p className="text-label-sm text-error flex items-center gap-1">
                <span className="material-symbols-outlined text-base">error</span>
                모든 항목에 답변해 주세요
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 h-11 rounded-xl border border-outline-variant text-on-surface-variant text-label-md font-semibold hover:bg-surface-container transition-all"
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 h-11 rounded-xl bg-primary text-white text-label-md font-semibold hover:brightness-110 active:scale-95 transition-all"
              >
                확인
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center gap-4 py-2">
            <div className="w-16 h-16 rounded-full bg-error/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>local_hospital</span>
            </div>
            <div className="space-y-1">
              <h2 className="text-title-md font-bold text-on-surface">운동을 진행할 수 없어요</h2>
              <p className="text-body-sm text-on-surface-variant leading-relaxed">
                증상이 확인되어 오늘 운동이 제한됩니다.<br />
                빠른 시일 내에 병원을 방문하여<br />
                주치의와 상담하시기 바랍니다.
              </p>
            </div>
            <div className="w-full bg-error/5 border border-error/20 rounded-xl p-4">
              <p className="text-label-sm text-error font-semibold flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                무리한 운동은 증상을 악화시킬 수 있습니다
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full h-11 rounded-xl bg-surface-container text-on-surface text-label-md font-semibold hover:bg-surface-container-high transition-all"
            >
              닫기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ExerciseCard({ ex, onStart }) {
  const navigate = useNavigate();
  const isDone = ex.status === 'done';
  const isInProgress = ex.status === 'in_progress';
  const [showModal, setShowModal] = useState(false);

  const progress = isDone ? 100 : isInProgress ? 50 : 0;

  const handleStart = () => {
    onStart(ex.id);
    navigate('/patient/exercise/session');
  };

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-4 flex flex-col md:flex-row gap-gutter items-center transition-all duration-300 relative
        ${isInProgress ? 'border-2 border-primary/30 shadow-md overflow-hidden' : 'border border-outline-variant hover:shadow-md'}
        ${isDone ? 'opacity-40 pointer-events-none' : ''}
      `}
    >
      {isInProgress && <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l-xl" />}

      {/* 비디오 썸네일 */}
      <div className="relative w-full md:w-48 aspect-video rounded-lg overflow-hidden flex-shrink-0 bg-surface-container-high flex items-center justify-center">
        <span className="material-symbols-outlined text-primary text-5xl">fitness_center</span>
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <span className="material-symbols-outlined text-white text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
        </div>
        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">{ex.videoTime}</div>
      </div>

      {/* 정보 */}
      <div className="flex-grow w-full">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h4 className="text-title-md text-primary font-display font-bold mb-1">{ex.name}</h4>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">세트수 <b className="text-on-surface">{ex.sets}세트</b></span>
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">세트당 횟수 <b className="text-on-surface">{ex.reps}회</b></span>
              <span className="text-label-sm text-on-surface-variant flex items-center gap-1">예상 소요 <b className="text-on-surface">{ex.duration}</b></span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
            {isDone && (
              <span className="flex items-center gap-1 text-primary text-label-sm">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>완료
              </span>
            )}
            {isInProgress && (
              <span className="flex items-center gap-1 text-secondary text-label-sm animate-pulse">
                <span className="material-symbols-outlined text-sm">pending</span>진행 중
              </span>
            )}
            {ex.status === 'waiting' && (
              <span className="flex items-center gap-1 text-on-surface-variant text-label-sm">
                <span className="material-symbols-outlined text-sm">schedule</span>대기
              </span>
            )}
            <span className="text-label-sm text-on-surface-variant">{progress}%</span>
          </div>
        </div>

        {/* 진행 바 */}
        <div className="w-full bg-surface-container h-1.5 rounded-full mb-4">
          <div
            className={`h-full rounded-full transition-all duration-700 ${isDone ? 'bg-primary' : isInProgress ? 'bg-secondary' : 'bg-outline-variant'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="w-full md:w-auto">
        {isDone ? (
          <button
            disabled
            className="w-full md:w-32 h-12 border border-primary text-primary text-label-md rounded-lg cursor-not-allowed"
          >
            운동 완료
          </button>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="w-full md:w-32 h-12 bg-primary text-white text-label-md rounded-lg shadow-sm hover:bg-primary-container transition-all active:scale-95 flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-base">play_arrow</span>
            운동 시작
          </button>
        )}
      </div>

      {showModal && (
        <PreExamModal
          onConfirm={() => { setShowModal(false); handleStart(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export default function TodayExercise() {
  const [exercises, setExercises] = useState(INITIAL_EXERCISES);

  const sortedExercises = useMemo(
    () => [...exercises].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]),
    [exercises],
  );

  const completedCount = exercises.filter((e) => e.status === 'done').length;
  const totalCount = exercises.length;
  const achievementRate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleStart = (id) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, status: 'in_progress' } : ex)),
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <PatientNavBar />

      <main className="max-w-[1280px] mx-auto px-container-padding-mobile md:px-container-padding-desktop py-stack-lg">

        {/* 헤더 */}
        <header className="mb-stack-lg">
          <h1 className="text-headline-lg font-display font-bold text-primary mb-1">
            {MOCK_USER.name}님 안녕하세요!
          </h1>
        </header>

        {/* 달성률 벤토 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-lg">
          {/* 오늘 / 주간 달성률 */}
          <div className="md:col-span-2 bg-primary-container text-on-primary-container p-4 md:p-stack-lg rounded-xl flex flex-col gap-3 md:gap-6 relative overflow-hidden shadow-sm">
            <div className="relative z-10">
              <h2 className="text-label-lg md:text-title-md font-display font-bold mb-2">오늘 운동 달성률</h2>
              <div className="flex items-center gap-3">
                <span className="text-headline-lg md:text-display-lg font-display font-bold shrink-0">{achievementRate}%</span>
                <div className="flex-1 bg-white/20 h-2 md:h-3 rounded-full overflow-hidden">
                  <div
                    className="bg-primary-fixed-dim h-full transition-all duration-1000 ease-out"
                    style={{ width: `${achievementRate}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <h3 className="text-label-lg md:text-title-md font-display font-bold mb-2 md:mb-3">주간 운동 달성률</h3>
              <div className="flex gap-2 items-end h-16 md:h-24">
                {[
                  { day: '월', rate: 100 },
                  { day: '화', rate: 80 },
                  { day: '수', rate: 60 },
                  { day: '목', rate: achievementRate },
                  { day: '금', rate: 0 },
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

          {/* 완료 항목 원형 차트 */}
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
                    transition: 'stroke-dashoffset 0.6s ease',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-title-md font-bold text-primary">{completedCount}/{totalCount}</span>
                <span className="text-label-sm text-on-surface-variant uppercase tracking-wider">완료 항목</span>
              </div>
            </div>
            <p className="text-label-md text-on-surface-variant">
              총 <b className="text-on-surface">{totalCount}개</b> 중{' '}
              <b className="text-primary">{completedCount}개</b> 완료
            </p>
          </div>
        </section>

        {/* 운동 목록 */}
        <div className="flex items-center justify-between mb-stack-md">
          <h3 className="text-title-md font-display font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">format_list_bulleted</span>
            오늘의 운동 루틴
          </h3>
          {/* 모바일 완료 현황 */}
          <span className="flex md:hidden text-label-sm text-on-surface-variant">
            {completedCount}/{totalCount} 완료
          </span>
        </div>

        <div className="space-y-stack-md">
          {sortedExercises.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} onStart={handleStart} />
          ))}
        </div>
      </main>
    </div>
  );
}
