import { useState, useMemo, useEffect } from 'react';
import PatientNavBar from '../../components/PatientNavBar';
import { useAuth } from '../../context/AuthContext';
import { patientApi } from '../../api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '.');
}

// YYYY-MM-DD 형식
const MOCK_SCHEDULE = [
  { date: '2026-06-01', type: 'exercise', status: 'missed' },
  { date: '2026-06-03', type: 'exercise', status: 'done' },
  { date: '2026-06-05', type: 'exercise', status: 'done' },
  { date: '2026-06-06', type: 'exercise', status: 'missed' },
  { date: '2026-06-08', type: 'exercise', status: 'done' },
  { date: '2026-06-10', type: 'exercise', status: 'done' },
  { date: '2026-06-11', type: 'exercise', status: 'missed' },
  { date: '2026-06-12', type: 'exercise', status: 'done' },
  { date: '2026-06-13', type: 'hospital', status: 'done' },
  { date: '2026-06-14', type: 'exercise', status: 'missed' },
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
const roInputCls =
  'w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant text-body-md outline-none cursor-not-allowed text-sm';
const editCls =
  'w-full h-10 px-3 rounded-lg border border-primary bg-surface-container-lowest text-on-surface text-body-md outline-none focus:ring-2 focus:ring-primary-container transition-all text-sm';

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <p className="text-label-sm font-semibold text-on-surface-variant">{label}</p>
      {children}
    </div>
  );
}

