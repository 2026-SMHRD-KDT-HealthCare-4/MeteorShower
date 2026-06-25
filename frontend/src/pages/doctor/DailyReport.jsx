import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';
import { patientApi, reportApi } from '../../api';

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
          disabled={readOnly}
          className="px-3 py-1.5 rounded-lg text-label-sm font-semibold border border-doctor-primary text-doctor-primary hover:bg-[#e8f0fe] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          평일만
        </button>
        <button
          onClick={assignAll}
          disabled={readOnly}
          className="px-3 py-1.5 rounded-lg text-label-sm font-semibold border border-doctor-primary text-doctor-primary hover:bg-[#e8f0fe] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          전체 선택
        </button>
        <button
          onClick={clearWeek}
          disabled={readOnly}
          className="px-3 py-1.5 rounded-lg text-label-sm font-semibold border border-outline-variant text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          이번 주 초기화
        </button>
      </div>
    </div>
  );
}

const exerciseResults = [
  { name: '엄지 (Thumb)',  value: 75, warn: false },
  { name: '검지 (Index)',  value: 82, warn: false },
  { name: '중지 (Middle)', value: 90, warn: false },
  { name: '약지 (Ring)',   value: 68, warn: true  },
  { name: '소지 (Pinky)', value: 75, warn: false },
];

const ROM_BY_EXERCISE = [
  {
    key: 'right_tapping', label: '오른손 태핑',
    fingers: [
      { key: 'thumb',  label: '엄지 (Thumb)',
        joints: [{ name: 'MCP', ref: 50.0, max: 46.5, min: 29.5 }, { name: 'PIP', ref: 80.0, max: 75.0, min: 55.5 }, { name: 'DIP', ref: 60.0, max: 57.0, min: 40.5 }] },
      { key: 'index',  label: '검지 (Index)',
        joints: [{ name: 'MCP', ref: 90.0, max: 88.0, min: 63.5 }, { name: 'PIP', ref: 100.0, max: 97.5, min: 71.5 }, { name: 'DIP', ref: 80.0, max: 74.5, min: 52.5 }] },
      { key: 'middle', label: '중지 (Middle)',
        joints: [{ name: 'MCP', ref: 90.0, max: 90.5, min: 66.5 }, { name: 'PIP', ref: 100.0, max: 101.0, min: 74.0 }, { name: 'DIP', ref: 80.0, max: 78.0, min: 56.5 }] },
      { key: 'ring',   label: '약지 (Ring)',
        joints: [{ name: 'MCP', ref: 90.0, max: 67.0, min: 41.0 }, { name: 'PIP', ref: 100.0, max: 74.0, min: 46.5 }, { name: 'DIP', ref: 80.0, max: 59.5, min: 36.0 }] },
      { key: 'pinky',  label: '소지 (Pinky)',
        joints: [{ name: 'MCP', ref: 90.0, max: 82.0, min: 59.5 }, { name: 'PIP', ref: 100.0, max: 90.5, min: 66.5 }, { name: 'DIP', ref: 80.0, max: 72.0, min: 51.5 }] },
    ],
  },
  {
    key: 'left_tapping', label: '왼손 태핑',
    fingers: [
      { key: 'thumb',  label: '엄지 (Thumb)',
        joints: [{ name: 'MCP', ref: 50.0, max: 44.0, min: 28.0 }, { name: 'PIP', ref: 80.0, max: 71.5, min: 53.0 }, { name: 'DIP', ref: 60.0, max: 54.0, min: 38.0 }] },
      { key: 'index',  label: '검지 (Index)',
        joints: [{ name: 'MCP', ref: 90.0, max: 83.5, min: 61.0 }, { name: 'PIP', ref: 100.0, max: 92.5, min: 68.5 }, { name: 'DIP', ref: 80.0, max: 70.5, min: 50.0 }] },
      { key: 'middle', label: '중지 (Middle)',
        joints: [{ name: 'MCP', ref: 90.0, max: 85.5, min: 63.0 }, { name: 'PIP', ref: 100.0, max: 95.5, min: 70.0 }, { name: 'DIP', ref: 80.0, max: 73.5, min: 53.0 }] },
      { key: 'ring',   label: '약지 (Ring)',
        joints: [{ name: 'MCP', ref: 90.0, max: 63.0, min: 38.5 }, { name: 'PIP', ref: 100.0, max: 70.0, min: 43.5 }, { name: 'DIP', ref: 80.0, max: 56.5, min: 34.0 }] },
      { key: 'pinky',  label: '소지 (Pinky)',
        joints: [{ name: 'MCP', ref: 90.0, max: 77.5, min: 56.0 }, { name: 'PIP', ref: 100.0, max: 85.5, min: 62.5 }, { name: 'DIP', ref: 80.0, max: 68.0, min: 48.0 }] },
    ],
  },
  {
    key: 'right_grip', label: '오른손 그립',
    fingers: [
      { key: 'thumb',  label: '엄지 (Thumb)',
        joints: [{ name: 'MCP', ref: 50.0, max: 45.2, min: 28.5 }, { name: 'PIP', ref: 80.0, max: 73.0, min: 54.0 }, { name: 'DIP', ref: 60.0, max: 55.5, min: 38.0 }] },
      { key: 'index',  label: '검지 (Index)',
        joints: [{ name: 'MCP', ref: 90.0, max: 85.5, min: 62.0 }, { name: 'PIP', ref: 100.0, max: 95.0, min: 70.0 }, { name: 'DIP', ref: 80.0, max: 72.5, min: 51.0 }] },
      { key: 'middle', label: '중지 (Middle)',
        joints: [{ name: 'MCP', ref: 90.0, max: 88.0, min: 65.0 }, { name: 'PIP', ref: 100.0, max: 98.5, min: 72.0 }, { name: 'DIP', ref: 80.0, max: 76.0, min: 55.0 }] },
      { key: 'ring',   label: '약지 (Ring)',
        joints: [{ name: 'MCP', ref: 90.0, max: 65.0, min: 40.0 }, { name: 'PIP', ref: 100.0, max: 72.0, min: 45.0 }, { name: 'DIP', ref: 80.0, max: 58.0, min: 35.0 }] },
      { key: 'pinky',  label: '소지 (Pinky)',
        joints: [{ name: 'MCP', ref: 90.0, max: 80.0, min: 58.0 }, { name: 'PIP', ref: 100.0, max: 88.0, min: 65.0 }, { name: 'DIP', ref: 80.0, max: 70.0, min: 50.0 }] },
    ],
  },
  {
    key: 'left_grip', label: '왼손 그립',
    fingers: [
      { key: 'thumb',  label: '엄지 (Thumb)',
        joints: [{ name: 'MCP', ref: 50.0, max: 43.0, min: 26.5 }, { name: 'PIP', ref: 80.0, max: 70.0, min: 51.5 }, { name: 'DIP', ref: 60.0, max: 52.5, min: 36.0 }] },
      { key: 'index',  label: '검지 (Index)',
        joints: [{ name: 'MCP', ref: 90.0, max: 83.0, min: 59.5 }, { name: 'PIP', ref: 100.0, max: 92.0, min: 67.0 }, { name: 'DIP', ref: 80.0, max: 70.0, min: 49.0 }] },
      { key: 'middle', label: '중지 (Middle)',
        joints: [{ name: 'MCP', ref: 90.0, max: 85.5, min: 62.0 }, { name: 'PIP', ref: 100.0, max: 95.5, min: 70.0 }, { name: 'DIP', ref: 80.0, max: 73.5, min: 53.0 }] },
      { key: 'ring',   label: '약지 (Ring)',
        joints: [{ name: 'MCP', ref: 90.0, max: 62.0, min: 38.0 }, { name: 'PIP', ref: 100.0, max: 69.0, min: 42.5 }, { name: 'DIP', ref: 80.0, max: 55.0, min: 33.0 }] },
      { key: 'pinky',  label: '소지 (Pinky)',
        joints: [{ name: 'MCP', ref: 90.0, max: 77.0, min: 55.0 }, { name: 'PIP', ref: 100.0, max: 85.0, min: 62.0 }, { name: 'DIP', ref: 80.0, max: 67.0, min: 47.0 }] },
    ],
  },
];

