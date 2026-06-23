import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';
import { patientApi } from '../../api';

const patientInfo = [
  { label: '성명 (Name)',        value: '김망나뇽' },
  { label: '환자번호 (Code)',    value: 'F310957194583' },
  { label: '성별 (Gender)',      value: '남자' },
  { label: '생년월일 (Birth)',   value: '1960.01.02' },
  { label: '수술명 (Surgery)',   value: '손가락 골절 수술' },
  { label: '수술일 (Date)',      value: '2026.01.01' },
  { label: '진행 단계 (Stage)', value: '손가락 굽히기 운동' },
  { label: '재활 시작일',        value: '2026.01.25' },
];

const EXERCISE_NAMES = [
  '오른손 태핑 (Tapping)',
  '왼손 태핑 (Tapping)',
  '오른손 그립 (Grip)',
  '왼손 그립 (Grip)',
];

function buildRomByExercise(fingers) {
  const sc = (jts, s) => jts.map(j => ({ name: j.name, ref: j.ref, max: +(j.max * s).toFixed(1), min: +(j.min * s).toFixed(1) }));
  const sf = (s) => fingers.map(f => ({ ...f, joints: sc(f.joints, s) }));
  return [
    { key: 'right_tapping', label: '오른손 태핑', fingers: sf(1.03) },
    { key: 'left_tapping',  label: '왼손 태핑',   fingers: sf(0.97) },
    { key: 'right_grip',    label: '오른손 그립',  fingers: sf(1.00) },
    { key: 'left_grip',     label: '왼손 그립',    fingers: sf(0.94) },
  ];
}