function formatPhone(value) {
  const d = value.replace(/\D/g, '');
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0,2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
    return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6,10)}`;
  }
  const s = d.slice(0, 11);
  if (s.length <= 3) return s;
  if (s.length <= 7) return `${s.slice(0,3)}-${s.slice(3)}`;
  return `${s.slice(0,3)}-${s.slice(3,7)}-${s.slice(7)}`;
}

const PHONE_RE = /^\d{2,3}-\d{3,4}-\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ProfileCard() {
  const { user } = useAuth();
  const [profile, setProfile]               = useState(null);
  const [phone, setPhone]                   = useState('');
  const [guardianEmail, setGuardianEmail]   = useState('');
  const [guardianConsent, setGuardianConsent] = useState(false);
  const [saved, setSaved]                   = useState(false);
  const [errors, setErrors]                 = useState({});

  useEffect(() => {
    patientApi.getMyProfile().then((data) => {
      setProfile(data);
      setPhone(data.phone ?? '');
      setGuardianEmail(data.guardian_email ?? '');
      setGuardianConsent(data.report_consent ?? false);
    }).catch(() => {});
  }, []);

  const isDirty =
    profile &&
    (phone !== (profile.phone ?? '') ||
     guardianEmail !== (profile.guardian_email ?? '') ||
     guardianConsent !== (profile.report_consent ?? false));

  const validate = () => {
    const next = {};
    if (!PHONE_RE.test(phone)) next.phone = '전화번호를 끝까지 입력하세요';
    if (guardianEmail && !EMAIL_RE.test(guardianEmail)) next.email = '올바른 이메일 형식을 입력해 주세요';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    if (!validate()) return;
    patientApi.updateMyProfile({ phone, guardian_email: guardianEmail || null, report_consent: guardianConsent })
      .then((data) => {
        setProfile(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch(() => {});
  };

  const handlePhoneChange = (e) => {
    setPhone(formatPhone(e.target.value));
    if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }));
  };

  const handleEmailChange = (e) => {
    const val = e.target.value.replace(/[^a-zA-Z0-9@._\-+]/g, '');
    setGuardianEmail(val);
    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
  };

  const editErrCls =
    'w-full h-10 px-3 rounded-lg border border-error bg-surface-container-lowest text-on-surface text-body-md outline-none focus:ring-2 focus:ring-error-container transition-all text-sm';

  return (
    <section className="flex flex-col gap-6 h-full">
      <h1 className="text-headline-lg font-display font-bold text-on-surface">개인 정보</h1>

      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant p-6 flex flex-col flex-1 gap-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="아이디">
            <input readOnly value={profile?.login_id ?? ''} className={roInputCls} />
          </Field>
          <Field label="이름">
            <input readOnly value={profile?.name ?? user?.name ?? ''} className={roInputCls} />
          </Field>
          <Field label="성별">
            <input readOnly value={profile?.gender ?? ''} className={roInputCls} />
          </Field>
          <Field label="생년월일">
            <input readOnly value={formatDate(profile?.birth_date)} className={roInputCls} />
          </Field>

          {/* 수정 가능 필드 */}
          <div>
            <Field label={<span>연락처 <span className="text-primary text-[10px] font-normal">수정 가능</span></span>}>
              <input
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                className={errors.phone ? editErrCls : editCls}
                placeholder="010-0000-0000"
                maxLength={13}
              />
            </Field>
            <p className="text-[11px] text-error h-4 mt-0.5">{errors.phone ?? ''}</p>
          </div>
          <Field label="수술 부위">
            <input readOnly value={profile?.surgery_area ?? ''} className={roInputCls} />
          </Field>
          <Field label="수술명">
            <input readOnly value={profile?.surgery_name ?? ''} className={roInputCls} />
          </Field>
          <Field label="수술 시기">
            <input readOnly value={formatDate(profile?.surgery_date)} className={roInputCls} />
          </Field>
          <Field label="재활 시작">
            <input readOnly value={formatDate(profile?.rehab_start_date)} className={roInputCls} />
          </Field>
        </div>

        <div>
          <Field label={<span>보호자 이메일 <span className="text-primary text-[10px] font-normal">수정 가능</span></span>}>
            <input
              type="email"
              value={guardianEmail}
              onChange={handleEmailChange}
              className={errors.email ? editErrCls : editCls}
              placeholder="guardian@email.com"
            />
          </Field>
          <p className="text-[11px] text-error h-4 mt-0.5">{errors.email ?? ''}</p>
        </div>

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
        <div className="flex justify-end pt-1 mt-auto">
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
    <div key={str} className="h-12 flex items-center justify-center text-label-md text-outline/40">{d}</div>
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

            const hasDoneEx       = events.some((e) => e.type === 'exercise' && e.status === 'done');
            const hasUpcomingEx   = events.some((e) => e.type === 'exercise' && e.status === 'upcoming');
            const hasMissedEx     = events.some((e) => e.type === 'exercise' && e.status === 'missed');
            const hasUpcomingHosp = events.some((e) => e.type === 'hospital' && e.status === 'upcoming');

            // 운동 상태에 따른 원 스타일 (우선순위: 예정 > 미수행 > 완료)
            let circleCls = 'text-on-surface';
            if      (hasUpcomingEx) circleCls = 'border-2 border-primary text-primary';
            else if (hasMissedEx)   circleCls = 'border-2 border-red-500 text-red-500';
            else if (hasDoneEx)     circleCls = 'bg-inverse-surface text-inverse-on-surface';

            return (
              <div key={day} className="h-12 flex flex-col items-center justify-center gap-0.5">
                <div className={`w-9 h-9 flex items-center justify-center rounded-full text-label-md transition-all ${circleCls}`}>
                  {day}
                </div>
                {hasUpcomingHosp && (
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                )}
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
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-6 pt-5 border-t border-outline-variant text-label-sm">
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full bg-inverse-surface" />
            <span className="text-on-surface-variant">운동 완료</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full border-2 border-primary" />
            <span className="text-on-surface-variant">운동 예정</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-4 h-4 rounded-full border-2 border-red-500" />
            <span className="text-on-surface-variant">운동 미수행</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-orange-500 mx-1" />
            <span className="text-on-surface-variant">진료 예정</span>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 병원정보 카드 (읽기 전용) ─────────────────────────────────────────────
function HospitalCard() {
  const [hospitalName, setHospitalName] = useState('');
  const roInputCls =
    'w-full h-10 px-3 rounded-lg border border-outline-variant bg-surface-container text-on-surface-variant text-body-md outline-none cursor-not-allowed text-sm';

  useEffect(() => {
    patientApi.getMyProfile().then((data) => {
      setHospitalName(data.hospital_name ?? '');
    }).catch(() => {});
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-headline-lg font-display font-bold text-on-surface">병원 정보</h2>

      <div className="bg-surface-container-lowest rounded-xl shadow-card border border-outline-variant p-6">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: '병원명', value: hospitalName },
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
          <div className="lg:col-span-5 flex flex-col">
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