const defaultPrescription = [
  { name: '오른손 태핑 (Tapping)', sets: 3, reps: 10, enabled: false },
  { name: '왼손 태핑 (Tapping)',   sets: 3, reps: 10, enabled: false },
  { name: '오른손 그립 (Grip)',    sets: 2, reps: 10, enabled: false },
  { name: '왼손 그립 (Grip)',      sets: 2, reps: 10, enabled: false },
];

const sessionPhotos = [
  { id: 1, time: '10:23', label: '운동 시작', gradient: 'from-sky-300 to-blue-500' },
  { id: 2, time: '10:31', label: '태핑 동작', gradient: 'from-emerald-300 to-green-500' },
  { id: 3, time: '10:38', label: '그립 동작', gradient: 'from-violet-300 to-purple-500' },
  { id: 4, time: '10:45', label: '운동 완료', gradient: 'from-amber-300 to-orange-500' },
];

const defaultOpinion =
  `• 약지(Ring finger)의 운동 정확도가 60% 이상 다른 손가락에 비해 낮습니다. 금일은 동작 시 손가락 힘이 많이 빠져 이에 대한 집중적인 케어가 필요합니다.\n\n` +
  `• 부종 관련: 장시 이상의 가벼운 동통이 엄지에서 초기 몇 분에 정상적으로 나타납니다. 우측 손 날카로운 동통이 느껴진다면 즉시 중단하시오.\n\n` +
  `• 세션 전환: 운동 후 이번 주 이내에 다음 운동으로 전환하는 것이 좋습니다. 만약 15분간 날카로운 통증이 지속될 경우 다음을 수료하시오.\n\n` +
  `• 향상 권고: 본격 치료 관련으로 손가락 관절에 대한 가벼운 스트레칭을 병행하며 유연성을 확보하시오.`;