const WEEKLY_DATA = [
  {
    week: '1주차', dates: '2026.01.25 ~ 2026.01.31', sessionCount: 4,
    overallCompliance: 64, accuracyAvg: 59,
    exercises: [
      { name: '오른손 태핑 (Tapping)', compliance: 72, accuracy: 68 },
      { name: '왼손 태핑 (Tapping)',   compliance: 65, accuracy: 60 },
      { name: '오른손 그립 (Grip)',    compliance: 60, accuracy: 55 },
      { name: '왼손 그립 (Grip)',      compliance: 58, accuracy: 52 },
    ],
    rom: buildRomByExercise([
      { key: 'thumb',  label: '엄지 (Thumb)',
        joints: [{ name: 'MCP', ref: 50.0,  max: 38.0, min: 22.0 }, { name: 'PIP', ref: 80.0,  max: 60.0, min: 42.0 }, { name: 'DIP', ref: 60.0,  max: 45.0, min: 30.0 }] },
      { key: 'index',  label: '검지 (Index)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 70.0, min: 50.0 }, { name: 'PIP', ref: 100.0, max: 82.0, min: 58.0 }, { name: 'DIP', ref: 80.0,  max: 64.0, min: 44.0 }] },
      { key: 'middle', label: '중지 (Middle)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 72.0, min: 52.0 }, { name: 'PIP', ref: 100.0, max: 84.0, min: 62.0 }, { name: 'DIP', ref: 80.0,  max: 66.0, min: 48.0 }] },
      { key: 'ring',   label: '약지 (Ring)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 55.0, min: 32.0 }, { name: 'PIP', ref: 100.0, max: 65.0, min: 40.0 }, { name: 'DIP', ref: 80.0,  max: 50.0, min: 28.0 }] },
      { key: 'pinky',  label: '소지 (Pinky)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 68.0, min: 48.0 }, { name: 'PIP', ref: 100.0, max: 78.0, min: 55.0 }, { name: 'DIP', ref: 80.0,  max: 62.0, min: 42.0 }] },
    ]),
  },
  {
    week: '2주차', dates: '2026.02.01 ~ 2026.02.07', sessionCount: 5,
    overallCompliance: 73, accuracyAvg: 68,
    exercises: [
      { name: '오른손 태핑 (Tapping)', compliance: 80, accuracy: 76 },
      { name: '왼손 태핑 (Tapping)',   compliance: 70, accuracy: 66 },
      { name: '오른손 그립 (Grip)',    compliance: 65, accuracy: 62 },
      { name: '왼손 그립 (Grip)',      compliance: 64, accuracy: 60 },
    ],
    rom: buildRomByExercise([
      { key: 'thumb',  label: '엄지 (Thumb)',
        joints: [{ name: 'MCP', ref: 50.0,  max: 42.0, min: 26.0 }, { name: 'PIP', ref: 80.0,  max: 66.0, min: 48.0 }, { name: 'DIP', ref: 60.0,  max: 50.0, min: 35.0 }] },
      { key: 'index',  label: '검지 (Index)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 76.0, min: 55.0 }, { name: 'PIP', ref: 100.0, max: 88.0, min: 64.0 }, { name: 'DIP', ref: 80.0,  max: 70.0, min: 50.0 }] },
      { key: 'middle', label: '중지 (Middle)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 78.0, min: 58.0 }, { name: 'PIP', ref: 100.0, max: 90.0, min: 68.0 }, { name: 'DIP', ref: 80.0,  max: 72.0, min: 54.0 }] },
      { key: 'ring',   label: '약지 (Ring)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 60.0, min: 38.0 }, { name: 'PIP', ref: 100.0, max: 72.0, min: 46.0 }, { name: 'DIP', ref: 80.0,  max: 56.0, min: 34.0 }] },
      { key: 'pinky',  label: '소지 (Pinky)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 74.0, min: 54.0 }, { name: 'PIP', ref: 100.0, max: 84.0, min: 62.0 }, { name: 'DIP', ref: 80.0,  max: 68.0, min: 48.0 }] },
    ]),
  },
  {
    week: '3주차', dates: '2026.02.08 ~ 2026.02.14', sessionCount: 5,
    overallCompliance: 82, accuracyAvg: 77,
    exercises: [
      { name: '오른손 태핑 (Tapping)', compliance: 88, accuracy: 84 },
      { name: '왼손 태핑 (Tapping)',   compliance: 78, accuracy: 74 },
      { name: '오른손 그립 (Grip)',    compliance: 72, accuracy: 70 },
      { name: '왼손 그립 (Grip)',      compliance: 70, accuracy: 68 },
    ],
    rom: buildRomByExercise([
      { key: 'thumb',  label: '엄지 (Thumb)',
        joints: [{ name: 'MCP', ref: 50.0,  max: 46.0, min: 32.0 }, { name: 'PIP', ref: 80.0,  max: 71.0, min: 52.0 }, { name: 'DIP', ref: 60.0,  max: 54.0, min: 38.0 }] },
      { key: 'index',  label: '검지 (Index)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 83.0, min: 60.0 }, { name: 'PIP', ref: 100.0, max: 93.0, min: 68.0 }, { name: 'DIP', ref: 80.0,  max: 74.0, min: 54.0 }] },
      { key: 'middle', label: '중지 (Middle)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 85.0, min: 63.0 }, { name: 'PIP', ref: 100.0, max: 96.0, min: 72.0 }, { name: 'DIP', ref: 80.0,  max: 74.0, min: 56.0 }] },
      { key: 'ring',   label: '약지 (Ring)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 64.0, min: 42.0 }, { name: 'PIP', ref: 100.0, max: 75.0, min: 50.0 }, { name: 'DIP', ref: 80.0,  max: 60.0, min: 36.0 }] },
      { key: 'pinky',  label: '소지 (Pinky)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 78.0, min: 57.0 }, { name: 'PIP', ref: 100.0, max: 88.0, min: 65.0 }, { name: 'DIP', ref: 80.0,  max: 72.0, min: 52.0 }] },
    ]),
  },
  {
    week: '4주차', dates: '2026.02.15 ~ 2026.02.21', sessionCount: 3,
    overallCompliance: 90, accuracyAvg: 83,
    exercises: [
      { name: '오른손 태핑 (Tapping)', compliance: 91, accuracy: 90 },
      { name: '왼손 태핑 (Tapping)',   compliance: 84, accuracy: 80 },
      { name: '오른손 그립 (Grip)',    compliance: 79, accuracy: 78 },
      { name: '왼손 그립 (Grip)',      compliance: 77, accuracy: 75 },
    ],
    rom: buildRomByExercise([
      { key: 'thumb',  label: '엄지 (Thumb)',
        joints: [{ name: 'MCP', ref: 50.0,  max: 45.2, min: 28.5 }, { name: 'PIP', ref: 80.0,  max: 73.0, min: 54.0 }, { name: 'DIP', ref: 60.0,  max: 55.5, min: 38.0 }] },
      { key: 'index',  label: '검지 (Index)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 85.5, min: 62.0 }, { name: 'PIP', ref: 100.0, max: 95.0, min: 70.0 }, { name: 'DIP', ref: 80.0,  max: 72.5, min: 51.0 }] },
      { key: 'middle', label: '중지 (Middle)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 88.0, min: 65.0 }, { name: 'PIP', ref: 100.0, max: 98.5, min: 72.0 }, { name: 'DIP', ref: 80.0,  max: 76.0, min: 55.0 }] },
      { key: 'ring',   label: '약지 (Ring)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 65.0, min: 40.0 }, { name: 'PIP', ref: 100.0, max: 72.0, min: 45.0 }, { name: 'DIP', ref: 80.0,  max: 58.0, min: 35.0 }] },
      { key: 'pinky',  label: '소지 (Pinky)',
        joints: [{ name: 'MCP', ref: 90.0,  max: 80.0, min: 58.0 }, { name: 'PIP', ref: 100.0, max: 88.0, min: 65.0 }, { name: 'DIP', ref: 80.0,  max: 70.0, min: 50.0 }] },
    ]),
  },
];

const summaryStats = [
  { label: '평균 달성률', value: '77%',  icon: 'target',         color: '#1a73e8', bg: 'bg-[#e8f0fe]' },
  { label: '4주 향상률',  value: '+26%', icon: 'trending_up',    color: '#1a73e8', bg: 'bg-[#e8f0fe]' },
  { label: '재활 기간',   value: '4주',  icon: 'calendar_month', color: '#006398', bg: 'bg-[#cce5ff]' },
  { label: '처방 운동 수', value: '4종', icon: 'fitness_center',  color: '#1a73e8', bg: 'bg-[#e8f0fe]' },
];

const EX_COLORS = ['#1a73e8', '#005bbf', '#006398', '#0077b6'];

function MiniTrendBar({ data, color }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-1 h-10">
      {data.map((v, i) => (
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
  const [weeklyData, setWeeklyData]         = useState(WEEKLY_DATA);
  const [loading, setLoading]               = useState(!!patientId);

  useEffect(() => {
    if (!patientId) { setLoading(false); return; }
    Promise.all([
      patientApi.getPatient(patientId),
      patientApi.getPatientWeeklyProgress(patientId),
    ])
      .then(([patientData, progressData]) => {
        setPatient(patientData);
        if (progressData.length > 0) {
          const merged = progressData.map((w, i) => ({
            ...w,
            rom: WEEKLY_DATA[Math.min(i, WEEKLY_DATA.length - 1)].rom,
          }));
          setWeeklyData(merged);
          setWeekIdx(merged.length - 1);
        }
      })
      .catch(() => {
        setWeeklyData(WEEKLY_DATA);
        setWeekIdx(WEEKLY_DATA.length - 1);
      })
      .finally(() => setLoading(false));
  }, [patientId]);

  const week = weeklyData[weekIdx] ?? weeklyData[weeklyData.length - 1];

  return (
    <div className="min-h-screen bg-background">
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
          const avgCompliance = weeklyData.length
            ? Math.round(weeklyData.reduce((s, w) => s + w.overallCompliance, 0) / weeklyData.length)
            : 0;
          const improvement = weeklyData.length >= 2
            ? weeklyData[weeklyData.length - 1].overallCompliance - weeklyData[0].overallCompliance
            : 0;
          const exCount = week?.exercises?.length ?? 0;
          const computed = [
            { label: '평균 달성률', value: loading ? '—' : `${avgCompliance}%`,       icon: 'target',         color: '#1a73e8', bg: 'bg-[#e8f0fe]' },
            { label: '전체 향상률', value: loading ? '—' : `${improvement >= 0 ? '+' : ''}${improvement}%`, icon: 'trending_up', color: '#1a73e8', bg: 'bg-[#e8f0fe]' },
            { label: '재활 기간',   value: loading ? '—' : `${weeklyData.length}주`,  icon: 'calendar_month', color: '#006398', bg: 'bg-[#cce5ff]' },
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
                <p className="text-[32px] font-bold text-doctor-primary leading-tight mt-1">{week.overallCompliance}%</p>
              </div>
              <div className="bg-[#f0f6ff] rounded-xl p-4 text-center">
                <p className="text-label-sm text-on-surface-variant">평균 일치율</p>
                <p className="text-[32px] font-bold text-[#1a73e8] leading-tight mt-1">{week.accuracyAvg}%</p>
              </div>
              <div className="bg-surface-container-low rounded-xl p-4 text-center">
                <p className="text-label-sm text-on-surface-variant">운동 세션 수</p>
                <p className="text-[32px] font-bold text-on-surface leading-tight mt-1">{week.sessionCount}회</p>
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
                    {week.exercises.map((ex, i) => {
                      const trend = WEEKLY_DATA.map((w) => w.exercises[i].compliance);
                      const warn = ex.compliance < 70;
                      return (
                        <tr key={ex.name} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-lowest transition-colors">
                          <td className="px-4 py-3 text-label-md font-semibold text-on-surface">{ex.name}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-label-md font-bold ${warn ? 'text-error' : 'text-doctor-primary'}`}>
                              {ex.compliance}%
                            </span>
                            {warn && (
                              <span className="ml-1 material-symbols-outlined text-error text-sm align-middle" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center text-label-md font-semibold text-[#1a73e8]">{ex.accuracy}%</td>
                          <td className="px-4 py-3">
                            <MiniTrendBar data={trend} color={EX_COLORS[i]} />
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
                  {week.rom.map((ex, i) => (
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
                  {week.rom[romExerciseIdx].fingers.map((f, i) => (
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
                    {week.rom[romExerciseIdx].fingers[romFingerIdx].joints.map((j) => {
                      const ratio = Math.round((j.max / j.ref) * 100);
                      const warn = ratio < 85;
                      return (
                        <tr key={j.name} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-lowest transition-colors">
                          <td className="px-4 py-3 text-label-md font-bold text-on-surface">{j.name}</td>
                          <td className="px-4 py-3 text-center text-label-md text-on-surface-variant">{j.ref}°</td>
                          <td className="px-4 py-3 text-center text-label-md font-bold" style={{ color: warn ? '#ba1a1a' : '#1a73e8' }}>{j.max}°</td>
                          <td className="px-4 py-3 text-center text-label-md font-semibold text-[#005bbf]">{j.min}°</td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-surface-container h-2 rounded-full overflow-hidden min-w-[60px]">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${Math.min(ratio, 100)}%`, background: warn ? '#ba1a1a' : '#1a73e8' }}
                                />
                              </div>
                              <span className="text-label-sm font-bold w-10 text-right flex-shrink-0" style={{ color: warn ? '#ba1a1a' : '#1a73e8' }}>{ratio}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            {warn ? (
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
                    })}
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
            {EXERCISE_NAMES.map((name, ei) => {
              const trend = WEEKLY_DATA.map((w) => w.exercises[ei].compliance);
              const color = EX_COLORS[ei];
              const gain = trend[3] - trend[0];
              return (
                <div key={name} className="border border-outline-variant rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-label-md font-semibold text-on-surface">{name}</span>
                    <span className="text-label-sm font-bold px-2 py-0.5 rounded-full" style={{ color, background: color + '18' }}>+{gain}%</span>
                  </div>
                  <div className="flex items-end gap-3 h-20">
                    {trend.map((val, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-label-sm font-bold" style={{ color }}>{val}%</span>
                        <div className="w-full rounded-t-lg transition-all duration-700"
                          style={{ height: `${Math.round(val * 0.55)}px`, background: color }} />
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
            <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>psychology</span>
              종합 평가
            </h2>
            <p className="text-body-md text-on-surface-variant leading-relaxed">
              환자 김망나뇽님은 재활 4주차에 걸쳐 모든 운동 항목에서 꾸준한 향상을 보이고 있습니다. 특히 오른손 태핑 운동에서 초기 대비 19%의 달성률 향상이 관찰되었으며, ROM 데이터에서도 약지를 제외한 모든 손가락에서 기준값 대비 85% 이상의 가동 범위를 달성하고 있습니다. 전반적인 회복 경과가 매우 긍정적입니다.
            </p>
            <div className="flex gap-2 flex-wrap pt-1">
              <span className="px-3 py-1 bg-[#e8f0fe] text-doctor-primary rounded-full text-label-sm font-semibold">달성률 향상</span>
              <span className="px-3 py-1 bg-[#cce5ff] text-[#006398] rounded-full text-label-sm font-semibold">꾸준한 수행</span>
              <span className="px-3 py-1 bg-error-container text-error rounded-full text-label-sm font-semibold">약지 집중 관리 필요</span>
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
