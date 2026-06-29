import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';
import { patientApi } from '../../api';

function formatDate(dateStr) {
  if (!dateStr) return '—';
  return dateStr.replace(/-/g, '.');
}

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
function PrescriptionSchedule({ prescription, schedule, setSchedule, readOnly = false, minEditableDate = null }) {
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));

  const enabled = prescription.filter((ex) => ex.enabled);
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const canEditDate = (dateStr) => !readOnly && (!minEditableDate || dateStr > minEditableDate);

  const toggle = (name, dateStr) => {
    if (!canEditDate(dateStr)) return;
    setSchedule((prev) => ({ ...prev, [`${name}|${dateStr}`]: !prev[`${name}|${dateStr}`] }));
  };

  const isOn = (name, dateStr) => !!schedule[`${name}|${dateStr}`];

  const assignWeekdays = () => {
    if (readOnly) return;
    const next = { ...schedule };
    enabled.forEach(({ name }) =>
      weekDates.slice(0, 5).forEach((d) => {
        const dateStr = toKey(d);
        if (canEditDate(dateStr)) next[`${name}|${dateStr}`] = true;
      })
    );
    setSchedule(next);
  };

  const assignAll = () => {
    if (readOnly) return;
    const next = { ...schedule };
    enabled.forEach(({ name }) =>
      weekDates.forEach((d) => {
        const dateStr = toKey(d);
        if (canEditDate(dateStr)) next[`${name}|${dateStr}`] = true;
      })
    );
    setSchedule(next);
  };

  const clearWeek = () => {
    if (readOnly) return;
    const next = { ...schedule };
    enabled.forEach(({ name }) =>
      weekDates.forEach((d) => {
        const dateStr = toKey(d);
        if (canEditDate(dateStr)) delete next[`${name}|${dateStr}`];
      })
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
                  const disabled = !canEditDate(dateStr);
                  return (
                    <td key={j} className="text-center px-2 py-3">
                      <button
                        onClick={() => toggle(ex.name, dateStr)}
                        disabled={disabled}
                        className={`w-8 h-8 rounded-full text-label-sm font-bold transition-all active:scale-90
                          ${on
                            ? 'bg-doctor-primary text-white shadow-sm'
                            : 'bg-surface-container text-on-surface-variant hover:bg-[#e8f0fe] hover:text-doctor-primary'
                          } ${disabled ? 'cursor-not-allowed opacity-50 active:scale-100' : ''}`}
                      >
                        {on
                          ? <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1, 'wght' 700" }}>check</span>
                          : <span className="text-xs">{disabled ? '' : '+'}</span>
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

      {/* 빠른 설정 (편집 모드에서만) */}
      {!readOnly && (
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
      )}
    </div>
  );
}

const defaultPrescription = [
  { name: '오른손 태핑 (Tapping)', sets: 3, reps: 10, enabled: false },
  { name: '왼손 태핑 (Tapping)',   sets: 3, reps: 10, enabled: false },
  { name: '오른손 그립 (Grip)',    sets: 2, reps: 10, enabled: false },
  { name: '왼손 그립 (Grip)',      sets: 2, reps: 10, enabled: false },
];

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
  { label: 'PIP / IP (왼손)',   joint: 'PIP', hand: '왼손'  },
  { label: 'PIP / IP (오른손)', joint: 'PIP', hand: '오른손' },
  { label: 'DIP (왼손, 엄지 제외)',   joint: 'DIP', hand: '왼손'  },
  { label: 'DIP (오른손, 엄지 제외)', joint: 'DIP', hand: '오른손' },
];
const romJointForFinger = (fingerKey, joint) => (fingerKey === 'thumb' && joint === 'PIP' ? 'IP' : joint);
const romLabelForFinger = (fingerKey, joint, hand) => `${fingerKey === 'thumb' && joint === 'PIP' ? 'IP' : joint} (${hand})`;
const ROM_EXERCISE_TABS = [
  { key: 'basic',   label: 'Grip'    },
  { key: 'tapping', label: 'Tapping' },
];

export default function PatientInfo() {
  const navigate = useNavigate();
  const { patientId } = useParams();
  const [patient, setPatient] = useState(null);
  const [medicalEditing, setMedicalEditing] = useState(false);
  const [medEdit, setMedEdit] = useState({ surgery_name: '', surgery_area: '', surgery_date: '', rehab_start_date: '', current_rehab_phase: '', appointment_date: '' });

  const [prescription, setPrescription] = useState(defaultPrescription);
  const [aiAdjust, setAiAdjust] = useState(true);
  const [aiJustSaved, setAiJustSaved] = useState(false);
  const [schedule, setSchedule] = useState({});
  const [justSaved,  setJustSaved]  = useState(false);
  const [isSaving,   setIsSaving]   = useState(false);
  const [selectedSession, setSelectedSession] = useState(0);
  const [lightboxPhoto, setLightboxPhoto] = useState(null);
  const [isEditing, setIsEditing] = useState(true);
  const [isEditingRom, setIsEditingRom] = useState(false);
  const [rom, setRom]                   = useState({});
  const [activeRomTab, setActiveRomTab] = useState('basic');
  const [tappingRom, setTappingRom]     = useState({});
  const [prescriptionLoaded, setPrescriptionLoaded] = useState(false);
  const [exerciseCaptures, setExerciseCaptures] = useState([]);

  useEffect(() => {
    if (!patientId) return;
    patientApi.getPatient(patientId).then((data) => {
      setPatient(data);
      setMedEdit({
        surgery_name:        data.surgery_name         ?? '',
        surgery_area:        data.surgery_area         ?? '',
        surgery_date:        data.surgery_date         ?? '',
        rehab_start_date:    data.rehab_start_date     ?? '',
        current_rehab_phase: data.current_rehab_phase  ?? '',
        appointment_date:    data.appointment_date      ?? '',
      });
    }).catch(() => {});

    patientApi.getPatientPrescription(patientId).then((data) => {
      if (data) {
        const apiMap = new Map((data.exercises ?? []).map((ex) => [ex.name, ex]));
        const merged = defaultPrescription.map((def) => {
          const api = apiMap.get(def.name);
          return api ? { ...def, sets: api.sets, reps: api.reps, enabled: true } : { ...def, enabled: false };
        });
        (data.exercises ?? []).forEach((api) => {
          if (!merged.find((m) => m.name === api.name)) {
            merged.push({ name: api.name, sets: api.sets, reps: api.reps, enabled: true });
          }
        });
        setPrescription(merged);
        setSchedule(data.schedule ?? {});
        setIsEditing(false);
      }
      setPrescriptionLoaded(true);
    }).catch(() => { setPrescriptionLoaded(true); });

    patientApi.getPatientRom(patientId, 'grip')
      .then((data) => setRom(data.rom ?? {}))
      .catch(() => {});
    patientApi.getPatientRom(patientId, 'tapping')
      .then((data) => setTappingRom(data.rom ?? {}))
      .catch(() => {});
    patientApi.getPatientExerciseCaptures(patientId)
      .then(setExerciseCaptures)
      .catch(() => setExerciseCaptures([]));
  }, [patientId]);

  const handleMedicalSave = () => {
    const body = {};
    Object.entries(medEdit).forEach(([k, v]) => { if (v !== '') body[k] = v; });
    patientApi.updatePatientMedical(patientId, body)
      .then((data) => { setPatient(data); setMedicalEditing(false); })
      .catch(() => {});
  };
  const handleMedicalCancel = () => {
    setMedEdit({
      surgery_name:        patient?.surgery_name         ?? '',
      surgery_area:        patient?.surgery_area         ?? '',
      surgery_date:        patient?.surgery_date         ?? '',
      rehab_start_date:    patient?.rehab_start_date     ?? '',
      current_rehab_phase: patient?.current_rehab_phase  ?? '',
      appointment_date:    patient?.appointment_date      ?? '',
    });
    setMedicalEditing(false);
  };

  const romByTab    = { basic: rom,    tapping: tappingRom    };
  const setRomByTab = { basic: setRom, tapping: setTappingRom };
  const currentRom    = romByTab[activeRomTab]    ?? {};
  const setCurrentRom = setRomByTab[activeRomTab];

  const hasRomData = Object.values(currentRom).some((v) => v !== '' && v !== null && v !== undefined);

  const handleRomSave = () => {
    const body = {};
    Object.entries(currentRom).forEach(([k, v]) => {
      if (v !== '' && v !== null && v !== undefined) body[k] = parseFloat(v);
    });
    const exerciseType = activeRomTab === 'basic' ? 'grip' : 'tapping';
    patientApi.updatePatientRom(patientId, { exercise_type: exerciseType, rom: body })
      .then((data) => {
        if (activeRomTab === 'basic') setRom(data.rom ?? {});
        else setTappingRom(data.rom ?? {});
        setIsEditingRom(false);
      })
      .catch(() => {});
  };
  const handleRomCancel = () => { setIsEditingRom(false); };

  const updatePrescription = (idx, field, val) =>
    setPrescription((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));

  const toggleEnabled = (idx) =>
    setPrescription((prev) => prev.map((row, i) => (i === idx ? { ...row, enabled: !row.enabled } : row)));

  const hasChecked = prescription.some((ex) => ex.enabled);
  const hasSchedule = Object.values(schedule).some(Boolean);
  const canSave = hasChecked && hasSchedule;

  const handleSave = () => {
    if (!canSave || isSaving) return;
    setIsSaving(true);
    patientApi.savePatientPrescription(patientId, {
      rehab_phase: patient?.current_rehab_phase || undefined,
      exercises: prescription,
      schedule,
      rom,
    })
      .then(() => {
        setJustSaved(true);
        setIsEditing(false);
        setTimeout(() => setJustSaved(false), 2000);
      })
      .catch(() => {})
      .finally(() => setIsSaving(false));
  };

  const handleEditStart = () => {
    setIsEditing(true);
  };

  const handleEditCancel = () => {
    setPrescription(defaultPrescription);
    setSchedule({});
    setIsEditing(false);
  };

  /* 환자 정보 셀 border */
  const cellBorder = (i) => {
    const total = 10;
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

  const startCaptures = exerciseCaptures.filter((capture) => capture.group === 'start');
  const otherCaptures = exerciseCaptures.filter((capture) => capture.group !== 'start');
  const sessionGallery = [
    { label: '시작 GIF', date: '전체 기록', photos: startCaptures },
    { label: '운동 완료 / 과부하 GIF', date: '전체 기록', photos: otherCaptures },
  ];
  const currentPhotos = sessionGallery[selectedSession]?.photos ?? [];

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavBar />

      {/* 라이트박스 */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="relative max-w-lg w-full rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full aspect-video max-h-[72vh] bg-black flex items-center justify-center">
              <img src={lightboxPhoto.url} alt={lightboxPhoto.exercise_name} className="w-full h-full object-cover" />
            </div>
            <div className="bg-white px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-title-sm font-bold text-on-surface">{lightboxPhoto.exercise_name}</p>
                <p className="text-label-sm text-on-surface-variant mt-0.5">
                  {sessionGallery[selectedSession]?.label} · {sessionGallery[selectedSession]?.date} · {lightboxPhoto.time}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {currentPhotos.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setLightboxPhoto(p)}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${p.id === lightboxPhoto.id ? 'bg-doctor-primary scale-125' : 'bg-outline-variant hover:bg-outline'}`}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-3 right-3 w-8 h-8 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-white text-base">close</span>
            </button>
            <button
              onClick={() => {
                const idx = currentPhotos.findIndex((p) => p.id === lightboxPhoto.id);
                setLightboxPhoto(currentPhotos[(idx - 1 + currentPhotos.length) % currentPhotos.length]);
              }}
              className="absolute left-3 top-1/3 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-white text-base">chevron_left</span>
            </button>
            <button
              onClick={() => {
                const idx = currentPhotos.findIndex((p) => p.id === lightboxPhoto.id);
                setLightboxPhoto(currentPhotos[(idx + 1) % currentPhotos.length]);
              }}
              className="absolute right-3 top-1/3 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-white text-base">chevron_right</span>
            </button>
          </div>
        </div>
      )}

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
              onClick={() => navigate('/doctor/report/daily', { state: { patientId } })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-doctor-primary text-doctor-primary font-semibold text-label-sm hover:bg-[#e8f0fe] transition-colors"
            >
              <span className="material-symbols-outlined text-sm">today</span>
              일일 리포트
            </button>
            <button
              onClick={() => navigate('/doctor/report/progress', { state: { patientId } })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-doctor-primary text-white font-semibold text-label-sm hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              누적 리포트
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-doctor-primary tracking-tight">
            환자 정보
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {patient ? `${patient.name} 환자 · ${patient.patient_code}` : '로딩 중...'}
          </p>
        </div>

        {/* 환자 정보 */}
        <section className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-card">
          {/* 섹션 헤더 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-outline-variant bg-surface-container-low">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-doctor-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
              <h2 className="text-title-md font-bold text-doctor-primary">기본 정보</h2>
            </div>
            {medicalEditing ? (
              <div className="flex gap-2">
                <button onClick={handleMedicalSave} className="px-4 py-1.5 bg-doctor-primary text-white rounded-xl text-label-sm font-semibold hover:opacity-90 transition-opacity">저장</button>
                <button onClick={handleMedicalCancel} className="px-4 py-1.5 border border-outline-variant text-on-surface-variant rounded-xl text-label-sm font-semibold hover:bg-surface-container transition-colors">취소</button>
              </div>
            ) : (
              <button onClick={() => setMedicalEditing(true)} className="flex items-center gap-1.5 px-4 py-1.5 border-2 border-doctor-primary text-doctor-primary rounded-xl text-label-sm font-semibold hover:bg-[#e8f0fe] transition-colors">
                <span className="material-symbols-outlined text-sm">edit</span>편집
              </button>
            )}
          </div>

          {/* 읽기 전용 — 성명·환자번호·성별·생년월일·연락처·병원명 */}
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {[
              { label: '성명 (Name)',        value: patient?.name },
              { label: '환자번호 (Code)',    value: patient?.patient_code },
              { label: '성별 (Gender)',      value: patient?.gender },
              { label: '생년월일 (Birth)',   value: formatDate(patient?.birth_date) },
              { label: '연락처 (Phone)',     value: patient?.phone },
              { label: '병원명',             value: patient?.hospital_name },
            ].map((item, i) => (
              <div key={i} className={`flex border-outline-variant ${i < 4 ? 'border-b' : ''} ${i % 2 === 0 ? 'sm:border-r' : ''}`}>
                <div className="w-36 sm:w-44 flex-shrink-0 bg-surface-container-low px-4 py-3 text-label-sm font-semibold text-on-surface-variant border-r border-outline-variant">
                  {item.label}
                </div>
                <div className="flex-1 min-w-0 px-4 py-3 text-body-md text-on-surface">{item.value ?? '—'}</div>
              </div>
            ))}
          </div>

          {/* 편집 가능 — 수술명·수술부위·수술일·재활시작일·재활진행단계·진료예정일 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 border-t border-outline-variant">
            {[
              { label: '수술명',        key: 'surgery_name',        type: 'text',   placeholder: '예: 손가락 골절 수술' },
              { label: '수술 부위',     key: 'surgery_area',        type: 'text',   placeholder: '예: 손가락' },
              { label: '수술일',        key: 'surgery_date',        type: 'date',   placeholder: '' },
              { label: '재활 시작일',   key: 'rehab_start_date',    type: 'date',   placeholder: '' },
              { label: '재활 진행단계', key: 'current_rehab_phase', type: 'select', placeholder: '' },
              { label: '진료 예정일',   key: 'appointment_date',    type: 'date',   placeholder: '' },
            ].map((item, i) => (
              <div key={i} className={`flex border-outline-variant ${i < 4 ? 'border-b' : ''} ${i % 2 === 0 ? 'sm:border-r' : ''}`}>
                <div className="w-36 sm:w-44 flex-shrink-0 bg-surface-container-low px-4 py-3 text-label-sm font-semibold text-on-surface-variant border-r border-outline-variant">
                  {item.label}
                </div>
                <div className="flex-1 min-w-0 px-4 py-2 flex items-center">
                  {medicalEditing ? (
                    item.type === 'select' ? (
                      <select
                        value={medEdit[item.key]}
                        onChange={(e) => setMedEdit((p) => ({ ...p, [item.key]: e.target.value }))}
                        className="w-full border border-outline-variant rounded-lg px-3 py-1.5 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary bg-white"
                      >
                        <option value="">선택 안함</option>
                        <option value="초기">초기</option>
                        <option value="중기">중기</option>
                        <option value="후기">후기</option>
                      </select>
                    ) : (
                      <input
                        type={item.type}
                        value={medEdit[item.key]}
                        onChange={(e) => setMedEdit((p) => ({ ...p, [item.key]: e.target.value }))}
                        placeholder={item.placeholder}
                        className="w-full border border-outline-variant rounded-lg px-3 py-1.5 text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary placeholder:text-outline"
                      />
                    )
                  ) : (
                    <span className="text-body-md text-on-surface">
                      {item.type === 'date' ? formatDate(medEdit[item.key]) || '—' : medEdit[item.key] || '—'}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 치료 사진 갤러리 */}
        <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>photo_library</span>
              치료 사진 기록
            </h2>
            <span className="text-label-sm text-on-surface-variant">총 {sessionGallery.reduce((s, g) => s + g.photos.length, 0)}장</span>
          </div>

          {/* 세션 탭 */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {sessionGallery.map((session, i) => (
              <button
                key={i}
                onClick={() => { setSelectedSession(i); setLightboxPhoto(null); }}
                className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-label-sm font-semibold transition-all border
                  ${selectedSession === i
                    ? 'bg-doctor-primary text-white border-doctor-primary shadow-sm'
                    : 'border-outline-variant text-on-surface-variant hover:border-doctor-primary hover:text-doctor-primary'
                  }`}
              >
                <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
                {session.label} · {session.date}
                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full ${selectedSession === i ? 'bg-white/20' : 'bg-surface-container'}`}>
                  {session.photos.length}장
                </span>
              </button>
            ))}
          </div>

          {/* 사진 그리드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {currentPhotos.length === 0 && (
              <div className="sm:col-span-2 aspect-video rounded-xl border border-dashed border-outline-variant bg-surface-container-low flex items-center justify-center text-label-md text-on-surface-variant">
                촬영된 GIF가 없습니다
              </div>
            )}
            {currentPhotos.map((photo) => (
              <button
                key={photo.id}
                onClick={() => setLightboxPhoto(photo)}
                className="relative aspect-square rounded-xl overflow-hidden group shadow-sm hover:shadow-md transition-all active:scale-95"
              >
                <img src={photo.url} alt={photo.exercise_name} className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1.5 flex items-center justify-between">
                  <span className="text-white text-[11px] font-semibold truncate">{photo.exercise_name}</span>
                  <span className="text-white/80 text-[10px] flex-shrink-0 ml-1">{photo.type}</span>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="material-symbols-outlined text-white text-base drop-shadow">open_in_full</span>
                </div>
              </button>
            ))}
          </div>

          <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">info</span>
            사진을 클릭하면 크게 볼 수 있습니다
          </p>
        </section>

        {/* 관절 가동 범위 (ROM) */}
        <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>straighten</span>
              관절 가동 범위 (ROM)
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-1.5">
                {ROM_EXERCISE_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => { setActiveRomTab(key); setIsEditingRom(false); }}
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
              {!isEditingRom && (
                <button
                  onClick={() => setIsEditingRom(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-doctor-primary text-doctor-primary font-semibold text-label-sm hover:bg-[#e8f0fe] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  수정
                </button>
              )}
            </div>
          </div>

          {/* 데이터 없음 */}
          {!isEditingRom && !hasRomData && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-outline text-3xl">straighten</span>
              </div>
              <div>
                <p className="text-label-md font-semibold text-on-surface">측정된 ROM 데이터가 없습니다</p>
                <p className="text-label-sm text-on-surface-variant mt-1">아래 버튼을 눌러 관절 가동 범위를 입력해주세요</p>
              </div>
              <button
                onClick={() => setIsEditingRom(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-doctor-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-sm text-label-md"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                ROM 입력
              </button>
            </div>
          )}

          {/* 조회 모드 */}
          {!isEditingRom && hasRomData && (
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
                        const actualJoint = romJointForFinger(f.key, joint);
                        const stateKey = `${f.key}_${actualJoint}_${hand}`;
                        const val = currentRom[stateKey];
                        if (f.key === 'thumb' && joint === 'DIP') {
                          return (
                            <td key={f.key} className="px-1 py-2.5 border border-outline-variant text-center text-outline">
                              —
                            </td>
                          );
                        }
                        return (
                          <td key={f.key} className="px-1 py-2.5 border border-outline-variant text-center text-label-md font-semibold text-on-surface">
                            {val !== undefined
                              ? `${val}°`
                              : <span className="text-outline font-normal">—</span>
                            }
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 편집 모드 */}
          {isEditingRom && (
            <>
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
                          const displayLabel = romLabelForFinger(f.key, joint, hand);
                          const actualJoint = romJointForFinger(f.key, joint);
                          const stateKey = `${f.key}_${actualJoint}_${hand}`;
                          if (f.key === 'thumb' && joint === 'DIP') {
                            return (
                              <td key={f.key} className="px-1 py-2 border border-outline-variant text-center text-outline">
                                —
                              </td>
                            );
                          }
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
                                  aria-label={`${f.label} ${displayLabel}`}
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
              <div className="flex justify-end gap-3 pt-2 border-t border-outline-variant">
                {hasRomData && (
                  <button
                    onClick={handleRomCancel}
                    className="px-5 py-2.5 border-2 border-outline-variant text-on-surface-variant font-semibold rounded-xl hover:border-doctor-primary hover:text-doctor-primary transition-colors text-label-md"
                  >
                    취소
                  </button>
                )}
                <button
                  onClick={handleRomSave}
                  className="flex items-center gap-2 px-6 py-2.5 bg-doctor-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md text-label-md"
                >
                  <span className="material-symbols-outlined text-base">save</span>
                  저장 (Save)
                </button>
              </div>
            </>
          )}
        </section>

        {/* 운동 처방 */}
        <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
                운동 처방
              </h2>
              {!isEditing && !isEditing && (
                <p className="text-label-sm text-on-surface-variant mt-0.5 ml-7 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm">event</span>
                  처방일: <span className="font-semibold text-on-surface">{patient?.appointment_date}</span>
                </p>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* AI 난이도 조절 토글 — 항상 표시, 즉시 저장 */}
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-[#1a73e8]">auto_awesome</span>
                <span className="text-label-md text-on-surface font-medium">AI 난이도 조절</span>
                <button
                  onClick={() => {
                    setAiAdjust((v) => !v);
                    setAiJustSaved(true);
                    setTimeout(() => setAiJustSaved(false), 2000);
                  }}
                  className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${aiAdjust ? 'bg-doctor-primary' : 'bg-outline-variant'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${aiAdjust ? 'translate-x-[22px]' : 'translate-x-0'}`} />
                </button>
                {aiJustSaved && (
                  <span className="flex items-center gap-1 text-label-sm text-[#34a853] font-semibold">
                    <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    저장됨
                  </span>
                )}
              </div>
              {!isEditing && !isEditing && (
                <button
                  onClick={handleEditStart}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-doctor-primary text-doctor-primary font-semibold text-label-sm hover:bg-[#e8f0fe] transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">edit</span>
                  처방 수정
                </button>
              )}
            </div>
          </div>

          {/* ── 조회 모드 ── */}
          {!isEditing && !isEditing && (
            <>

              <div className="overflow-x-auto">
                <table className="w-full text-left border border-outline-variant rounded-xl overflow-hidden min-w-[480px]">
                  <thead>
                    <tr className="bg-[#f0f6ff] border-b border-outline-variant">
                      <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary">운동 종류</th>
                      <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">세트 수</th>
                      <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">세트당 횟수</th>
                      <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">예상 시간</th>
                      <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prescription.map((row, i) => (
                      <tr key={i} className={`border-b border-outline-variant last:border-0 ${!row.enabled ? 'opacity-40' : ''}`}>
                        <td className="px-4 py-3 text-body-md font-semibold text-on-surface">{row.name}</td>
                        <td className="px-4 py-3 text-center text-label-md text-on-surface">{row.sets}</td>
                        <td className="px-4 py-3 text-center text-label-md text-on-surface">{row.reps}</td>
                        <td className="px-4 py-3 text-center text-label-md text-on-surface-variant">
                          {row.enabled ? `약 ${row.sets * row.reps * 3}초` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.enabled
                            ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-doctor-primary bg-[#e8f0fe] px-2 py-0.5 rounded-full">
                                <span className="material-symbols-outlined text-xs" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>처방중
                              </span>
                            : <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-outline bg-surface-container px-2 py-0.5 rounded-full">
                                <span className="material-symbols-outlined text-xs">remove_circle</span>제외
                              </span>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 처방 일정 (읽기 전용) */}
              <div className="border-t border-outline-variant pt-4 space-y-1">
                <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
                  처방 일정
                </h3>
              </div>
              <PrescriptionSchedule
                prescription={prescription}
                schedule={schedule}
                setSchedule={() => {}}
                readOnly
              />
            </>
          )}

          {/* ── 처방 없음 ── */}
          {!isEditing && isEditing && (
            <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
              <div className="w-14 h-14 bg-surface-container rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-outline text-3xl">assignment_late</span>
              </div>
              <div>
                <p className="text-label-md font-semibold text-on-surface">처방된 운동이 없습니다</p>
                <p className="text-label-sm text-on-surface-variant mt-1">아래 버튼을 눌러 운동을 처방해주세요</p>
              </div>
              <button
                onClick={handleEditStart}
                className="flex items-center gap-2 px-6 py-2.5 bg-doctor-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-sm text-label-md"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                운동 처방 시작
              </button>
            </div>
          )}

          {/* ── 편집 모드 ── */}
          {isEditing && (
            <>
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

              <div className="border-t border-outline-variant pt-4 space-y-1">
                <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
                  처방 일정 설정
                </h3>
              </div>
              <PrescriptionSchedule prescription={prescription} schedule={schedule} setSchedule={setSchedule} minEditableDate={(() => { const d = new Date(); d.setDate(d.getDate() - 1); return toKey(d); })()} />
            </>
          )}
        </section>

        {/* 저장 / 취소 */}
        {isEditing && (
          <div className="flex justify-end gap-3 pb-4">
            <button
              onClick={handleEditCancel}
              disabled={isSaving}
              className="px-6 py-3 border-2 border-outline-variant text-on-surface-variant font-semibold rounded-xl hover:border-doctor-primary hover:text-doctor-primary transition-colors text-label-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!canSave || isSaving}
              className={`flex items-center gap-2 px-6 sm:px-8 py-3 font-semibold rounded-xl transition-opacity shadow-md text-label-md
                ${canSave && !isSaving ? 'bg-doctor-primary text-white hover:opacity-90' : 'bg-surface-container text-on-surface-variant cursor-not-allowed opacity-50'}`}
            >
              {isSaving ? (
                <>
                  <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
                  저장 중...
                </>
              ) : justSaved ? (
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
        )}

      </main>
    </div>
  );
}
