import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';
import { patientApi } from '../../api';


const inputCls = 'w-full px-3 py-2.5 border border-outline-variant rounded-xl text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary transition-all placeholder:text-outline bg-white';
const roCls    = 'w-full px-3 py-2.5 border border-outline-variant rounded-xl text-body-md text-on-surface bg-surface-container-low cursor-default select-none';

const ROM_FINGERS = [
  { key: 'thumb',  label: '엄지 (Thumb)'  },
  { key: 'index',  label: '검지 (Index)'  },
  { key: 'middle', label: '중지 (Middle)' },
  { key: 'ring',   label: '약지 (Ring)'   },
  { key: 'pinky',  label: '소지 (Pinky)'  },
];
const ROM_ROWS = [
  { label: 'MCP (왼손)',   joint: 'MCP', hand: '왼손'  },
  { label: 'MCP (오른손)', joint: 'MCP', hand: '오른손' },
  { label: 'PIP (왼손)',   joint: 'PIP', hand: '왼손'  },
  { label: 'PIP (오른손)', joint: 'PIP', hand: '오른손' },
  { label: 'DIP (왼손)',   joint: 'DIP', hand: '왼손'  },
  { label: 'DIP (오른손)', joint: 'DIP', hand: '오른손' },
];
const ROM_EXERCISE_TABS = [
  { key: 'basic',   label: 'Grip'    },
  { key: 'tapping', label: 'Tapping' },
];

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <label className="text-label-sm font-semibold text-on-surface-variant">{label}</label>
      {children}
      <div className="h-4" />
    </div>
  );
}

