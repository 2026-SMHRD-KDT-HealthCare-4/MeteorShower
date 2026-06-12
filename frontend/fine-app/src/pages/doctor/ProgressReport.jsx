import DoctorNavBar from '../../components/DoctorNavBar';
import { useNavigate } from 'react-router-dom';

const patientInfo = [
  { label: '성명 (Name)', value: '김망나뇽' },
  { label: '환자번호 (Code)', value: 'F310957194583' },
  { label: '성별 (Gender)', value: '남자' },
  { label: '생년월일 (Birth)', value: '1960.01.02' },
  { label: '수술명 (Surgery)', value: '손가락 골절 수술', span: true },
  { label: '수술일 (Date)', value: '2026.01.01' },
  { label: '진행 단계 (Stage)', value: '손가락 굽히기 운동', span: true },
  { label: '재활 시작일', value: '2026.01.25' },
];

const exercises = [
  {
    name: '손가락 굽히기 운동 (Finger Flexion)',
    sets: 3,
    reps: 10,
    week1: 72,
    week2: 80,
    week3: 88,
    week4: 91,
    trend: 'up',
    icon: 'back_hand',
  },
  {
    name: '손가락 펴기 운동 (Finger Extension)',
    sets: 3,
    reps: 10,
    week1: 65,
    week2: 70,
    week3: 78,
    week4: 84,
    trend: 'up',
    icon: 'pan_tool',
  },
  {
    name: '엄지 맞닿기 운동 (Thumb Opposition)',
    sets: 2,
    reps: 8,
    week1: 60,
    week2: 65,
    week3: 72,
    week4: 79,
    trend: 'up',
    icon: 'front_hand',
  },
];

export default function ProgressReport() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-surface-dim">
      <DoctorNavBar />

      {/* Action bar */}
      <div className="no-print w-full max-w-[794px] mx-auto px-4 mt-6 mb-4 flex justify-between items-center">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-on-surface-variant hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-label-md font-medium">Back to Dashboard</span>
        </button>
        <button
          onClick={() => window.print()}
          className="bg-primary text-on-primary px-6 py-2 rounded-full text-label-md font-semibold flex items-center gap-2 hover:opacity-90 transition-opacity"
        >
          <span className="material-symbols-outlined">print</span>
          Print Report
        </button>
      </div>

      {/* A4 Report */}
      <main className="max-w-[794px] mx-auto px-4 pb-12">
        <div className="bg-surface-container-lowest border border-outline-variant shadow-2xl rounded-xl p-10 flex flex-col gap-8">
          {/* Report Header */}
          <header className="flex justify-between items-start pb-8 border-b border-outline-variant">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-4xl" style={{ fontVariationSettings: "'FILL' 1" }}>medical_services</span>
                <span className="text-headline-lg font-display font-bold text-primary tracking-tight">Fine</span>
              </div>
              <p className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-widest">Hand Therapy Service</p>
            </div>
            <div className="text-right">
              <h1 className="text-headline-lg font-display font-bold text-on-surface mb-1">재활 진행 리포트</h1>
              <p className="text-label-md text-on-surface-variant">Rehabilitation Progress Report</p>
              <div className="mt-3 py-1 px-3 bg-surface-container rounded text-label-sm inline-block">
                Issue Date: 2026.02.15
              </div>
            </div>
          </header>

          {/* Patient Info Grid */}
          <section>
            <h2 className="text-title-md font-bold text-on-surface mb-4">환자 정보</h2>
            <div className="grid grid-cols-4 border border-outline-variant rounded-xl overflow-hidden">
              {patientInfo.map((info, i) => (
                <>
                  <div key={`label-${i}`} className="bg-surface-container-low p-4 text-label-md font-semibold text-on-surface-variant border-r border-b border-outline-variant">
                    {info.label}
                  </div>
                  <div key={`value-${i}`} className={`p-4 text-body-md text-on-surface border-b border-outline-variant ${info.span ? 'col-span-1' : ''} ${i % 2 === 1 ? '' : 'border-r border-outline-variant'}`}>
                    {info.value}
                  </div>
                </>
              ))}
            </div>
          </section>

          {/* Exercise Progress */}
          <section>
            <h2 className="text-title-md font-bold text-on-surface mb-4">운동별 진행 현황</h2>
            <div className="space-y-4">
              {exercises.map((ex) => (
                <div key={ex.name} className="border border-outline-variant rounded-xl p-5">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-primary-fixed rounded-lg flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary-container">{ex.icon}</span>
                    </div>
                    <div>
                      <h3 className="text-label-md font-bold text-on-surface">{ex.name}</h3>
                      <p className="text-label-sm text-on-surface-variant">{ex.sets}세트 × {ex.reps}회</p>
                    </div>
                    <div className="ml-auto flex items-center gap-1 text-primary font-semibold text-label-md">
                      <span className="material-symbols-outlined text-sm">trending_up</span>
                      +{ex.week4 - ex.week1}%
                    </div>
                  </div>

                  {/* Weekly bars */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: '1주차', value: ex.week1 },
                      { label: '2주차', value: ex.week2 },
                      { label: '3주차', value: ex.week3 },
                      { label: '4주차', value: ex.week4 },
                    ].map((week) => (
                      <div key={week.label} className="text-center">
                        <div className="h-24 bg-surface-container rounded-lg overflow-hidden flex items-end mb-1">
                          <div
                            className="w-full bg-primary rounded-t-md transition-all duration-700"
                            style={{ height: `${week.value}%` }}
                          />
                        </div>
                        <p className="text-label-sm text-on-surface-variant">{week.label}</p>
                        <p className="text-label-sm font-bold text-primary">{week.value}%</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Overall Assessment */}
          <section className="bg-surface-container-low rounded-xl p-6">
            <h2 className="text-title-md font-bold text-on-surface mb-3">종합 평가 (Overall Assessment)</h2>
            <p className="text-body-md text-on-surface leading-relaxed">
              환자 김망나뇽님은 재활 4주차에 걸쳐 모든 운동 항목에서 꾸준한 향상을 보이고 있습니다. 특히 손가락 굽히기 운동에서 초기 대비 19%의 일치율 향상이 관찰되었으며, 전반적인 회복 경과가 매우 긍정적입니다. 다음 단계로 진행하기 위한 준비가 충분히 된 것으로 평가됩니다.
            </p>
          </section>

          {/* Signature */}
          <footer className="flex justify-between items-end pt-8 border-t border-outline-variant">
            <div>
              <p className="text-label-sm text-on-surface-variant mb-1">담당 의료진</p>
              <p className="text-body-md font-bold text-on-surface">김나연 원장 (재활의학과 전문의)</p>
              <p className="text-label-sm text-on-surface-variant">김망나뇽병원</p>
            </div>
            <div className="text-right">
              <div className="w-32 h-16 border-b-2 border-outline mb-1" />
              <p className="text-label-sm text-on-surface-variant">서명 (Signature)</p>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
