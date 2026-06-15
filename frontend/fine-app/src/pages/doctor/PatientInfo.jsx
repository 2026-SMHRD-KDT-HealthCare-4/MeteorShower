import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';

/* ── 날짜 유틸 ── */
const DAY_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function toKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/* ── 처방 일정 컴포넌트 ── */
function PrescriptionSchedule({ prescription, schedule, setSchedule }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  const enabled = prescription.filter((ex) => ex.enabled);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const toggle = (name, dateStr) =>
    setSchedule((prev) => ({ ...prev, [`${name}|${dateStr}`]: !prev[`${name}|${dateStr}`] }));

  const isOn = (name, dateStr) => !!schedule[`${name}|${dateStr}`];

  const assignWeekdays = () => {
    const next = { ...schedule };
    enabled.forEach(({ name }) =>
      weekDates.slice(0, 5).forEach((d) => { next[`${name}|${toKey(d)}`] = true; })
    );
    setSchedule(next);
  };

  const assignAll = () => {
    const next = { ...schedule };
    enabled.forEach(({ name }) =>
      weekDates.forEach((d) => { next[`${name}|${toKey(d)}`] = true; })
    );
    setSchedule(next);
  };

  const clearWeek = () => {
    const next = { ...schedule };
    enabled.forEach(({ name }) =>
      weekDates.forEach((d) => { delete next[`${name}|${toKey(d)}`]; })
    );
    setSchedule(next);
  };

  const startMonth = weekDates[0].getMonth() + 1;
  const endMonth   = weekDates[6].getMonth() + 1;
  const yearLabel  = weekDates[0].getFullYear();
  const monthLabel = startMonth === endMonth
    ? `${yearLabel}년 ${startMonth}월`
    : `${yearLabel}년 ${startMonth}월 - ${endMonth}월`;

  const today = toKey(new Date());

  return (
    <div className="space-y-4">

      {/* 주 네비게이션 */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekStart((d) => addDays(d, -7))}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-base">chevron_left</span>
          이전 주
        </button>
        <span className="text-label-md font-semibold text-on-surface">{monthLabel}</span>
        <button
          onClick={() => setWeekStart((d) => addDays(d, 7))}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-label-md text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          다음 주
          <span className="material-symbols-outlined text-base">chevron_right</span>
        </button>
      </div>

      {/* 그리드 */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr>
              <th className="w-36 text-left px-3 py-2 text-label-sm font-semibold text-on-surface-variant border-b border-outline-variant">운동</th>
              {weekDates.map((d, i) => {
                const isToday = toKey(d) === today;
                return (
                  <th key={i} className="text-center px-2 py-2 border-b border-outline-variant">
                    <div className={`text-label-sm font-semibold ${i >= 5 ? 'text-error' : 'text-on-surface-variant'}`}>{DAY_LABELS[i]}</div>
                    <div className={`text-label-md font-bold mt-0.5 w-7 h-7 mx-auto flex items-center justify-center rounded-full
                      ${isToday ? 'bg-doctor-primary text-white' : 'text-on-surface'}`}>
                      {d.getDate()}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {enabled.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-6 text-on-surface-variant text-label-md">
                  처방에 포함된 운동이 없습니다
                </td>
              </tr>
            ) : enabled.map((ex, i) => (
              <tr key={i} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-lowest transition-colors">
                <td className="px-3 py-3 text-label-md font-medium text-on-surface truncate max-w-[140px]">{ex.name}</td>
                {weekDates.map((d, j) => {
                  const dateStr = toKey(d);
                  const on = isOn(ex.name, dateStr);
                  return (
                    <td key={j} className="text-center px-2 py-3">
                      <button
                        onClick={() => toggle(ex.name, dateStr)}
                        className={`w-8 h-8 rounded-full text-label-sm font-bold transition-all active:scale-90
                          ${on
                            ? 'bg-doctor-primary text-white shadow-sm'
                            : 'bg-surface-container text-on-surface-variant hover:bg-[#e8f0fe] hover:text-doctor-primary'
                          }`}
                      >
                        {on
                          ? <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
                          : <span className="text-xs">+</span>
                        }
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 빠른 설정 */}
      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-outline-variant">
        <span className="text-label-sm text-on-surface-variant mr-1">빠른 설정:</span>
        <button
          onClick={assignWeekdays}
          className="px-3 py-1.5 rounded-lg text-label-sm font-semibold border border-doctor-primary text-doctor-primary hover:bg-[#e8f0fe] transition-colors"
        >
          평일만
        </button>
        <button
          onClick={assignAll}
          className="px-3 py-1.5 rounded-lg text-label-sm font-semibold border border-doctor-primary text-doctor-primary hover:bg-[#e8f0fe] transition-colors"
        >
          전체 선택
        </button>
        <button
          onClick={clearWeek}
          className="px-3 py-1.5 rounded-lg text-label-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors"
        >
          이번 주 초기화
        </button>
      </div>
    </div>
  );
}

const patientInfo = [
  { label: '성명 (Name)',        value: '김망나뇽' },
  { label: '환자번호 (Code)',    value: 'F310957194583' },
  { label: '성별 (Gender)',      value: '남자' },
  { label: '생년월일 (Birth)',   value: '1960.01.02' },
  { label: '연락처 (Phone)',     value: '010-0000-0000' },
  { label: '수술명 (Surgery)',   value: '손가락 골절 수술' },
  { label: '수술일 (Date)',      value: '2026.01.01' },
  { label: '진행 단계 (Stage)', value: '손가락 굽히기 운동' },
  { label: '재활 시작일',        value: '2026.01.25' },
  { label: '담당 의사',          value: '김나연 원장' },
];

const defaultPrescription = [
  { name: '태핑 (Tapping)',   sets: 3, reps: 10, enabled: false },
  { name: '굴곡 (Flexion)',   sets: 3, reps: 10, enabled: false },
  { name: '신전 (Extension)', sets: 2, reps: 8,  enabled: false },
  { name: '그립 (Grip)',      sets: 2, reps: 10, enabled: false },
];

export default function PatientInfo() {
  const navigate = useNavigate();
  const [prescription, setPrescription] = useState(defaultPrescription);
  const [aiAdjust, setAiAdjust] = useState(true);
  const [schedule, setSchedule] = useState({});
  const [justSaved, setJustSaved] = useState(false);

  const updatePrescription = (idx, field, val) =>
    setPrescription((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));

  const toggleEnabled = (idx) =>
    setPrescription((prev) => prev.map((row, i) => (i === idx ? { ...row, enabled: !row.enabled } : row)));

  const hasChecked = prescription.some((ex) => ex.enabled);
  const hasSchedule = Object.values(schedule).some(Boolean);
  const canSave = hasChecked && hasSchedule;

  const handleSave = () => {
    if (!canSave) return;
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  };

  /* 환자 정보 셀 border */
  const cellBorder = (i) => {
    const total = patientInfo.length;
    const isLastRow = i >= total - (total % 2 === 0 ? 2 : 1);
    const isLastItem = i === total - 1;
    const isEven = i % 2 === 0;
    return [
      isLastItem ? '' : 'border-b',
      isLastRow ? 'sm:border-b-0' : '',
      isEven ? 'sm:border-r' : '',
      'border-outline-variant',
    ].join(' ');
  };

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavBar />

      <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-doctor-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-label-md font-medium">Back to Dashboard</span>
          </button>
        </div>

        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-doctor-primary tracking-tight">
            환자 정보
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            김망나뇽 환자 · F310957194583
          </p>
        </div>

        {/* 환자 정보 */}
        <section className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-card">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-outline-variant bg-surface-container-low">
            <span className="material-symbols-outlined text-doctor-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
            <h2 className="text-title-md font-bold text-doctor-primary">기본 정보</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {patientInfo.map((item, i) => (
              <div key={i} className={`flex ${cellBorder(i)}`}>
                <div className="w-36 sm:w-44 flex-shrink-0 bg-surface-container-low px-4 py-3 text-label-sm font-semibold text-on-surface-variant border-r border-outline-variant">
                  {item.label}
                </div>
                <div className="flex-1 min-w-0 px-4 py-3 text-body-md text-on-surface">
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 운동 처방 */}
        <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
              운동 처방
            </h2>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#1a73e8]">auto_awesome</span>
              <span className="text-label-md text-on-surface font-medium">AI 난이도 조절</span>
              <button
                onClick={() => setAiAdjust((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${aiAdjust ? 'bg-doctor-primary' : 'bg-outline-variant'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${aiAdjust ? 'translate-x-[22px]' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border border-outline-variant rounded-xl overflow-hidden min-w-[520px]">
              <thead>
                <tr className="bg-[#f0f6ff] border-b border-outline-variant">
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary w-10 text-center">포함</th>
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary">운동 종류</th>
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">세트 수</th>
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">세트당 횟수</th>
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">예상 시간</th>
                </tr>
              </thead>
              <tbody>
                {prescription.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-outline-variant last:border-0 transition-colors ${
                      row.enabled ? 'hover:bg-surface-container-lowest' : 'bg-surface-container opacity-50'
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleEnabled(i)}
                        className="flex items-center justify-center mx-auto w-5 h-5"
                      >
                        <span className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                          row.enabled ? 'bg-doctor-primary border-doctor-primary' : 'bg-white border-outline-variant'
                        }`}>
                          {row.enabled && (
                            <span className="material-symbols-outlined text-white" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
                              check
                            </span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-3 text-body-md font-semibold text-on-surface">{row.name}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number" min={1} max={10}
                        value={row.sets}
                        disabled={!row.enabled}
                        onChange={(e) => updatePrescription(i, 'sets', Number(e.target.value))}
                        className="w-16 text-center border border-outline-variant rounded-lg py-1.5 text-label-md font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number" min={1} max={30}
                        value={row.reps}
                        disabled={!row.enabled}
                        onChange={(e) => updatePrescription(i, 'reps', Number(e.target.value))}
                        className="w-16 text-center border border-outline-variant rounded-lg py-1.5 text-label-md font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>
                    <td className="px-4 py-3 text-center text-label-md text-on-surface-variant">
                      {row.enabled ? `약 ${row.sets * row.reps * 3}초` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-1">
            <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">info</span>
              운동을 선택하고 아래 달력에서 날짜를 지정해야 저장할 수 있습니다.
            </p>
          </div>

          {/* 처방 일정 설정 */}
          <div className="border-t border-outline-variant pt-4 space-y-1">
            <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
              처방 일정 설정
            </h3>
          </div>
          <PrescriptionSchedule prescription={prescription} schedule={schedule} setSchedule={setSchedule} />
        </section>

        {/* 저장 */}
        <div className="flex justify-end gap-3 pb-4">
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`flex items-center gap-2 px-6 sm:px-8 py-3 font-semibold rounded-xl transition-opacity shadow-md text-label-md
              ${canSave ? 'bg-doctor-primary text-white hover:opacity-90' : 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'}`}
          >
            {justSaved ? (
              <>
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                저장 완료
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">save</span>
                저장 (Save)
              </>
            )}
          </button>
        </div>

      </main>
    </div>
  );
}