export default function PatientRegister() {
  const navigate = useNavigate();

  /* 검색 단계 */
  const [query, setQuery]         = useState('');
  const [searched, setSearched]   = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [patient, setPatient]     = useState(null);

  /* 의사 입력 */
  const [area, setArea]           = useState('');
  const [surgery, setSurgery]     = useState('');
  const [surgeryDate, setSurgeryDate] = useState('');
  const [rehabStart, setRehabStart]   = useState('');
  const [stage, setStage]         = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [done, setDone]           = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [rom, setRom]                   = useState({});
  const [activeRomTab, setActiveRomTab] = useState('basic');
  const [tappingRom, setTappingRom]     = useState({});

  const romByTab    = { basic: rom,    tapping: tappingRom    };
  const setRomByTab = { basic: setRom, tapping: setTappingRom };
  const currentRom    = romByTab[activeRomTab]    ?? {};
  const setCurrentRom = setRomByTab[activeRomTab];

  /* 검색 결과 목록 */
  const [results, setResults] = useState([]);

  /* 검색 실행 */
  const handleSearch = () => {
    if (!query.trim()) return;
    setSearched(true);
    setSearching(true);
    setSearchError('');
    setPatient(null);
    setArea(''); setSurgery(''); setSurgeryDate(''); setRehabStart(''); setStage(''); setAppointmentDate(''); setRom({}); setTappingRom({}); setActiveRomTab('basic');
    patientApi.searchPatients(query.trim())
      .then((data) => { setResults(data); })
      .catch((err) => { setResults([]); setSearchError(err.message); })
      .finally(() => setSearching(false));
  };

  /* 목록에서 환자 선택 */
  const handleSelect = (p) => {
    setPatient(p);
    setArea(''); setSurgery(''); setSurgeryDate(''); setRehabStart(''); setStage(''); setAppointmentDate(''); setRom({}); setTappingRom({}); setActiveRomTab('basic');
  };

  /* 제출 */
  const handleSubmit = () => {
    if (!patient) return;
    setSubmitting(true);
    setSubmitError('');
    const romBody = {};
    Object.entries(rom).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) romBody[k] = parseFloat(v);
    });
    patientApi.assignPatient(patient.patient_id, {
      surgery_area: area || undefined,
      surgery_name: surgery || undefined,
      surgery_date: surgeryDate || undefined,
      rehab_start_date: rehabStart || undefined,
      current_rehab_phase: stage || undefined,
      appointment_date: appointmentDate || undefined,
    })
      .then(async () => {
        if (Object.keys(romBody).length > 0) {
          await patientApi.updatePatientRom(patient.patient_id, { exercise_type: 'grip', rom: romBody });
        }
        const tappingBody = {};
        Object.entries(tappingRom).forEach(([k, v]) => {
          if (v !== '' && v !== null && v !== undefined) tappingBody[k] = parseFloat(v);
        });
        if (Object.keys(tappingBody).length > 0) {
          await patientApi.updatePatientRom(patient.patient_id, { exercise_type: 'tapping', rom: tappingBody });
        }
      })
      .then(() => setDone(true))
      .catch((err) => setSubmitError(err.message))
      .finally(() => setSubmitting(false));
  };

  /* ── 완료 화면 ── */
  if (done && patient) {
    return (
      <div className="min-h-screen bg-background">
        <DoctorNavBar />
        <main className="max-w-[560px] mx-auto px-4 py-20 flex flex-col items-center gap-6 text-center">
          <div className="w-20 h-20 bg-[#e8f0fe] rounded-full flex items-center justify-center">
            <span className="material-symbols-outlined text-doctor-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          </div>
          <div>
            <h2 className="text-headline-sm font-bold text-on-surface">환자 등록 완료</h2>
            <p className="text-body-md text-on-surface-variant mt-2">
              <span className="font-semibold text-doctor-primary">{patient.name}</span> 환자가 담당 환자로 등록되었습니다.
            </p>
          </div>
          <div className="w-full bg-white border border-outline-variant rounded-2xl p-5 text-left space-y-2 shadow-card">
            {[
              { label: '환자명', value: patient.name },
              { label: '코드',   value: patient.patient_code },
              { label: '수술 부위', value: area },
              { label: '수술명', value: surgery },
              { label: '수술 시기', value: surgeryDate },
              { label: '재활 시작', value: rehabStart },
              { label: '진행 단계', value: stage },
            ].map((r) => (
              <div key={r.label} className="flex justify-between text-label-md border-b border-outline-variant pb-1.5 last:border-0">
                <span className="text-on-surface-variant">{r.label}</span>
                <span className="font-semibold text-on-surface">{r.value}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setDone(false); setPatient(null); setQuery(''); setSearched(false); }}
              className="px-6 py-3 border-2 border-doctor-primary text-doctor-primary font-semibold rounded-xl hover:bg-[#e8f0fe] transition-colors text-label-md"
            >
              추가 등록
            </button>
            <button
              onClick={() => navigate('/doctor/patients')}
              className="px-6 py-3 bg-doctor-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md text-label-md"
            >
              환자 목록으로
            </button>
          </div>
        </main>
      </div>
    );
  }

  /* ── 메인 폼 ── */
  return (
    <div className="min-h-screen bg-background">
      <DoctorNavBar />

      <main className="max-w-[860px] mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* 헤더 */}
        <div className="flex items-center">
          <button
            onClick={() => navigate('/doctor/patients')}
            className="flex items-center gap-2 text-on-surface-variant hover:text-doctor-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-label-md font-medium">Back to Dashboard</span>
          </button>
        </div>

        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-doctor-primary tracking-tight">
            환자 등록
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            회원가입된 환자를 검색한 후 수술 및 재활 정보를 입력해주세요.
          </p>
        </div>

        {/* ── STEP 1: 환자 검색 ── */}
        <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-outline-variant">
            <span className="w-6 h-6 bg-doctor-primary text-white text-label-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">1</span>
            <h2 className="text-title-md font-bold text-doctor-primary">환자 검색</h2>
          </div>

          <p className="text-label-sm text-on-surface-variant">아이디, 환자 코드, 이름으로 검색할 수 있습니다.</p>

          <div className="flex gap-3">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-base">search</span>
              <input
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSearched(false); setPatient(null); setSearchError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="아이디 / 환자 코드 / 이름 입력"
                className="w-full pl-10 pr-4 py-2.5 border border-outline-variant rounded-xl text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary transition-all bg-white placeholder:text-outline"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={!query.trim()}
              className="px-5 py-2.5 bg-doctor-primary text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-opacity text-label-md flex-shrink-0"
            >
              검색
            </button>
          </div>

          {/* 검색 결과 목록 */}
          {searching && (
            <div className="flex items-center gap-2 px-4 py-3 text-on-surface-variant text-label-md">
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              검색 중...
            </div>
          )}

          {searched && !searching && searchError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-error-container text-on-error-container rounded-xl text-label-md">
              <span className="material-symbols-outlined text-base">error</span>
              {searchError}
            </div>
          )}

          {searched && !searching && !searchError && results.length === 0 && (
            <div className="flex items-center gap-2 px-4 py-3 bg-error-container text-on-error-container rounded-xl text-label-md">
              <span className="material-symbols-outlined text-base">search_off</span>
              일치하는 환자를 찾을 수 없습니다. 아이디, 코드, 이름을 다시 확인해주세요.
            </div>
          )}

          {searched && !searching && results.length > 0 && !patient && (
            <div className="space-y-2">
              <p className="text-label-sm text-on-surface-variant">
                검색 결과 <span className="font-bold text-doctor-primary">{results.length}명</span> · 환자를 선택해주세요
              </p>
              <div className="divide-y divide-outline-variant border border-outline-variant rounded-xl overflow-hidden">
                {results.map((p) => (
                  <button
                    key={p.patient_code}
                    onClick={() => handleSelect(p)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#f0f6ff] transition-colors text-left group"
                  >
                    <div className="w-10 h-10 bg-surface-container rounded-full flex items-center justify-center flex-shrink-0 group-hover:bg-[#e8f0fe] transition-colors">
                      <span className="material-symbols-outlined text-on-surface-variant group-hover:text-doctor-primary transition-colors" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-body-md font-bold text-on-surface">{p.name}</span>
                        <span className="text-label-sm text-on-surface-variant">{p.gender} · {String(p.birth_date).replace(/-/g, '.')}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">id_card</span>{p.patient_code}
                        </span>
                        <span className="text-label-sm text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">call</span>{p.phone}
                        </span>
                      </div>
                    </div>
                    <span className="material-symbols-outlined text-outline group-hover:text-doctor-primary transition-colors">chevron_right</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 선택된 환자 표시 */}
          {patient && (
            <div className="flex items-center justify-between px-4 py-3 bg-[#e8f0fe] border border-doctor-primary rounded-xl">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-doctor-primary" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <span className="text-label-md font-semibold text-doctor-primary">
                  {patient.name} ({patient.patient_code}) 선택됨
                </span>
              </div>
              <button
                onClick={() => { setPatient(null); }}
                className="text-label-sm text-on-surface-variant hover:text-error transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">close</span>
                다시 선택
              </button>
            </div>
          )}
        </section>

        {/* ── STEP 2: 회원가입 정보 (읽기 전용) ── */}
        {patient && (
          <>
            <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-doctor-primary text-white text-label-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">2</span>
                  <h2 className="text-title-md font-bold text-doctor-primary">회원가입 정보 확인</h2>
                </div>
                <span className="flex items-center gap-1.5 text-label-sm text-on-surface-variant bg-surface-container px-3 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm">lock</span>
                  수정 불가 (환자 제공 정보)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
                {[
                  { label: '아이디 (ID)',     value: patient.login_id },
                  { label: '환자 코드 (Code)', value: patient.patient_code },
                  { label: '이름 (Name)',      value: patient.name },
                  { label: '성별 (Gender)',    value: patient.gender },
                  { label: '생년월일 (Birth)', value: String(patient.birth_date).replace(/-/g, '.') },
                  { label: '연락처 (Phone)',   value: patient.phone },
                ].map((row) => (
                  <div key={row.label} className="space-y-1.5">
                    <label className="text-label-sm font-semibold text-on-surface-variant">{row.label}</label>
                    <div className={roCls}>{row.value}</div>
                    <div className="h-4" />
                  </div>
                ))}

                {/* 보호자 이메일 — 전체 너비 */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-label-sm font-semibold text-on-surface-variant">보호자 이메일</label>
                  <div className={roCls}>{patient.guardianEmail || '미입력'}</div>
                  <div className="h-4" />
                </div>

                {/* 수신 동의 */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-label-sm font-semibold text-on-surface-variant">보호자 재활 보고서 수신 동의</label>
                  <div className={`flex items-center gap-2 px-3 py-2.5 border border-outline-variant rounded-xl bg-surface-container-low`}>
                    <span className={`material-symbols-outlined text-base ${patient.report_consent ? 'text-doctor-primary' : 'text-outline'}`}
                      style={{ fontVariationSettings: "'FILL' 1" }}>
                      {patient.report_consent ? 'check_circle' : 'cancel'}
                    </span>
                    <span className={`text-body-md font-semibold ${patient.report_consent ? 'text-doctor-primary' : 'text-on-surface-variant'}`}>
                      {patient.report_consent ? '동의함' : '동의하지 않음'}
                    </span>
                  </div>
                  <div className="h-4" />
                </div>
              </div>
            </section>

            {/* ── STEP 3: 의사 입력 (수술/재활 정보) ── */}
            <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-outline-variant">
                <span className="w-6 h-6 bg-doctor-primary text-white text-label-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">3</span>
                <h2 className="text-title-md font-bold text-doctor-primary">수술 및 재활 정보 입력</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
                <Field label="수술 부위">
                  <input
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="예: 손가락, 어깨, 무릎"
                    className={inputCls}
                  />
                </Field>

                <Field label="수술명">
                  <input
                    value={surgery}
                    onChange={(e) => setSurgery(e.target.value)}
                    placeholder="예: 손가락 골절 수술"
                    className={inputCls}
                  />
                </Field>

                <Field label="수술 시기">
                  <input
                    type="date"
                    value={surgeryDate}
                    onChange={(e) => setSurgeryDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <Field label="재활 시작 시기">
                  <input
                    type="date"
                    value={rehabStart}
                    onChange={(e) => setRehabStart(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <Field label="진행 단계">
                  <select
                    value={stage}
                    onChange={(e) => setStage(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">선택 안함</option>
                    <option value="초기">초기</option>
                    <option value="중기">중기</option>
                    <option value="후기">후기</option>
                  </select>
                </Field>

                <Field label="진료 예정일">
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(e) => setAppointmentDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>
              </div>
            </section>

            {/* ── STEP 4: 관절 가동 범위 (ROM) ── */}
            <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-outline-variant">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 bg-doctor-primary text-white text-label-sm font-bold rounded-full flex items-center justify-center flex-shrink-0">4</span>
                  <h2 className="text-title-md font-bold text-doctor-primary">관절 가동 범위 (ROM)</h2>
                </div>
                <div className="flex gap-1.5">
                  {ROM_EXERCISE_TABS.map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => setActiveRomTab(key)}
                      className={`px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-colors
                        ${activeRomTab === key
                          ? 'bg-doctor-primary text-white shadow-sm'
                          : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                        }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="text-label-sm text-on-surface-variant">
                각 관절의 가동 범위를 입력해주세요. 단위: 도(°), 소수점 1자리까지 입력 가능합니다.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[580px] border-collapse">
                  <thead>
                    <tr className="bg-[#f0f6ff]">
                      <th className="px-2 py-2.5 text-label-sm font-bold text-doctor-primary border border-outline-variant text-center w-36 whitespace-nowrap">관절</th>
                      {ROM_FINGERS.map((f) => (
                        <th key={f.key} className="px-1 py-2.5 text-label-sm font-bold text-doctor-primary border border-outline-variant text-center">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ROM_ROWS.map(({ label, joint, hand }) => (
                      <tr key={`${joint}_${hand}`} className="hover:bg-surface-container-lowest transition-colors">
                        <td className="px-2 py-2.5 text-label-sm font-semibold text-on-surface-variant border border-outline-variant text-center bg-surface-container-low whitespace-nowrap">
                          {label}
                        </td>
                        {ROM_FINGERS.map((f) => {
                          const stateKey = `${f.key}_${joint}_${hand}`;
                          return (
                            <td key={f.key} className="px-1 py-2 border border-outline-variant text-center">
                              <div className="flex items-center justify-center gap-1">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  max="180"
                                  value={currentRom[stateKey] ?? ''}
                                  onChange={(e) => setCurrentRom((prev) => ({ ...prev, [stateKey]: e.target.value }))}
                                  placeholder="—"
                                  className="w-14 text-center border border-outline-variant rounded-lg py-1.5 text-label-md text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary placeholder:text-outline"
                                />
                                <span className="text-label-sm text-on-surface-variant">°</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 에러 메시지 */}
            {submitError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-error-container text-on-error-container rounded-xl text-label-md">
                <span className="material-symbols-outlined text-base">error</span>
                {submitError}
              </div>
            )}

            {/* 하단 버튼 */}
            <div className="flex justify-end gap-3 pb-4">
              <button
                onClick={() => { setPatient(null); setQuery(''); setSearched(false); setSubmitError(''); }}
                className="px-6 py-3 border-2 border-outline-variant text-on-surface-variant font-semibold rounded-xl hover:border-doctor-primary hover:text-doctor-primary transition-colors text-label-md"
              >
                다시 검색
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-2 px-8 py-3 bg-doctor-primary text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-md text-label-md"
              >
                <span className="material-symbols-outlined text-base">person_add</span>
                {submitting ? '등록 중...' : '환자 등록 완료'}
              </button>
            </div>
          </>
        )}

      </main>
    </div>
  );
}