const FINGER_LABELS = ['엄지', '검지', '중지', '약지', '소지'];
const FINGER_LABEL_WITH_EN = {
  엄지: '엄지 (Thumb)',
  검지: '검지 (Index)',
  중지: '중지 (Middle)',
  약지: '약지 (Ring)',
  소지: '소지 (Pinky)',
};

function buildRomExercises(exercises = []) {
  return exercises
    .filter((exercise) => (exercise.finger_accuracy ?? []).length > 0)
    .map((exercise, idx) => {
      const byFinger = new Map();
      (exercise.finger_accuracy ?? []).forEach((item) => {
        if (!byFinger.has(item.finger_type)) byFinger.set(item.finger_type, []);
        byFinger.get(item.finger_type).push({
          name: item.joint_type,
          ref: item.target_rom,
          max: item.max_angle,
          min: item.min_angle,
          avg: item.avg_match_rate,
        });
      });

      return {
        key: `${exercise.schedule_id ?? idx}`,
        label: exercise.exercise_name,
        fingers: FINGER_LABELS
          .filter((finger) => byFinger.has(finger))
          .map((finger) => ({
            key: finger,
            label: FINGER_LABEL_WITH_EN[finger] ?? finger,
            joints: byFinger.get(finger),
          })),
      };
    })
    .filter((exercise) => exercise.fingers.length > 0);
}

