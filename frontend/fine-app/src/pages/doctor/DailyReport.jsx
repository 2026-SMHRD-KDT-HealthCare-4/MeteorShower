import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';

/* ── 더미 데이터 ── */
const patientInfo = [
  { label: '성명 (Name)',       value: '김망나뇽' },
  { label: '환자번호 (Code)',   value: 'F310957194583' },
  { label: '성별 (Gender)',     value: '남자' },
  { label: '생년월일 (Birth)', value: '1960.01.02' },
  { label: '수술명 (Surgery)', value: '손가락 골절 수술' },
  { label: '수술일 (Date)',     value: '2026.01.01' },
  { label: '진행 단계 (Stage)', value: '손가락 굽히기 운동' },
  { label: '재활 시작일',       value: '2026.01.25' },
];

const exerciseResults = [
  { name: '엄지 (Thumb)',  value: 75, warn: false },
  { name: '검지 (Index)',  value: 82, warn: false },
  { name: '중지 (Middle)', value: 90, warn: false },
  { name: '약지 (Ring)',   value: 68, warn: true  },
  { name: '소지 (Pinky)', value: 75, warn: false },
];

const defaultPrescription = [
  { name: '태핑 (Tapping)',   sets: 3, reps: 10, enabled: true },
  { name: '굴곡 (Flexion)',   sets: 3, reps: 10, enabled: true },
  { name: '신전 (Extension)', sets: 2, reps: 8,  enabled: true },
  { name: '그립 (Grip)',      sets: 2, reps: 10, enabled: true },
];

const defaultOpinion =
  `• 약지(Ring finger)의 운동 정확도가 60% 이상 다른 손가락에 비해 낮습니다. 금일은 동작 시 손가락 힘이 많이 빠져 이에 대한 집중적인 케어가 필요합니다.\n\n` +
  `• 부종 관련: 장시 이상의 가벼운 동통이 엄지에서 초기 몇 분에 정상적으로 나타납니다. 우측 손 날카로운 동통이 느껴진다면 즉시 중단하시오.\n\n` +
  `• 세션 전환: 운동 후 이번 주 이내에 다음 운동으로 전환하는 것이 좋습니다. 만약 15분간 날카로운 통증이 지속될 경우 다음을 수료하시오.\n\n` +
  `• 향상 권고: 본격 치료 관련으로 손가락 관절에 대한 가벼운 스트레칭을 병행하며 유연성을 확보하시오.`;

