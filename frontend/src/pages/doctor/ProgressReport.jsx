import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';
import { patientApi } from '../../api';

const EX_COLORS = ['#1a73e8', '#005bbf', '#006398', '#0077b6'];

const valueOrDash = (value, suffix = '') =>
  value === null || value === undefined || Number.isNaN(value) ? '-' : `${value}${suffix}`;

const percentOrDash = (value) => valueOrDash(value, '%');

function MiniTrendBar({ data, color }) {
  const clean = data.map((value) => value ?? 0);
  const max = Math.max(...clean, 1);
  return (
    <div className="flex items-end gap-1 h-10">
      {clean.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full rounded-t transition-all duration-500"
            style={{ height: `${Math.round((v / max) * 32)}px`, background: color }}
          />
          <span className="text-[9px] text-outline">{i + 1}주</span>
        </div>
      ))}
    </div>
  );
}

export default function ProgressReport() {
  const navigate = useNavigate();
  const location = useLocation();
  const patientId = location.state?.patientId ?? '';

  const [weekIdx, setWeekIdx]               = useState(0);
  const [romExerciseIdx, setRomExerciseIdx] = useState(0);
  const [romFingerIdx, setRomFingerIdx]     = useState(0);
  const [patient, setPatient]               = useState(null);
  const [weeklyData, setWeeklyData]         = useState([]);
  const [summary, setSummary]               = useState(null);
  const [keywords, setKeywords]             = useState([]);
  const [loading, setLoading]               = useState(!!patientId);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [editedSummary, setEditedSummary]       = useState('');
  const [savingSummary, setSavingSummary]       = useState(false);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    Promise.all([
      patientApi.getPatient(patientId),
      patientApi.getPatientWeeklyProgress(patientId),
    ])
      .then(([patientData, progressData]) => {
        setPatient(patientData);
        const weeks = Array.isArray(progressData) ? progressData : (progressData.weeks ?? []);
        setWeeklyData(weeks);
        setSummary(Array.isArray(progressData) ? null : progressData.summary);
        setKeywords(Array.isArray(progressData) ? [] : (progressData.keywords ?? []));
        setWeekIdx(Math.max(weeks.length - 1, 0));
      })
      .catch(() => {
        setWeeklyData([]);
        setSummary(null);
        setKeywords([]);
        setWeekIdx(0);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  const week = weeklyData[weekIdx] ?? weeklyData[weeklyData.length - 1] ?? {
    week: '-',
    dates: '-',
    sessionCount: null,
    overallCompliance: null,
    accuracyAvg: null,
    exercises: [],
    rom: [],
  };
  const exerciseNames = Array.from(new Set(weeklyData.flatMap((w) => (w.exercises ?? []).map((ex) => ex.name))));
  const currentRomExercise = week.rom?.[romExerciseIdx];
  const currentRomFinger = currentRomExercise?.fingers?.[romFingerIdx];

  return (
    <div className="min-h-screen bg-background" style={{ backgroundImage: "url('/doctor-bg-pattern.svg')", backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }}>
      <DoctorNavBar />

      <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/doctor/patients')}
            className="flex items-center gap-2 text-on-surface-variant hover:text-doctor-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-label-md font-medium">Back to Dashboard</span>
          </button>
          <div className="flex gap-2">
            <button
              onClick={() => patientId && navigate(`/doctor/patient/info/${patientId}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-doctor-primary text-doctor-primary font-semibold text-label-sm hover:bg-[#e8f0fe] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!patientId}
            >
              <span className="material-symbols-outlined text-sm">person</span>
              환자 정보
            </button>
            <button
              onClick={() => navigate('/doctor/report/daily', { state: { patientId } })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-doctor-primary text-white font-semibold text-label-sm hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">today</span>
              일일 리포트
            </button>
          </div>
        </div>

        {/* 타이틀 */}
        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-doctor-primary tracking-tight">
            누적 재활 리포트
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {loading
              ? '불러오는 중...'
              : patient
                ? `${patient.name} 환자 · 재활 ${weeklyData.length}주차 누적 결과 (${weeklyData[0]?.dates?.split(' ~ ')[0] ?? ''} ~ ${weeklyData[weeklyData.length - 1]?.dates?.split(' ~ ')[1] ?? ''})`
                : '누적 재활 결과'
            }
          </p>
        </div>

        {/* 요약 통계 */}
        {(() => {
          const complianceValues = weeklyData
            .map((w) => w.overallCompliance)
            .filter((value) => value !== null && value !== undefined);
          const avgCompliance = complianceValues.length
            ? Math.round(complianceValues.reduce((s, value) => s + Number(value), 0) / complianceValues.length)
            : null;
          const improvement = complianceValues.length >= 2
            ? Number(complianceValues[complianceValues.length - 1]) - Number(complianceValues[0])
            : null;
          const exCount = week?.exercises?.length ?? 0;
          const computed = [
            { label: '평균 달성률', value: loading ? '—' : percentOrDash(avgCompliance),       icon: 'target',         color: '#1a73e8', bg: 'bg-[#e8f0fe]' },
            { label: '전체 향상률', value: loading ? '—' : improvement === null ? '-' : `${improvement >= 0 ? '+' : ''}${improvement}%`, icon: 'trending_up', color: '#1a73e8', bg: 'bg-[#e8f0fe]' },
            { label: '재활 기간',   value: loading || weeklyData.length === 0 ? '—' : `${weeklyData.length}주`,  icon: 'calendar_month', color: '#006398', bg: 'bg-[#cce5ff]' },
            { label: '처방 운동 수', value: loading ? '—' : `${exCount}종`,           icon: 'fitness_center', color: '#1a73e8', bg: 'bg-[#e8f0fe]' },
          ];
          return (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {computed.map((s) => (
                <div key={s.label} className="bg-white border border-outline-variant rounded-2xl p-4 shadow-card flex items-center gap-3">
                  <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <span className="material-symbols-outlined" style={{ color: s.color }}>{s.icon}</span>
                  </div>
                  <div>
                    <p className="text-label-sm text-on-surface-variant">{s.label}</p>
                    <p className="text-title-md font-bold" style={{ color: s.color }}>{s.value}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* ── 주차별 상세 보기 ── */}
        <section className="bg-white border border-outline-variant rounded-2xl shadow-card overflow-hidden">

          {/* 주차 탭 헤더 */}
          <div className="flex border-b border-outline-variant overflow-x-auto">
            {weeklyData.map((w, i) => (
              <button
                key={w.week}
                onClick={() => { setWeekIdx(i); setRomExerciseIdx(0); setRomFingerIdx(0); }}
                className={`flex-shrink-0 px-6 py-4 text-label-md font-semibold transition-colors border-r border-outline-variant last:border-0
                  ${weekIdx === i
                    ? 'bg-doctor-primary text-white'
                    : 'text-on-surface-variant hover:bg-[#f0f6ff] hover:text-doctor-primary'
                  }`}
              >
                <div>{w.week}</div>
                <div className={`text-[11px] font-normal mt-0.5 ${weekIdx === i ? 'text-white/70' : 'text-outline'}`}>{w.dates}</div>
              </button>
            ))}
          </div>

          <div className="p-6 space-y-6">

            {/* 주차 개요 카드 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-[#f0f6ff] rounded-xl p-4 text-center">
                <p className="text-label-sm text-on-surface-variant">전체 달성률</p>
                <p className="text-[32px] font-bold text-doctor-primary leading-tight mt-1">{percentOrDash(week.overallCompliance)}</p>
              </div>
              <div className="bg-[#f0f6ff] rounded-xl p-4 text-center">
                <p className="text-label-sm text-on-surface-variant">평균 일치율</p>
                <p className="text-[32px] font-bold text-[#1a73e8] leading-tight mt-1">{percentOrDash(week.accuracyAvg)}</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-4 text-center">
                <p className="text-label-sm text-on-surface-variant">운동 세션 수</p>
                <p className="text-[32px] font-bold text-on-surface leading-tight mt-1">{valueOrDash(week.sessionCount, '회')}</p>
              </div>
            </div>

            {/* 운동별 달성률 테이블 */}
            <div>
              <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>fitness_center</span>
                운동별 달성률 / 일치율
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse border border-outline-variant rounded-xl overflow-hidden">
                  <thead>
                    <tr className="bg-[#f0f6ff] border-b border-outline-variant">
                      <th className="px-4 py-2.5 text-label-sm font-bold text-doctor-primary text-left">운동</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-doctor-primary text-center">달성률</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-doctor-primary text-center">일치율</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-doctor-primary text-center w-32">달성률 추이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {week.exercises.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-6 text-center text-label-md text-on-surface-variant">-</td>
                      </tr>
                    ) : week.exercises.map((ex, i) => {
                      const trend = weeklyData.map((w) => (w.exercises ?? []).find((item) => item.name === ex.name)?.compliance ?? null);
                      const warn = ex.compliance !== null && ex.compliance !== undefined && ex.compliance < 70;
                      return (
                        <tr key={ex.name} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-lowest transition-colors">
                          <td className="px-4 py-3 text-label-md font-semibold text-on-surface">{ex.name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-label-md font-bold ${warn ? 'text-error' : 'text-doctor-primary'}`}>
                              {percentOrDash(ex.compliance)}
                            </span>
                            {warn && (
                              <span className="ml-1 material-symbols-outlined text-error text-sm align-middle" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-label-md font-semibold text-[#1a73e8]">{percentOrDash(ex.accuracy)}</td>
                          <td className="px-4 py-3">
                            <MiniTrendBar data={trend} color={EX_COLORS[i % EX_COLORS.length]} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROM 상세 */}
            <div>
              <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>straighten</span>
                관절 가동 범위 (ROM) 상세 — {week.week}
              </h3>

              <div className="border border-outline-variant rounded-xl overflow-hidden">
                {/* 운동 카테고리 탭 */}
                <div className="flex overflow-x-auto border-b border-outline-variant">
                  {(week.rom ?? []).length === 0 ? (
                    <div className="px-4 py-3 text-label-md text-on-surface-variant">-</div>
                  ) : week.rom.map((ex, i) => (
                    <button
                      key={ex.key}
                      onClick={() => { setRomExerciseIdx(i); setRomFingerIdx(0); }}
                      className={`flex-shrink-0 flex-1 px-3 py-2 text-label-sm font-semibold transition-colors border-r border-outline-variant last:border-0
                        ${romExerciseIdx === i
                          ? 'bg-doctor-primary text-white'
                          : 'bg-[#f0f6ff] text-on-surface-variant hover:bg-[#e8f0fe] hover:text-doctor-primary'
                        }`}
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>

                {/* 손가락 탭 */}
                <div className="flex overflow-x-auto border-b border-outline-variant">
                  {currentRomExercise?.fingers?.map((f, i) => (
                    <button
                      key={f.key}
                      onClick={() => setRomFingerIdx(i)}
                      className={`flex-shrink-0 flex-1 px-4 py-2 text-label-sm font-semibold transition-colors border-r border-outline-variant last:border-0
                        ${romFingerIdx === i
                          ? 'bg-[#e8f0fe] text-doctor-primary font-bold'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-[#e8f0fe] hover:text-doctor-primary'
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* 관절 테이블 */}
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#f8fafe] border-b border-outline-variant">
                      <th className="px-4 py-2.5 text-label-sm font-bold text-on-surface-variant text-left">관절</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-on-surface-variant text-center">기준값 (ROM)</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-[#1a73e8] text-center">최댓값</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-[#005bbf] text-center">최솟값</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-on-surface-variant text-center">달성율</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-on-surface-variant text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentRomFinger?.joints?.length ? currentRomFinger.joints.map((j) => {
                      const rawRatio = j.achievement ?? (j.max !== null && j.max !== undefined && j.ref ? Math.round((j.max / j.ref) * 100) : null);
                      const ratio = rawRatio === null || rawRatio === undefined ? null : Math.min(rawRatio, 100);
                      const warn = ratio !== null && ratio !== undefined && ratio < 85;
                      return (
                        <tr key={j.name} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-lowest transition-colors">
                          <td className="px-4 py-3 text-label-md font-bold text-on-surface">{j.name}</td>
                          <td className="px-4 py-3 text-center text-label-md text-on-surface-variant">{valueOrDash(j.ref, '°')}</td>
                          <td className="px-4 py-3 text-center text-label-md font-bold" style={{ color: warn ? '#ba1a1a' : '#1a73e8' }}>{valueOrDash(j.max, '°')}</td>
                          <td className="px-4 py-3 text-center text-label-md font-semibold text-[#005bbf]">{valueOrDash(j.min, '°')}</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-surface-container h-2 rounded-full overflow-hidden min-w-[60px]">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${ratio === null || ratio === undefined ? 0 : Math.min(ratio, 100)}%`, background: warn ? '#ba1a1a' : '#1a73e8' }}
                                />
                              </div>
                              <span className="text-label-sm font-bold w-10 text-right flex-shrink-0" style={{ color: warn ? '#ba1a1a' : '#1a73e8' }}>{percentOrDash(ratio)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {ratio === null || ratio === undefined ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-on-surface-variant bg-surface-container px-2 py-0.5 rounded-full">-</span>
                            ) : warn ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-error bg-error-container px-2 py-0.5 rounded-full">
                                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>주의
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-doctor-primary bg-[#e8f0fe] px-2 py-0.5 rounded-full">
                                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>정상
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }) : (
                      <tr>
                        <td colSpan={6} className="px-4 py-6 text-center text-label-md text-on-surface-variant">-</td>
                      </tr>
                    )}
                  </tbody>
                </table>
                <div className="px-4 py-2 bg-surface-container-low border-t border-outline-variant">
                  <p className="text-[11px] text-on-surface-variant">기준값: 의사가 입력한 목표 ROM · 달성율 = 최댓값 / 기준값 × 100</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── 4주 전체 추이 ── */}
        <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-5">
          <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>trending_up</span>
            4주 전체 달성률 추이
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {exerciseNames.length === 0 ? (
              <div className="sm:col-span-2 border border-outline-variant rounded-xl p-6 text-center text-label-md text-on-surface-variant">-</div>
            ) : exerciseNames.map((name, ei) => {
              const trend = weeklyData.map((w) => (w.exercises ?? []).find((exercise) => exercise.name === name)?.compliance ?? null);
              const color = EX_COLORS[ei % EX_COLORS.length];
              const validTrend = trend.filter((value) => value !== null && value !== undefined);
              const gain = validTrend.length >= 2 ? validTrend[validTrend.length - 1] - validTrend[0] : null;
              return (
                <div key={name} className="border border-outline-variant rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-label-md font-semibold text-on-surface">{name}</span>
                    <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ color, background: color + '18' }}>
                      {gain === null ? '-' : `${gain >= 0 ? '+' : ''}${gain}%`}
                    </span>
                  </div>
                  <div className="flex items-end gap-3 h-20">
                    {trend.map((val, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-label-sm font-bold" style={{ color }}>{percentOrDash(val)}</span>
                        <div className="w-full rounded-t-lg transition-all duration-700"
                          style={{ height: `${Math.round((val ?? 0) * 0.55)}px`, background: color }} />
                        <span className="text-[11px] text-outline font-semibold">{i + 1}주차</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 종합 평가 + 출력 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
                종합 평가
              </h2>
              {!isEditingSummary ? (
                <button
                  onClick={() => { setEditedSummary(summary || ''); setIsEditingSummary(true); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-label-sm font-semibold text-doctor-primary border border-doctor-primary hover:bg-[#e8f0fe] transition-colors"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  수정
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsEditingSummary(false)}
                    className="px-3 py-1.5 rounded-lg text-label-sm font-semibold text-on-surface-variant border border-outline-variant hover:bg-surface-container transition-colors"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => {
                      setSavingSummary(true);
                      patientApi.saveOverallEvaluation(patientId, { summary: editedSummary })
                        .then(() => { setSummary(editedSummary); setIsEditingSummary(false); })
                        .catch(() => {})
                        .finally(() => setSavingSummary(false));
                    }}
                    disabled={savingSummary}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-label-sm font-semibold text-white bg-doctor-primary hover:brightness-110 transition-colors disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined text-base">save</span>
                    {savingSummary ? '저장 중...' : '저장'}
                  </button>
                </div>
              )}
            </div>
            {isEditingSummary ? (
              <textarea
                value={editedSummary}
                onChange={(e) => setEditedSummary(e.target.value)}
                rows={6}
                className="w-full border border-outline-variant rounded-xl p-3 text-body-md text-on-surface resize-none focus:outline-none focus:ring-2 focus:ring-doctor-primary"
              />
            ) : (
              <p className="text-body-md text-on-surface-variant leading-relaxed">
                {summary || '-'}
              </p>
            )}
            <div className="flex gap-2 flex-wrap pt-1">
              {keywords.length > 0 ? keywords.map((keyword, index) => (
                <span
                  key={`${keyword}-${index}`}
                  className="px-3 py-1 bg-[#e8f0fe] text-doctor-primary rounded-full text-label-sm font-semibold"
                >
                  {keyword}
                </span>
              )) : (
                <span className="px-3 py-1 bg-surface-container text-on-surface-variant rounded-full text-label-sm font-semibold">-</span>
              )}
            </div>
          </section>

          <div className="flex flex-col gap-3">
            <section className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-card">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-outline-variant bg-surface-container-low">
                <span className="material-symbols-outlined text-doctor-primary text-base" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                <h2 className="text-label-md font-bold text-doctor-primary">환자 정보</h2>
              </div>
              <div className="divide-y divide-outline-variant">
                {[
                  { label: '성명 (Name)',        value: patient?.name },
                  { label: '환자번호 (Code)',    value: patient?.patient_code },
                  { label: '성별 (Gender)',      value: patient?.gender },
                  { label: '생년월일 (Birth)',   value: patient?.birth_date },
                  { label: '수술명 (Surgery)',   value: patient?.surgery_name },
                  { label: '수술일 (Date)',      value: patient?.surgery_date },
                  { label: '진행 단계 (Stage)', value: patient?.current_rehab_phase },
                  { label: '재활 시작일',        value: patient?.rehab_start_date },
                ].map((info, i) => (
                  <div key={i} className="flex">
                    <div className="w-28 flex-shrink-0 bg-surface-container-low px-3 py-2 text-label-sm font-semibold text-on-surface-variant border-r border-outline-variant">
                      {info.label}
                    </div>
                    <div className="flex-1 px-3 py-2 text-label-sm text-on-surface">
                      {loading ? '—' : (info.value ?? '—')}
                    </div>
                  </div>
                ))}
              </div>
            </section>
            <button
              onClick={() => window.print()}
              className="w-full py-3 border-2 border-doctor-primary text-doctor-primary font-semibold rounded-2xl flex items-center justify-center gap-2 hover:bg-doctor-primary hover:text-white transition-all text-label-md"
            >
              <span className="material-symbols-outlined text-base">print</span>
              리포트 출력
            </button>
          </div>
        </div>

      </main>
    </div>
  );
}
