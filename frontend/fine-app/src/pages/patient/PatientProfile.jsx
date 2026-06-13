import { useState, useMemo } from 'react';
import PatientNavBar from '../../components/PatientNavBar';

// ── Mock 데이터 (API 연동 시 교체) ──────────────────────────────────────
const MOCK_PROFILE = {
  id: 'patient01',
  name: '김망나뇽',
  gender: '남',
  phone: '010-1234-5678',
  birthdate: '1985.05.20',
  guardianEmail: 'guardian@email.com',
  guardianConsent: true,
  surgery: '수근관 증후군 유리술',
  surgeryPart: '오른쪽 손목',
  surgeryDate: '2021.12.15',
  rehabStart: '2021.12.28',
};

const MOCK_HOSPITAL = {
  name: '한국재활병원',
  doctor: '김나연 원장',
  department: '재활의학과',
  diagnosis: '우측 손 건초염',
};

// YYYY-MM-DD 형식
const MOCK_SCHEDULE = [
  { date: '2026-06-03', type: 'exercise', status: 'done' },
  { date: '2026-06-05', type: 'exercise', status: 'done' },
  { date: '2026-06-08', type: 'exercise', status: 'done' },
  { date: '2026-06-10', type: 'exercise', status: 'done' },
  { date: '2026-06-12', type: 'exercise', status: 'done' },
  { date: '2026-06-13', type: 'hospital', status: 'done' },
  { date: '2026-06-14', type: 'exercise', status: 'upcoming' },
  { date: '2026-06-16', type: 'exercise', status: 'upcoming' },
  { date: '2026-06-18', type: 'exercise', status: 'upcoming' },
  { date: '2026-06-20', type: 'exercise', status: 'upcoming' },
  { date: '2026-06-20', type: 'hospital', status: 'upcoming' },
  { date: '2026-06-21', type: 'exercise', status: 'upcoming' },
  { date: '2026-06-23', type: 'exercise', status: 'upcoming' },
  { date: '2026-06-25', type: 'exercise', status: 'upcoming' },
  { date: '2026-06-26', type: 'exercise', status: 'upcoming' },
  { date: '2026-06-28', type: 'exercise', status: 'upcoming' },
  { date: '2026-07-04', type: 'hospital', status: 'upcoming' },
];

const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'];
const DAY_NAMES  = ['월','화','수','목','금','토','일'];