/* ── 컴포넌트 ── */
export default function DailyReport() {
  const navigate = useNavigate();
  const location = useLocation();

  const [opinion, setOpinion]               = useState(defaultOpinion);
  const [editingOpinion, setEditingOpinion] = useState(false);
  const [lightboxPhoto, setLightboxPhoto]   = useState(null);
  const [showRomDetail, setShowRomDetail]   = useState(false);
  const [romExerciseIdx, setRomExerciseIdx] = useState(0);
  const [romFingerIdx, setRomFingerIdx]     = useState(0);
  const [prescription, setPrescription]     = useState(defaultPrescription);
  const [aiAdjust, setAiAdjust]             = useState(true);
  const [schedule, setSchedule]             = useState({});
  const [allExercises, setAllExercises]     = useState([]);
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [justSaved, setJustSaved]           = useState(false);
  const [patients, setPatients]             = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(location.state?.patientId ?? '');
  const [reports, setReports]               = useState([]);
  const [selectedReport, setSelectedReport] = useState(null);
  const [reportMessage, setReportMessage]   = useState('');
  const [reportBusy, setReportBusy]         = useState(false);
  const [dailyResult, setDailyResult]       = useState(null);
  const autoCreatingReportKey = useRef(null);
  const prescriptionReadOnly = false;
  const prescriptionMinEditableDate = toKey(new Date());

  const selectedPatient = patients.find((p) => String(p.patient_id) === String(selectedPatientId));
  const patientInfo = [
    { label: '성명 (Name)',       value: selectedPatient?.name },
    { label: '환자번호 (Code)',   value: selectedPatient?.patient_code },
    { label: '성별 (Gender)',     value: selectedPatient?.gender },
    { label: '생년월일 (Birth)', value: selectedPatient?.birth_date },
    { label: '수술명 (Surgery)', value: selectedPatient?.surgery_name },
    { label: '수술일 (Date)',     value: selectedPatient?.surgery_date },
    { label: '진행 단계 (Stage)', value: selectedPatient?.current_rehab_phase },
    { label: '재활 시작일',       value: selectedPatient?.rehab_start_date },
  ];
  const romByExercise = buildRomExercises(dailyResult?.exercises ?? []);
  const detailExerciseResults = (dailyResult?.exercises ?? [])
    .filter((exercise) => exercise.is_done)
    .map((exercise) => {
      const values = (exercise.finger_accuracy ?? [])
        .map((item) => item.avg_match_rate)
        .filter((value) => value !== null && value !== undefined);
      const value = values.length
        ? Math.round(values.reduce((sum, current) => sum + Number(current), 0) / values.length)
        : Math.round(exercise.progress_rate ?? 0);
      return {
        name: exercise.exercise_name,
        value,
        warn: value < 70,
      };
    });

  const overallCompliance = dailyResult?.overall_compliance ?? 0;
  const accuracyAvg = dailyResult?.accuracy_average ?? 0;

  const loadReports = () =>
    reportApi.getDoctorReports()
      .then((data) => {
        setReports(data);
        return data;
      })
      .catch(() => []);

  const openReport = (reportId) => {
    if (!reportId) return;
    reportApi.getDoctorReport(reportId)
      .then((data) => {
        setSelectedReport(data);
        setSelectedPatientId(data.patient_id);
        setOpinion(data.edited_content || data.draft_content || data.content || '');
        setEditingOpinion(false);
      })
      .catch(() => setReportMessage('리포트를 불러오지 못했습니다.'));
  };

  useEffect(() => {
    patientApi.listPatients()
      .then((data) => {
        setPatients(data);
        if (!selectedPatientId && data.length > 0) setSelectedPatientId(data[0].patient_id);
      })
      .catch(() => {});
    loadReports();
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    const report = reports.find((r) => String(r.patient_id) === String(selectedPatientId));
    if (report) {
      autoCreatingReportKey.current = null;
      openReport(report.report_id);
      return;
    }

    const today = toKey(new Date());
    const autoKey = `${selectedPatientId}|${today}`;
    if (autoCreatingReportKey.current === autoKey) return;

    autoCreatingReportKey.current = autoKey;
    setReportBusy(true);
    reportApi.createLlmReport({
      patient_id: Number(selectedPatientId),
      report_date: today,
      exercise_blocked: false,
    })
      .then((data) => {
        setSelectedReport(data);
        setOpinion(data.draft_content || data.content || '');
        setEditingOpinion(false);
        setReportMessage('');
        return loadReports();
      })
      .catch((err) => {
        setSelectedReport(null);
        setOpinion(defaultOpinion);
        setReportMessage(err.message);
        autoCreatingReportKey.current = null;
      })
      .finally(() => setReportBusy(false));
  }, [selectedPatientId, reports]);

  useEffect(() => {
    if (!selectedPatientId) return;
    patientApi.getPatientPrescription(selectedPatientId)
      .then((data) => {
        if (!data) return;
        setPrescription(
          (data.exercises ?? []).map((ex) => ({
            name: ex.name,
            sets: ex.sets ?? 1,
            reps: ex.reps ?? 10,
            enabled: true,
          }))
        );
        setSchedule(data.schedule ?? {});
      })
      .catch(() => {});
  }, [selectedPatientId]);

  useEffect(() => {
    if (!selectedPatientId) {
      setDailyResult(null);
      return;
    }
    patientApi.getPatientDailyExerciseResult(selectedPatientId, toKey(new Date()))
      .then((data) => {
        setDailyResult(data);
        setRomExerciseIdx(0);
        setRomFingerIdx(0);
      })
      .catch(() => setDailyResult(null));
  }, [selectedPatientId]);

  useEffect(() => {
    patientApi.getExercises()
      .then(setAllExercises)
      .catch(() => {});
  }, []);

  const updatePrescription = (idx, field, val) =>
    setPrescription((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));

  const toggleEnabled = (idx) =>
    setPrescription((prev) => prev.map((row, i) => (i === idx ? { ...row, enabled: !row.enabled } : row)));

  const removePrescription = (idx) =>
    setPrescription((prev) => prev.filter((_, i) => i !== idx));

  const addExercise = (ex) => {
    setPrescription((prev) => [...prev, { name: ex.name, sets: 3, reps: 10, enabled: true }]);
    setShowAddExercise(false);
  };

  const handleOpinionChange = (val) => setOpinion(val);

  const ensureReport = async () => {
    if (selectedReport) return selectedReport;
    const created = await reportApi.createLlmReport({
      patient_id: Number(selectedPatientId),
      report_date: new Date().toISOString().slice(0, 10),
      exercise_blocked: false,
    });
    setSelectedReport(created);
    return created;
  };

  const handleSave = () => {
    if (!selectedPatientId) { setReportMessage('환자를 먼저 선택해 주세요.'); return; }
    setReportBusy(true);
    ensureReport()
      .then((report) => reportApi.updateDoctorReport(report.report_id, { edited_content: opinion }))
      .then((data) => {
        setSelectedReport(data);
        setJustSaved(true);
        setReportMessage('수정 내용이 DB에 저장되었습니다.');
        setTimeout(() => setJustSaved(false), 2000);
        return loadReports();
      })
      .catch((err) => setReportMessage(err.message))
      .finally(() => setReportBusy(false));
  };

  const handleSend = () => {
    if (!selectedPatientId) { setReportMessage('환자를 먼저 선택해 주세요.'); return; }
    setReportBusy(true);
    ensureReport()
      .then((report) => reportApi.approveDoctorReport(report.report_id, {
        edited_content: opinion,
        rehab_phase: selectedPatient?.current_rehab_phase,
        exercises: prescription,
        schedule,
        prescription_date: new Date().toISOString().slice(0, 10),
      }))
      .then((data) => {
        setSelectedReport(data);
        setOpinion(data.edited_content || data.draft_content || data.content || '');
        setReportMessage('승인 완료: 환자 진료기록 화면에 표시됩니다.');
        return loadReports();
      })
      .catch((err) => setReportMessage(err.message))
      .finally(() => setReportBusy(false));
  };

  /* 환자 정보 셀 border 헬퍼 */
  const cellBorder = (i) => {
    const total = patientInfo.length;
    const isLastRow = i >= total - 2;      // 마지막 2개 (sm 2-col 기준 마지막 행)
    const isLastItem = i === total - 1;    // 마지막 항목
    const isEven = i % 2 === 0;
    return [
      isLastItem ? '' : 'border-b',        // 모바일: 마지막 제외 bottom border
      isLastRow ? 'sm:border-b-0' : '',    // sm+: 마지막 행 bottom 제거
      isEven ? 'sm:border-r' : '',         // sm+: 짝수(왼쪽 열) right border
      'border-outline-variant',
    ].join(' ');
  };

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
            <div className={`w-full aspect-[4/3] bg-gradient-to-br ${lightboxPhoto.gradient} flex items-center justify-center`}>
              <span className="material-symbols-outlined text-white/40 text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>image</span>
            </div>
            <div className="bg-white px-5 py-4 flex items-center justify-between">
              <div>
                <p className="text-title-sm font-bold text-on-surface">{lightboxPhoto.label}</p>
                <p className="text-label-sm text-on-surface-variant mt-0.5">촬영 시각: {lightboxPhoto.time} · 2026년 2월 15일 세션</p>
              </div>
              <div className="flex items-center gap-2">
                {sessionPhotos.map((p) => (
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
                const idx = sessionPhotos.findIndex((p) => p.id === lightboxPhoto.id);
                setLightboxPhoto(sessionPhotos[(idx - 1 + sessionPhotos.length) % sessionPhotos.length]);
              }}
              className="absolute left-3 top-1/3 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-white text-base">chevron_left</span>
            </button>
            <button
              onClick={() => {
                const idx = sessionPhotos.findIndex((p) => p.id === lightboxPhoto.id);
                setLightboxPhoto(sessionPhotos[(idx + 1) % sessionPhotos.length]);
              }}
              className="absolute right-3 top-1/3 -translate-y-1/2 w-9 h-9 bg-black/40 hover:bg-black/60 rounded-full flex items-center justify-center transition-colors"
            >
              <span className="material-symbols-outlined text-white text-base">chevron_right</span>
            </button>
          </div>
        </div>
      )}

      <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* ── 헤더 ── */}
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
              onClick={() => selectedPatientId && navigate(`/doctor/patient/info/${selectedPatientId}`)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-doctor-primary text-doctor-primary font-semibold text-label-sm hover:bg-[#e8f0fe] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              disabled={!selectedPatientId}
            >
              <span className="material-symbols-outlined text-sm">person</span>
              환자 정보
            </button>
            <button
              onClick={() => navigate('/doctor/report/progress', { state: { patientId: selectedPatientId } })}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-doctor-primary text-white font-semibold text-label-sm hover:opacity-90 transition-opacity shadow-sm"
            >
              <span className="material-symbols-outlined text-sm">bar_chart</span>
              누적 리포트
            </button>
          </div>
        </div>

        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-doctor-primary tracking-tight">
            일일 운동 리포트
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            {selectedPatient ? `${selectedPatient.name} 환자` : '환자를 선택해 주세요'} · LLM 리포트
          </p>
        </div>

        {/* ── 환자 정보 ── */}
        <section className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-card">
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {patientInfo.map((item, i) => (
              <div key={i} className={`flex ${cellBorder(i)}`}>
                <div className="w-28 sm:w-36 flex-shrink-0 bg-surface-container-low px-3 sm:px-4 py-3 text-label-sm font-semibold text-on-surface-variant border-r border-outline-variant">
                  {item.label}
                </div>
                <div className="flex-1 min-w-0 px-3 sm:px-4 py-3 text-label-md sm:text-body-md text-on-surface truncate">
                  {item.value ?? '-'}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── AI 분석 + 관찰 기록 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* AI 상세 평가 */}
          <section className="lg:col-span-7 bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                상세 평가 결과 (AI 분석)
              </h2>
              <button
                onClick={() => setShowRomDetail((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-sm font-semibold border transition-colors
                  ${showRomDetail
                    ? 'bg-doctor-primary text-white border-doctor-primary'
                    : 'border-doctor-primary text-doctor-primary hover:bg-[#e8f0fe]'
                  }`}
              >
                <span className="material-symbols-outlined text-sm">straighten</span>
                ROM 상세보기
              </button>
            </div>

            {/* Overall + Accuracy */}
            <div className="flex items-center gap-4 sm:gap-6 p-4 bg-[#f0f6ff] rounded-xl">
              <div className="text-center flex-1">
                <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-wide">Overall Compliance</p>
                <p className="text-[40px] sm:text-[48px] font-bold leading-none text-doctor-primary mt-1">{overallCompliance}.0%</p>
              </div>
              <div className="w-px h-14 bg-outline-variant" />
              <div className="text-center flex-1">
                <p className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-wide">Accuracy Average</p>
                <p className="text-[32px] sm:text-[36px] font-bold leading-none text-[#1a73e8] mt-1">{accuracyAvg}%</p>
              </div>
            </div>

            {/* Exercise breakdown */}
            <div className="space-y-3">
              {detailExerciseResults.length > 0 ? detailExerciseResults.map((ex) => (
                <div key={ex.name} className="flex items-center gap-2 sm:gap-3">
                  <span className="w-24 sm:w-28 text-label-md text-on-surface-variant flex-shrink-0">{ex.name}</span>
                  <div className="flex-1 bg-surface-container h-3 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${ex.value}%`, background: ex.warn ? '#ba1a1a' : '#1a73e8' }}
                    />
                  </div>
                  <span className="w-10 text-right text-label-md font-bold flex-shrink-0" style={{ color: ex.warn ? '#ba1a1a' : '#1a73e8' }}>
                    {ex.value}%
                  </span>
                  {ex.warn
                    ? <span className="material-symbols-outlined text-error text-base flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                    : <span className="w-4 flex-shrink-0" />
                  }
                </div>
              )) : (
                <div className="text-label-md text-on-surface-variant bg-surface-container-low rounded-xl p-4 text-center">
                  오늘 저장된 운동 평가 결과가 없습니다.
                </div>
              )}
            </div>

            {/* ROM 상세 패널 */}
            {showRomDetail && romByExercise.length > 0 && (
              <div className="border border-outline-variant rounded-xl overflow-hidden">
                {/* 운동 카테고리 탭 */}
                <div className="flex overflow-x-auto border-b border-outline-variant">
                  {romByExercise.map((ex, i) => (
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
                  {romByExercise[romExerciseIdx].fingers.map((f, i) => (
                    <button
                      key={f.key}
                      onClick={() => setRomFingerIdx(i)}
                      className={`flex-shrink-0 px-4 py-2 text-label-sm font-semibold transition-colors border-r border-outline-variant last:border-0
                        ${romFingerIdx === i
                          ? 'bg-[#e8f0fe] text-doctor-primary font-bold'
                          : 'bg-surface-container-low text-on-surface-variant hover:bg-[#e8f0fe] hover:text-doctor-primary'
                        }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {/* 관절 데이터 테이블 */}
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#f8fafe] border-b border-outline-variant">
                      <th className="px-4 py-2.5 text-label-sm font-bold text-on-surface-variant text-left">관절</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-on-surface-variant text-center">기준값 (ROM)</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-[#1a73e8] text-center">최댓값</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-[#005bbf] text-center">최솟값</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-on-surface-variant text-center">평균 일치율</th>
                      <th className="px-4 py-2.5 text-label-sm font-bold text-on-surface-variant text-center">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {romByExercise[romExerciseIdx].fingers[romFingerIdx].joints.map((j) => {
                      const warn = j.avg !== null && j.avg !== undefined ? j.avg < 70 : (j.ref && j.max ? j.max < j.ref * 0.85 : false);
                      return (
                        <tr key={j.name} className="border-b border-outline-variant last:border-0 hover:bg-surface-container-lowest transition-colors">
                          <td className="px-4 py-3 text-label-md font-bold text-on-surface">{j.name}</td>
                          <td className="px-4 py-3 text-center text-label-md text-on-surface-variant">{j.ref ?? '—'}{j.ref ? '°' : ''}</td>
                          <td className="px-4 py-3 text-center text-label-md font-bold" style={{ color: warn ? '#ba1a1a' : '#1a73e8' }}>{j.max ?? '—'}{j.max !== null && j.max !== undefined ? '°' : ''}</td>
                          <td className="px-4 py-3 text-center text-label-md font-semibold text-[#005bbf]">{j.min ?? '—'}{j.min !== null && j.min !== undefined ? '°' : ''}</td>
                          <td className="px-4 py-3 text-center text-label-md font-bold" style={{ color: warn ? '#ba1a1a' : '#1a73e8' }}>{j.avg ?? '—'}{j.avg !== null && j.avg !== undefined ? '%' : ''}</td>
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
                  <p className="text-[11px] text-on-surface-variant">기준값: 의사가 입력한 목표 ROM · 최댓값/최솟값/평균 일치율: 금일 세션 측정 결과</p>
                </div>
              </div>
            )}

            {/* 운동 시간 + 통증 */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="flex items-start gap-2 sm:gap-3 p-3 bg-surface-container-low rounded-xl">
                <span className="material-symbols-outlined text-doctor-primary text-xl flex-shrink-0">schedule</span>
                <div>
                  <p className="text-label-sm text-on-surface-variant">운동 시간</p>
                  <p className="text-title-md font-bold text-on-surface">10 분 <span className="text-label-sm font-normal">[Min]</span></p>
                </div>
              </div>
              <div className="flex items-start gap-2 sm:gap-3 p-3 bg-[#fff4f4] border border-[#ffdad6] rounded-xl">
                <span className="material-symbols-outlined text-error text-xl flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
                <div>
                  <p className="text-label-sm text-error font-semibold">통증 부족</p>
                  <p className="text-label-sm text-on-surface-variant mt-0.5">엄지 가벼운 동통</p>
                  <p className="text-label-sm text-on-surface-variant">중지 증등도 부족</p>
                </div>
              </div>
            </div>
          </section>

          {/* 관찰 기록 */}
          <section className="lg:col-span-5 bg-white border border-outline-variant rounded-2xl p-6 shadow-card flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
                치료 중 촬영 사진
              </h2>
              <span className="text-label-sm text-on-surface-variant">{sessionPhotos.length}장</span>
            </div>

            <div className="grid grid-cols-2 gap-3 flex-1">
              {sessionPhotos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => setLightboxPhoto(photo)}
                  className="relative aspect-square rounded-xl overflow-hidden group shadow-sm hover:shadow-md transition-all active:scale-95"
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${photo.gradient}`} />
                  <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover:opacity-20 transition-opacity">
                    <span className="material-symbols-outlined text-white text-5xl" style={{ fontVariationSettings: "'FILL' 1" }}>image</span>
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-2.5 py-1.5 flex items-center justify-between">
                    <span className="text-white text-[11px] font-semibold">{photo.label}</span>
                    <span className="text-white/80 text-[10px]">{photo.time}</span>
                  </div>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="material-symbols-outlined text-white text-base drop-shadow">open_in_full</span>
                  </div>
                </button>
              ))}
            </div>

            <div className="text-label-sm text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">info</span>
              사진을 클릭하면 크게 볼 수 있습니다
            </div>
          </section>
        </div>

        {/* ── 재활 요약 및 주치의 최종 소견 ── */}
        <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_information</span>
              재활 요약 및 주치의 최종 소견
            </h2>
            <button
              onClick={() => setEditingOpinion((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label-sm font-semibold transition-colors ${
                editingOpinion
                  ? 'bg-doctor-primary text-white'
                  : 'border border-doctor-primary text-doctor-primary hover:bg-[#e8f0fe]'
              }`}
            >
              <span className="material-symbols-outlined text-base">{editingOpinion ? 'check' : 'edit'}</span>
              {editingOpinion ? '완료' : '수정'}
            </button>
          </div>

          {editingOpinion ? (
            <textarea
              value={opinion}
              onChange={(e) => handleOpinionChange(e.target.value)}
              rows={8}
              className="w-full px-4 py-3 border border-doctor-primary rounded-xl text-body-md text-on-surface resize-none focus:outline-none focus:ring-2 focus:ring-doctor-primary transition-all"
            />
          ) : (
            <div className="space-y-2 text-body-md text-on-surface leading-relaxed">
              {opinion.split('\n\n').map((line, i) => <p key={i}>{line}</p>)}
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 text-label-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-[#1a73e8] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            LLM이 생성한 소견입니다. 수정 버튼으로 직접 편집할 수 있습니다.
          </div>
        </section>

        {/* ── 다음 재활 처방 ── */}
        <section className="bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>assignment</span>
              다음 재활 치료 처방
            </h2>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-base text-[#1a73e8]">auto_awesome</span>
              <span className="text-label-md text-on-surface font-medium">AI 난이도 조절</span>
              <button
                disabled={prescriptionReadOnly}
                onClick={() => setAiAdjust((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${aiAdjust ? 'bg-doctor-primary' : 'bg-outline-variant'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${aiAdjust ? 'translate-x-[22px]' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* 처방 테이블 */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border border-outline-variant rounded-xl overflow-hidden min-w-[520px]">
              <thead>
                <tr className="bg-[#f0f6ff] border-b border-outline-variant">
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary w-10 text-center">포함</th>
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary">운동 종류</th>
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">세트 수</th>
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">세트당 횟수</th>
                  <th className="px-4 py-3 text-label-sm font-bold text-doctor-primary text-center">예상 시간</th>
                  <th className="px-2 py-3 w-8"></th>
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
                    {/* 체크박스 */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => toggleEnabled(i)}
                        disabled={prescriptionReadOnly}
                        className="flex items-center justify-center mx-auto w-5 h-5 disabled:cursor-not-allowed"
                      >
                        <span
                          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                            row.enabled
                              ? 'bg-doctor-primary border-doctor-primary'
                              : 'bg-white border-outline-variant'
                          }`}
                        >
                          {row.enabled && (
                            <span className="material-symbols-outlined text-white" style={{ fontSize: '14px', fontVariationSettings: "'FILL' 1, 'wght' 700" }}>
                              check
                            </span>
                          )}
                        </span>
                      </button>
                    </td>

                    {/* 운동명 */}
                    <td className="px-4 py-3 text-body-md font-semibold text-on-surface">{row.name}</td>

                    {/* 세트 수 */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min={1} max={10}
                        value={row.sets}
                        disabled={!row.enabled || prescriptionReadOnly}
                        onChange={(e) => updatePrescription(i, 'sets', Number(e.target.value))}
                        className="w-16 text-center border border-outline-variant rounded-lg py-1.5 text-label-md font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* 세트당 횟수 */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        min={1} max={30}
                        value={row.reps}
                        disabled={!row.enabled || prescriptionReadOnly}
                        onChange={(e) => updatePrescription(i, 'reps', Number(e.target.value))}
                        className="w-16 text-center border border-outline-variant rounded-lg py-1.5 text-label-md font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* 예상 시간 */}
                    <td className="px-4 py-3 text-center text-label-md text-on-surface-variant">
                      {row.enabled ? `약 ${row.sets * row.reps * 3}초` : '—'}
                    </td>

                    {/* 삭제 */}
                    <td className="px-2 py-3 text-center">
                      <button
                        onClick={() => removePrescription(i)}
                        disabled={prescriptionReadOnly}
                        className="text-on-surface-variant hover:text-error transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-on-surface-variant"
                        title="운동 삭제"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 운동 추가 */}
          <div className="relative">
            <button
              onClick={() => setShowAddExercise((v) => !v)}
              disabled={!selectedPatientId || prescriptionReadOnly}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl border-2 border-dashed border-doctor-primary text-doctor-primary font-semibold text-label-sm hover:bg-[#e8f0fe] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-base">add</span>
              운동 추가
            </button>

            {showAddExercise && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowAddExercise(false)} />
              <div className="absolute left-0 top-full mt-1 z-20 bg-white border border-outline-variant rounded-xl shadow-lg min-w-[240px] max-h-64 overflow-y-auto">
                {allExercises
                  .filter((ex) => !prescription.some((p) => p.name === ex.name))
                  .map((ex) => (
                    <button
                      key={ex.exercise_id}
                      onClick={() => addExercise(ex)}
                      className="w-full text-left px-4 py-2.5 text-body-md text-on-surface hover:bg-[#e8f0fe] transition-colors border-b border-outline-variant last:border-0"
                    >
                      {ex.name}
                    </button>
                  ))}
                {allExercises.filter((ex) => !prescription.some((p) => p.name === ex.name)).length === 0 && (
                  <p className="px-4 py-3 text-label-sm text-on-surface-variant">추가 가능한 운동이 없습니다.</p>
                )}
              </div>
              </>
            )}
          </div>

          <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5 pt-1">
            <span className="material-symbols-outlined text-sm">info</span>
            오늘 이후 날짜의 처방 일정만 수정할 수 있습니다.
          </p>

          {/* 처방 일정 설정 */}
          <div className="border-t border-outline-variant pt-4 space-y-1">
            <h3 className="text-label-md font-bold text-on-surface-variant uppercase tracking-wider flex items-center gap-2">
              <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_month</span>
              처방 일정 설정
            </h3>
          </div>
          <PrescriptionSchedule
            prescription={prescription}
            schedule={schedule}
            setSchedule={setSchedule}
            readOnly={prescriptionReadOnly}
            minEditableDate={prescriptionMinEditableDate}
          />
        </section>

        {/* ── 저장 / 발송 ── */}
        <div className="flex justify-end gap-3 pb-4">
          <button
            onClick={handleSave}
            disabled={!selectedPatientId || reportBusy}
            className={`flex items-center gap-2 px-6 sm:px-8 py-3 border-2 font-semibold rounded-xl transition-all text-label-md
              ${selectedPatientId && !reportBusy
                ? 'border-doctor-primary text-doctor-primary hover:bg-[#e8f0fe] active:scale-95'
                : 'border-outline-variant text-on-surface-variant cursor-not-allowed opacity-50'
              }`}
          >
            {justSaved ? (
              <>
                <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                DB 저장 완료
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-base">save</span>
                수정 저장
              </>
            )}
          </button>
          <button
            onClick={handleSend}
            disabled={!selectedPatientId || reportBusy}
            className="flex items-center gap-2 px-6 sm:px-8 py-3 bg-doctor-primary text-white font-semibold rounded-xl hover:opacity-90 active:scale-95 transition-all shadow-md text-label-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-base">send</span>
            승인
          </button>
        </div>

      </main>
    </div>
  );
}