/* ── 컴포넌트 ── */
export default function DailyReport() {
  const navigate = useNavigate();

  const [opinion, setOpinion]               = useState(defaultOpinion);
  const [editingOpinion, setEditingOpinion] = useState(false);
  const [prescription, setPrescription]     = useState(defaultPrescription);
  const [aiAdjust, setAiAdjust]             = useState(true);

  const overallCompliance = Math.round(
    exerciseResults.reduce((s, e) => s + e.value, 0) / exerciseResults.length
  );
  const accuracyAvg = 77.0;

  const updatePrescription = (idx, field, val) =>
    setPrescription((prev) => prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row)));

  const toggleEnabled = (idx) =>
    setPrescription((prev) => prev.map((row, i) => (i === idx ? { ...row, enabled: !row.enabled } : row)));

  const removeRow = (idx) =>
    setPrescription((prev) => prev.filter((_, i) => i !== idx));

  const handleSave = () => alert('저장되었습니다.');
  const handleSend = () => alert('발송되었습니다.');

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

      <main className="max-w-[1100px] mx-auto px-4 md:px-8 py-8 space-y-6">

        {/* ── 헤더 ── */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-on-surface-variant hover:text-doctor-primary transition-colors"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span className="text-label-md font-medium">Back to Dashboard</span>
          </button>
          <p className="text-label-sm text-on-surface-variant">Issue Date: 2026.02.15</p>
        </div>

        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-doctor-primary tracking-tight">
            일일 운동 레포트
          </h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            김망나뇽 환자 · 2026년 2월 15일 세션
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
                  {item.value}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── AI 분석 + 관찰 기록 ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* AI 상세 평가 */}
          <section className="lg:col-span-7 bg-white border border-outline-variant rounded-2xl p-6 shadow-card space-y-5">
            <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
              상세 평가 결과 (AI 분석)
            </h2>

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
              {exerciseResults.map((ex) => (
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
              ))}
            </div>

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
            <h2 className="text-title-md font-bold text-doctor-primary flex items-center gap-2">
              <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>photo_camera</span>
              관찰 기록
            </h2>
            <div className="grid grid-cols-2 gap-3 flex-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="aspect-square bg-surface-container rounded-xl border-2 border-dashed border-outline-variant flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-doctor-primary hover:bg-[#f0f6ff] transition-all group"
                >
                  <span className="material-symbols-outlined text-outline group-hover:text-doctor-primary text-3xl transition-colors">add_photo_alternate</span>
                  <span className="text-label-sm text-outline group-hover:text-doctor-primary text-center transition-colors">Add Photo</span>
                </div>
              ))}
            </div>
            <div>
              <label className="text-label-sm text-on-surface-variant font-semibold">캡션 (Caption)</label>
              <textarea
                rows={2}
                placeholder="사진에 대한 설명을 입력하세요..."
                className="w-full mt-1 px-3 py-2 border border-outline-variant rounded-xl text-label-md text-on-surface resize-none focus:outline-none focus:ring-2 focus:ring-doctor-primary transition-all placeholder:text-outline"
              />
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
              onChange={(e) => setOpinion(e.target.value)}
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
                onClick={() => setAiAdjust((v) => !v)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${aiAdjust ? 'bg-doctor-primary' : 'bg-outline-variant'}`}
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
                  <th className="px-4 py-3 w-10" />
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
                        className="flex items-center justify-center mx-auto w-5 h-5"
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
                        disabled={!row.enabled}
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
                        disabled={!row.enabled}
                        onChange={(e) => updatePrescription(i, 'reps', Number(e.target.value))}
                        className="w-16 text-center border border-outline-variant rounded-lg py-1.5 text-label-md font-semibold text-on-surface focus:outline-none focus:ring-2 focus:ring-doctor-primary disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </td>

                    {/* 예상 시간 */}
                    <td className="px-4 py-3 text-center text-label-md text-on-surface-variant">
                      {row.enabled ? `약 ${row.sets * row.reps * 3}초` : '—'}
                    </td>

                    {/* 삭제 */}
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeRow(i)}
                        className="text-outline hover:text-error transition-colors"
                        title="운동 제거"
                      >
                        <span className="material-symbols-outlined text-base">close</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 체크박스 안내 + 운동 추가 */}
          <div className="flex items-center justify-between pt-1">
            <p className="text-label-sm text-on-surface-variant flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm">info</span>
              체크 해제 시 해당 운동은 처방에서 제외됩니다. × 버튼으로 완전 삭제 가능합니다.
            </p>
            <button
              onClick={() => setPrescription((prev) => [...prev, { name: '새 운동 (New)', sets: 3, reps: 10, enabled: true }])}
              className="flex items-center gap-1.5 text-label-md text-doctor-primary hover:text-[#1a73e8] transition-colors flex-shrink-0"
            >
              <span className="material-symbols-outlined text-base">add_circle</span>
              운동 추가
            </button>
          </div>
        </section>

        {/* ── 저장 / 발송 ── */}
        <div className="flex justify-end gap-3 pb-4">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-6 sm:px-8 py-3 border-2 border-doctor-primary text-doctor-primary font-semibold rounded-xl hover:bg-[#e8f0fe] transition-colors text-label-md"
          >
            <span className="material-symbols-outlined text-base">save</span>
            저장 (Save)
          </button>
          <button
            onClick={handleSend}
            className="flex items-center gap-2 px-6 sm:px-8 py-3 bg-doctor-primary text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-md text-label-md"
          >
            <span className="material-symbols-outlined text-base">send</span>
            발송 (Send)
          </button>
        </div>

      </main>
    </div>
  );
}