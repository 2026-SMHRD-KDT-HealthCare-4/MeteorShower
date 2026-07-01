import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';
import { patientApi } from '../../api';


const roCls = 'w-full px-3 py-2.5 border border-outline-variant rounded-xl text-body-md text-on-surface bg-surface-container-low cursor-default select-none';

export default function PatientRegister() {
  const navigate = useNavigate();

  /* 검색 단계 */
  const [query, setQuery]         = useState('');
  const [searched, setSearched]   = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [patient, setPatient]     = useState(null);

  const [done, setDone]             = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  /* 검색 결과 목록 */
  const [results, setResults] = useState([]);

  /* 검색 실행 */
  const handleSearch = () => {
    if (!query.trim()) return;
    setSearched(true);
    setSearching(true);
    setSearchError('');
    setPatient(null);
    patientApi.searchPatients(query.trim())
      .then((data) => { setResults(data); })
      .catch((err) => { setResults([]); setSearchError(err.message); })
      .finally(() => setSearching(false));
  };

  /* 목록에서 환자 선택 */
  const handleSelect = (p) => {
    setPatient(p);
  };

  /* 제출 */
  const handleSubmit = () => {
    if (!patient) return;
    setSubmitting(true);
    setSubmitError('');
    patientApi.assignPatient(patient.patient_id, {})
      .then(() => setDone(true))
      .catch((err) => setSubmitError(err.message))
      .finally(() => setSubmitting(false));
  };

  /* ── 완료 화면 ── */
  if (done && patient) {
    return (
      <div className="min-h-screen bg-background" style={{ backgroundImage: "url('/doctor-bg-pattern.svg')", backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }}>
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
            <p className="text-label-sm text-on-surface-variant mt-1">
              환자가 앱에 처음 로그인하면 등록 정보 확인 후 동의를 완료할 수 있습니다.
            </p>
          </div>
          <div className="w-full bg-white border border-outline-variant rounded-2xl p-5 text-left space-y-2 shadow-card">
            {[
              { label: '환자명',    value: patient.name },
              { label: '코드',      value: patient.patient_code },
              { label: '성별',      value: patient.gender },
              { label: '생년월일',  value: String(patient.birth_date).replace(/-/g, '.') },
              { label: '연락처',    value: patient.phone },
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
    <div className="min-h-screen bg-background" style={{ backgroundImage: "url('/doctor-bg-pattern.svg')", backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }}>
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
            회원가입된 환자를 검색하여 담당 환자로 등록해주세요.
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