// ── 개인정보 카드 ─────────────────────────────────────────────────────────
function ProfileCard() {
  const [phone, setPhone]                   = useState(MOCK_PROFILE.phone);
  const [guardianEmail, setGuardianEmail]   = useState(MOCK_PROFILE.guardianEmail);
  const [guardianConsent, setGuardianConsent] = useState(MOCK_PROFILE.guardianConsent);
  const [saved, setSaved]                   = useState(false);

  const isDirty =
    phone !== MOCK_PROFILE.phone ||
    guardianEmail !== MOCK_PROFILE.guardianEmail ||
    guardianConsent !== MOCK_PROFILE.guardianConsent;

  const handleSave = () => {
    // TODO: API PATCH 호출
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const roInputCls =
    'w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant text-body-md outline-none cursor-not-allowed text-sm';
  const editCls =
    'w-full h-10 px-3 rounded-lg border border-primary bg-surface-container-lowest text-on-surface text-body-md outline-none focus:ring-2 focus:ring-primary-container transition-all text-sm';

  const Field = ({ label, children }) => (
    <div className="space-y-1">
      <p className="text-label-sm font-semibold text-on-surface-variant">{label}</p>
      {children}
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-headline-lg font-display font-bold text-on-surface">개인 정보</h1>

      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="아이디">
            <input readOnly value={MOCK_PROFILE.id} className={roInputCls} />
          </Field>
          <Field label="이름">
            <input readOnly value={MOCK_PROFILE.name} className={roInputCls} />
          </Field>
          <Field label="성별">
            <input readOnly value={MOCK_PROFILE.gender} className={roInputCls} />
          </Field>
          <Field label="생년월일">
            <input readOnly value={MOCK_PROFILE.birthdate} className={roInputCls} />
          </Field>

          {/* 수정 가능 필드 */}
          <Field label={<span>연락처 <span className="text-primary text-[10px] font-normal">수정 가능</span></span>}>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={editCls}
              placeholder="010-0000-0000"
            />
          </Field>
          <Field label="수술 부위">
            <input readOnly value={MOCK_PROFILE.surgeryPart} className={roInputCls} />
          </Field>
          <Field label="수술명">
            <input readOnly value={MOCK_PROFILE.surgery} className={roInputCls} />
          </Field>
          <Field label="수술 시기">
            <input readOnly value={MOCK_PROFILE.surgeryDate} className={roInputCls} />
          </Field>
          <Field label="재활 시작">
            <input readOnly value={MOCK_PROFILE.rehabStart} className={roInputCls} />
          </Field>
        </div>

        <Field label={<span>보호자 이메일 <span className="text-primary text-[10px] font-normal">수정 가능</span></span>}>
          <input
            type="email"
            value={guardianEmail}
            onChange={(e) => setGuardianEmail(e.target.value)}
            className={editCls}
            placeholder="guardian@email.com"
          />
        </Field>

        {/* 보호자 동의 */}
        <label className="flex items-center gap-3 pt-1 cursor-pointer select-none">
          <div className="relative flex items-center shrink-0">
            <input
              type="checkbox"
              checked={guardianConsent}
              onChange={(e) => setGuardianConsent(e.target.checked)}
              className="h-6 w-6 rounded-lg border-2 border-outline appearance-none cursor-pointer checked:bg-primary checked:border-primary focus:outline-none transition-all"
            />
            {guardianConsent && (
              <span className="material-symbols-outlined absolute text-white pointer-events-none scale-75 left-0" style={{ fontVariationSettings: "'wght' 700" }}>
                check
              </span>
            )}
          </div>
          <span className="text-body-md text-on-surface">보호자 재활 보고서 수신 동의</span>
        </label>

        {/* 저장 버튼 */}
        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={!isDirty}
            className={`h-10 px-6 rounded-xl text-label-md font-semibold transition-all duration-200
              ${isDirty
                ? 'bg-primary-container text-white hover:brightness-110 active:scale-95 shadow-sm'
                : 'bg-surface-container text-on-surface-variant cursor-not-allowed'
              }`}
          >
            {saved
              ? <span className="flex items-center gap-1"><span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>저장 완료</span>
              : '저장'
            }
          </button>
        </div>
      </div>
    </section>
  );
}

// ── 캘린더 카드 ───────────────────────────────────────────────────────────
function ScheduleCalendar() {
  const [calYear,  setCalYear]  = useState(2026);
  const [calMonth, setCalMonth] = useState(6); // 1-indexed

  const scheduleMap = useMemo(() => {
    const map = {};
    MOCK_SCHEDULE.forEach((s) => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, []);

  const prevMonth = () => {
    if (calMonth === 1) { setCalYear((y) => y - 1); setCalMonth(12); }
    else setCalMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 12) { setCalYear((y) => y + 1); setCalMonth(1); }
    else setCalMonth((m) => m + 1);
  };

  // 월 첫째날의 요일 (월요일 기준 0)
  const firstWeekday = (new Date(calYear, calMonth - 1, 1).getDay() + 6) % 7;
  const daysInMonth  = new Date(calYear, calMonth, 0).getDate();
  const prevMonthDays = new Date(calYear, calMonth - 1, 0).getDate();

  const pad = (d, str) => (
    <div key={str} className="h-11 flex items-center justify-center text-label-md text-outline/40">{d}</div>
  );

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-headline-lg font-display font-bold text-on-surface">운동 · 진료 일정</h2>

      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant p-6">
        {/* 월 네비게이션 */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={prevMonth} className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-high p-2 rounded-full transition-colors">
            chevron_left
          </button>
          <h3 className="text-title-md font-display font-bold text-on-surface">
            {calYear}년 {MONTH_NAMES[calMonth - 1]}
          </h3>
          <button onClick={nextMonth} className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-high p-2 rounded-full transition-colors">
            chevron_right
          </button>
        </div>

        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 text-center mb-2">
          {DAY_NAMES.map((d) => (
            <div key={d} className="text-label-sm font-semibold text-outline">{d}</div>
          ))}
        </div>

        {/* 날짜 그리드 */}
        <div className="grid grid-cols-7 gap-y-1">
          {/* 이전달 패딩 */}
          {Array.from({ length: firstWeekday }, (_, i) =>
            pad(prevMonthDays - firstWeekday + 1 + i, `pad-${i}`)
          )}

          {/* 이번달 날짜 */}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const dateKey = `${calYear}-${String(calMonth).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const events  = scheduleMap[dateKey] || [];

            const hasDoneEx      = events.some((e) => e.type === 'exercise' && e.status === 'done');
            const hasUpcomingEx  = events.some((e) => e.type === 'exercise' && e.status === 'upcoming');
            const hasDoneHosp    = events.some((e) => e.type === 'hospital'  && e.status === 'done');
            const hasUpcomingHosp = events.some((e) => e.type === 'hospital' && e.status === 'upcoming');

            let circleCls = '';
            if      (hasUpcomingHosp) circleCls = 'bg-orange-500 text-white';
            else if (hasUpcomingEx)   circleCls = 'bg-primary text-white';
            else if (hasDoneEx || hasDoneHosp) circleCls = 'bg-inverse-surface text-inverse-on-surface';

            const hasCircle = !!circleCls;
            // 진료 + 운동이 같은날이면 운동 원 아래 주황 점 표시
            const showHospDot = hasUpcomingHosp && hasUpcomingEx;
            const showDot = showHospDot;

            return (
              <div key={day} className="h-11 flex flex-col items-center justify-center gap-0.5">
                <div className={`w-9 h-9 flex items-center justify-center rounded-full text-label-md transition-all
                  ${hasCircle ? circleCls : 'text-on-surface hover:bg-surface-container cursor-default'}`}
                >
                  {day}
                </div>
                {showDot && <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
              </div>
            );
          })}

          {/* 다음달 패딩 */}
          {(() => {
            const totalCells = firstWeekday + daysInMonth;
            const remainder  = totalCells % 7;
            if (remainder === 0) return null;
            return Array.from({ length: 7 - remainder }, (_, i) => pad(i + 1, `next-${i}`));
          })()}
        </div>

        {/* 범례 */}
        <div className="flex flex-wrap gap-4 mt-6 pt-5 border-t border-outline-variant text-label-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-inverse-surface" />
            <span className="text-on-surface-variant">운동 수행 완료</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-on-surface-variant">운동 예정일</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500" />
            <span className="text-on-surface-variant">병원 진료 예정일</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 병원정보 카드 (읽기 전용) ─────────────────────────────────────────────
function HospitalCard() {
  const roInputCls =
    'w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant text-body-md outline-none cursor-not-allowed text-sm';

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-headline-lg font-display font-bold text-on-surface">병원 정보</h2>

      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant p-6">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: '병원명',    value: MOCK_HOSPITAL.name   },
            { label: '담당 의사', value: MOCK_HOSPITAL.doctor },
          ].map(({ label, value }) => (
            <div key={label} className="space-y-1">
              <p className="text-label-sm font-semibold text-on-surface-variant">{label}</p>
              <input readOnly value={value} className={roInputCls} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────
export default function PatientProfile() {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <PatientNavBar />

      <main className="max-w-7xl mx-auto px-container-padding-mobile md:px-container-padding-desktop py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* 왼쪽: 개인정보 */}
          <div className="lg:col-span-5">
            <ProfileCard />
          </div>

          {/* 오른쪽: 캘린더 + 병원정보 */}
          <div className="lg:col-span-7 flex flex-col gap-10">
            <ScheduleCalendar />
            <HospitalCard />
          </div>
        </div>
      </main>
    </div>
  );
}
