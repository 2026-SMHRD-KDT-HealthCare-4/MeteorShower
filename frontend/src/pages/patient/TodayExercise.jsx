import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import PatientNavBar from '../../components/PatientNavBar';
import { useAuth } from '../../context/AuthContext';
import { patientApi } from '../../api';
import PreExamModal, { getBlockedKey } from '../../components/PreExamModal';

const INITIAL_EXERCISES = [
  { id: 1, name: '오른손 두드리기',  sets: 3, reps: 10, duration: '5분', status: 'done',        videoTime: '01:20' },
  { id: 2, name: '왼손 두드리기',    sets: 3, reps: 10, duration: '5분', status: 'done',        videoTime: '01:20' },
  { id: 3, name: '오른손 쥐었다펴기', sets: 2, reps: 10, duration: '5분', status: 'in_progress', videoTime: '01:45' },
  { id: 4, name: '왼손 쥐었다펴기',  sets: 2, reps: 10, duration: '5분', status: 'waiting',     videoTime: '01:45' },
];

const STATUS_ORDER = { in_progress: 0, waiting: 1, done: 2 };


function TrendChart({ fromVal, toVal, delta, isUp }) {
  if (toVal === null) {
    return (
      <div className="flex items-center flex-1 min-w-0 opacity-60">
        <p className="text-[11px] md:text-label-lg font-bold">아직 데이터가 없어요</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 md:gap-5 flex-1 min-w-0">
      {/* 바 그래프 영역 */}
      <div className="flex items-end gap-1.5 md:gap-3 h-20 md:h-28 shrink-0">
        {/* 이전 바 */}
        <div className="flex flex-col items-center gap-0.5 h-full w-8 md:w-12">
          <span className="text-[10px] md:text-xs font-bold opacity-75">{fromVal ?? '-'}%</span>
          <div className="w-full flex-1 rounded-t-md bg-white/20 relative overflow-hidden">
            <div
              className="absolute bottom-0 w-full rounded-t-md bg-white/50 transition-all duration-700"
              style={{ height: `${fromVal ?? 0}%` }}
            />
          </div>
          <span className="text-[9px] md:text-[10px] opacity-55 tracking-wide">이전</span>
        </div>

        {/* 화살표 */}
        <div className="pb-5 shrink-0">
          <span className="material-symbols-outlined text-base md:text-2xl opacity-80">arrow_forward</span>
        </div>

        {/* 현재 바 */}
        <div className="flex flex-col items-center gap-0.5 h-full w-8 md:w-12">
          <span className="text-[10px] md:text-xs font-bold">{toVal}%</span>
          <div className="w-full flex-1 rounded-t-md bg-white/20 relative overflow-hidden">
            <div
              className={`absolute bottom-0 w-full rounded-t-md transition-all duration-700 ${isUp ? 'bg-white' : 'bg-white/55'}`}
              style={{ height: `${toVal}%` }}
            />
          </div>
          <span className="text-[9px] md:text-[10px] opacity-55 tracking-wide">현재</span>
        </div>
      </div>

      {/* 우측 텍스트 */}
      <div className="flex flex-col gap-0.5 min-w-0 pl-3 md:pl-5">
        {delta !== null ? (
          <>
            <p className="text-lg md:text-2xl font-display font-bold leading-none">
              {isUp ? `+${delta}%` : `${delta}%`}
            </p>
            <p className="text-[11px] md:text-label-lg font-bold leading-tight">
              {isUp ? '상승했어요!' : '감소했어요'}
            </p>
          </>
        ) : (
          <p className="text-[11px] md:text-label-lg font-bold leading-tight opacity-60">첫 번째 기록이에요!</p>
        )}
      </div>
    </div>
  );
}

function BlockedBanner() {
  const [geoState, setGeoState] = useState('idle'); // idle | locating | loading | done | error
  const [hospitals, setHospitals] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  const findHospitals = () => {
    if (!navigator.geolocation) {
      setGeoState('error');
      setErrorMsg('이 브라우저는 위치 기능을 지원하지 않습니다.');
      return;
    }
    setGeoState('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGeoState('loading');
        patientApi.getNearbyHospitals(coords.latitude, coords.longitude)
          .then((data) => { setHospitals(data); setGeoState('done'); })
          .catch(() => { setGeoState('error'); setErrorMsg('병원 정보를 불러오지 못했습니다.'); });
      },
      () => { setGeoState('error'); setErrorMsg('위치 권한을 허용해주세요.'); },
      { timeout: 8000 },
    );
  };

  return (
    <div className="mb-stack-md space-y-3">
      {/* 경고 배너 */}
      <div className="bg-error-container border border-error/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <span className="material-symbols-outlined text-error text-2xl shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
          <div>
            <p className="text-label-md font-bold text-on-error-container">오늘 운동이 차단되었습니다</p>
            <p className="text-label-sm text-on-error-container/80">사전 문진에서 증상이 확인되어 오늘 하루 운동을 진행할 수 없습니다.</p>
          </div>
        </div>
        {geoState === 'idle' && (
          <button
            onClick={findHospitals}
            className="shrink-0 flex items-center gap-2 px-4 py-2 bg-error text-white text-label-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
          >
            <span className="material-symbols-outlined text-base">location_on</span>
            주변 병원 찾기
          </button>
        )}
        {(geoState === 'locating' || geoState === 'loading') && (
          <div className="shrink-0 flex items-center gap-2 px-4 py-2 text-on-error-container text-label-sm">
            <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            {geoState === 'locating' ? '위치 확인 중...' : '병원 검색 중...'}
          </div>
        )}
        {geoState === 'error' && (
          <div className="shrink-0 flex items-center gap-2">
            <p className="text-label-sm text-error font-semibold">{errorMsg}</p>
            <button onClick={findHospitals} className="text-label-sm text-on-error-container underline">재시도</button>
          </div>
        )}
      </div>

      {/* 병원 리스트 */}
      {geoState === 'done' && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-outline-variant">
            <span className="material-symbols-outlined text-error text-lg">local_hospital</span>
            <h4 className="text-label-md font-bold text-on-surface">반경 2km 이내 병원</h4>
            <span className="ml-auto text-label-sm text-on-surface-variant">{hospitals.length}개</span>
          </div>
          {hospitals.length === 0 ? (
            <p className="p-6 text-center text-on-surface-variant text-label-sm">주변에 병원을 찾을 수 없습니다.</p>
          ) : (
            <ul className="divide-y divide-outline-variant">
              {hospitals.map((h, i) => (
                <li key={i} className="flex items-center justify-between px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-label-md font-semibold text-on-surface truncate">{h.name}</p>
                    <p className="text-label-sm text-on-surface-variant truncate">{h.address}</p>
                    {h.phone && (
                      <a href={`tel:${h.phone}`} className="text-label-sm text-primary hover:underline">{h.phone}</a>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="text-label-sm font-bold text-on-surface">{h.distance < 1000 ? `${h.distance}m` : `${(h.distance / 1000).toFixed(1)}km`}</span>
                    {h.place_url && (
                      <a
                        href={h.place_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-label-sm text-primary underline"
                      >
                        지도 보기
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}


function ExerciseCard({ ex, onStart, isBlocked, onBlocked, queue, queueIndex }) {
  const navigate = useNavigate();
  const isInProgress = ex.status === 'in_progress';
  const isDone = ex.status === 'done';

  const [showModal, setShowModal] = useState(false);

  const progress = isDone ? 100 : Math.round(ex.progress_rate ?? 0);

  const handleStart = () => {
    onStart(ex.id);
    navigate('/patient/exercise/session', { state: { exercise: ex, queue, queueIndex } });
  };

  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-4 flex flex-col md:flex-row gap-gutter items-center transition-all duration-300 relative
        ${isInProgress ? 'border-2 border-primary/30 shadow-md overflow-hidden' : 'border border-outline-variant hover:shadow-md'}
        ${isDone ? 'opacity-60' : ''}
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
            {isDone ? (
              <span className="flex items-center gap-1 text-primary text-label-sm">
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>완료
              </span>
            ) : isInProgress ? (
              <span className="flex items-center gap-1 text-secondary text-label-sm animate-pulse">
                <span className="material-symbols-outlined text-sm">pending</span>진행 중
              </span>
            ) : (
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
            className={`h-full rounded-full transition-all duration-700 ${
              isDone ? 'bg-primary' : isInProgress ? 'bg-secondary' : 'bg-outline-variant'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="w-full md:w-auto">
        {isDone ? (
          <div className="w-full md:w-32 h-12 bg-primary/10 border border-primary/30 text-primary text-label-md rounded-lg flex items-center justify-center gap-1 cursor-default select-none">
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            운동 완료
          </div>
        ) : isBlocked ? (
          <button
            disabled
            className="w-full md:w-32 h-12 bg-error/10 border border-error/30 text-error text-label-md rounded-lg cursor-not-allowed flex items-center justify-center gap-1"
          >
            <span className="material-symbols-outlined text-base">block</span>
            차단됨
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
          onBlocked={() => { setShowModal(false); onBlocked?.(); }}
        />
      )}
    </div>
  );
}


export default function TodayExercise() {
  const { user, token } = useAuth();
  const { key: locationKey } = useLocation();
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weeklyStats, setWeeklyStats] = useState([]);
  const [isBlocked, setIsBlocked] = useState(false);

  useEffect(() => {
    setLoading(true);
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setIsBlocked(localStorage.getItem(getBlockedKey(token)) === today);

    patientApi.getTodayExercises()
      .then((data) => setExercises(data))
      .catch(() => setExercises(INITIAL_EXERCISES))
      .finally(() => setLoading(false));

    patientApi.getWeeklyStats()
      .then((data) => setWeeklyStats(data))
      .catch(() => {});
  }, [locationKey]);

  const sortedExercises = useMemo(
    () => [...exercises].sort((a, b) => (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99)),
    [exercises],
  );

  const completedCount = exercises.filter((e) => e.status === 'done').length;
  const totalCount = exercises.length;
  const totalProgress = exercises.reduce(
    (sum, exercise) => sum + (exercise.status === 'done' ? 100 : Math.round(exercise.progress_rate ?? 0)),
    0,
  );
  const completionPercent = totalCount > 0 ? Math.round(totalProgress / totalCount) : 0;
  const completionRatio = completionPercent / 100;

  // 운동 변화 추세 계산
  const todayStat    = weeklyStats.find((d) => d.is_today);
  const hasTodayData = (todayStat?.total ?? 0) > 0;
  const daysWithData = weeklyStats.filter((d) => d.total > 0 && !d.is_today);
  const fromRate = daysWithData.length >= 1
    ? Math.round(daysWithData.reduce((s, d) => s + d.rate, 0) / daysWithData.length)
    : null;
  // 오늘 일정이 있으면 실시간 completionPercent를 현재값으로 사용
  const toRate   = hasTodayData ? completionPercent : (daysWithData.length >= 1 ? daysWithData[daysWithData.length - 1].rate : null);
  const delta    = fromRate !== null && toRate !== null ? toRate - fromRate : null;
  const hasTrend = delta !== null;
  const isUp     = hasTrend && delta >= 0;

  const daysWithAccuracy = weeklyStats.filter((d) => d.accuracy !== null && d.accuracy !== undefined);
  const accFrom  = daysWithAccuracy.length >= 2
    ? Math.round(daysWithAccuracy.slice(0, -1).reduce((s, d) => s + d.accuracy, 0) / (daysWithAccuracy.length - 1))
    : null;
  const accTo    = daysWithAccuracy.length >= 1 ? Math.round(daysWithAccuracy[daysWithAccuracy.length - 1].accuracy) : null;
  const accDelta = accFrom !== null && accTo !== null ? accTo - accFrom : null;
  const isAccUp  = accDelta !== null && accDelta >= 0;

  const handleStart = (id) => {
    setExercises((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, status: 'in_progress' } : ex)),
    );
  };

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0" style={{ backgroundImage: "url('/patient-bg-pattern.svg')", backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }}>
      <PatientNavBar />

      <main className="max-w-[1280px] mx-auto px-container-padding-mobile md:px-container-padding-desktop py-stack-lg">

        {/* 헤더 */}
        <header className="mb-stack-lg flex items-center justify-between gap-4">
          <h1 className="text-headline-lg font-display font-bold text-primary">
            {user?.name}님 안녕하세요!
          </h1>

          {/* 모바일 전용 오늘 완료 원형 차트 */}
          <div className="md:hidden flex flex-col items-center shrink-0">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full" viewBox="0 0 128 128">
                <circle className="text-surface-container-highest stroke-current" cx="64" cy="64" fill="transparent" r="56" strokeWidth="10" />
                <circle
                  className="text-primary stroke-current"
                  cx="64" cy="64" fill="transparent" r="56"
                  strokeLinecap="round" strokeWidth="10"
                  style={{
                    strokeDasharray: '351.85',
                    strokeDashoffset: `${351.85 * (1 - completionRatio)}`,
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                    transition: 'stroke-dashoffset 0.6s ease',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xs font-bold text-primary leading-none">{completionPercent}%</span>
              </div>
            </div>
            <span className="text-[10px] text-on-surface-variant mt-0.5">오늘 진행률</span>
          </div>
        </header>

        {/* 운동 변화 벤토 */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-stack-lg">

          {/* 운동 변화 + 정확도 변화 카드 */}
          <div className="md:col-span-2 bg-primary-container text-on-primary-container px-4 py-3 md:px-6 md:py-4 rounded-xl relative overflow-hidden shadow-sm">

            {/* 좌/우 2분할 — 항상 가로 배치 */}
            <div className="flex gap-0 min-w-0">

              {/* ── 왼쪽: 운동 변화 ── */}
              <div className="flex-1 flex flex-col gap-2 pr-3 md:pr-6 min-w-0">
                <h2 className="text-label-md md:text-title-sm font-display font-bold truncate">운동 변화</h2>
                {hasTrend ? (
                  <TrendChart fromVal={fromRate} toVal={toRate} delta={delta} isUp={isUp} />
                ) : (
                  <div className="flex flex-col justify-center flex-1 gap-1 opacity-75">
                    <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>directions_run</span>
                    <p className="text-label-sm font-bold">기록을 쌓는 중</p>
                    <p className="text-[10px] opacity-70">2회 이상 운동하면 볼 수 있어요</p>
                  </div>
                )}
              </div>

              {/* 구분선 */}
              <div className="w-px self-stretch bg-white/20 mx-1 md:mx-2 shrink-0" />

              {/* ── 오른쪽: 정확도 변화 ── */}
              <div className="flex-1 flex flex-col gap-2 pl-3 md:pl-6 min-w-0">
                <h2 className="text-label-md md:text-title-sm font-display font-bold truncate">동작 정확도</h2>
                <TrendChart fromVal={accFrom} toVal={accTo} delta={accDelta} isUp={isAccUp} />
              </div>

            </div>

            <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
              <span className="material-symbols-outlined text-[140px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                {isUp ? 'trending_up' : 'fitness_center'}
              </span>
            </div>
          </div>

          {/* 오늘 완료 현황 원형 차트 */}
          <div className="hidden md:flex bg-surface-container-lowest border border-outline-variant px-4 py-3 rounded-xl flex-col items-center justify-center text-center shadow-sm gap-2">
            <div className="relative w-20 h-20">
              <svg className="w-full h-full" viewBox="0 0 128 128">
                <circle className="text-surface-container-highest stroke-current" cx="64" cy="64" fill="transparent" r="56" strokeWidth="10" />
                <circle
                  className="text-primary stroke-current"
                  cx="64" cy="64" fill="transparent" r="56"
                  strokeLinecap="round" strokeWidth="10"
                  style={{
                    strokeDasharray: '351.85',
                    strokeDashoffset: `${351.85 * (1 - completionRatio)}`,
                    transform: 'rotate(-90deg)',
                    transformOrigin: '50% 50%',
                    transition: 'stroke-dashoffset 0.6s ease',
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-label-lg font-bold text-primary leading-none">{completionPercent}%</span>
                <span className="text-[10px] text-on-surface-variant tracking-wider mt-0.5">진행률</span>
              </div>
            </div>
            <p className="text-label-sm text-on-surface-variant">
              총 <b className="text-on-surface">{totalCount}개</b> 중{' '}
              <b className="text-primary">{completedCount}개</b> 완료
            </p>
          </div>
        </section>

        {/* 운동 목록 */}
        <div className="flex items-center mb-stack-md">
          <h3 className="text-title-md font-display font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">format_list_bulleted</span>
            오늘의 운동 루틴
          </h3>
        </div>

        {/* 차단 배너 + 주변 병원 추천 */}
        {isBlocked && <BlockedBanner />}

        <div className="space-y-stack-md">
          {loading ? (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center text-on-surface-variant">
              오늘 운동을 불러오는 중입니다.
            </div>
          ) : sortedExercises.length > 0 ? (
            sortedExercises.map((ex) => {
              const queue = sortedExercises.filter((e) => e.status !== 'done');
              const queueIndex = queue.findIndex((e) => e.id === ex.id);
              return (
                <ExerciseCard
                  key={ex.id}
                  ex={ex}
                  onStart={handleStart}
                  isBlocked={isBlocked}
                  onBlocked={() => setIsBlocked(true)}
                  queue={queue}
                  queueIndex={queueIndex}
                />
              );
            })
          ) : (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-8 text-center text-on-surface-variant">
              오늘 등록된 운동이 없습니다.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
