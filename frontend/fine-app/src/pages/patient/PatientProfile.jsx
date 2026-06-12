import { useState } from 'react';
import PatientNavBar from '../../components/PatientNavBar';

const personalInfo = [
  { label: 'ID', value: 'F310957194583', editable: false },
  { label: '성별', value: '남', editable: false },
  { label: '연락처', value: '010-0000-0000', editable: true },
  { label: '생년월일', value: '1985.05.20', editable: false },
  { label: '수술명', value: '수근관 증후군 유리술', editable: false },
  { label: '수술 부위', value: '오른쪽 손목', editable: false },
  { label: '수술 시기', value: '2021.12.15', editable: false },
  { label: '재활 시작', value: '2021.12.28', editable: false },
  { label: '보호자 메일', value: 'gksnf21@gmail.com', editable: true },
];

const calendarDays = {
  padding: [27, 28, 29, 30, 31],
  completed: [3, 10, 13],
  scheduled: [16, 17, 20, 21, 23, 24, 26, 27, 30, 31],
  normal: [1, 2, 4, 5, 6, 7, 8, 9, 11, 12, 14, 15, 18, 19, 22, 25, 28, 29],
};

export default function PatientProfile() {
  const [guardianConsent, setGuardianConsent] = useState(true);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <PatientNavBar />

      <main className="max-w-7xl mx-auto px-container-padding-mobile md:px-container-padding-desktop py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left: Personal Info */}
          <section className="lg:col-span-5 flex flex-col gap-8">
            <h1 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-on-surface">개인 정보</h1>

            <div className="bg-surface-container-lowest rounded-xl shadow-card p-6 space-y-4 border border-outline-variant flex-grow">
              {personalInfo.map((info) => (
                <div
                  key={info.label}
                  className={`flex items-center rounded-lg px-4 py-3 bg-surface-bright transition-all
                    ${info.editable ? 'border-2 border-primary shadow-sm' : 'border border-outline-variant'}
                  `}
                >
                  <span className={`w-24 text-label-md font-semibold border-r mr-4 ${info.editable ? 'text-primary border-primary/30' : 'text-on-surface-variant border-outline-variant/50'}`}>
                    {info.label}
                  </span>
                  <span className="text-body-md text-on-surface flex-grow">{info.value}</span>
                  {info.editable && (
                    <button className="material-symbols-outlined text-primary hover:scale-110 transition-transform">edit</button>
                  )}
                </div>
              ))}

              {/* Guardian consent */}
              <label className="flex items-center gap-3 pt-4 cursor-pointer select-none">
                <div className="relative flex items-center">
                  <input
                    type="checkbox"
                    checked={guardianConsent}
                    onChange={(e) => setGuardianConsent(e.target.checked)}
                    className="h-6 w-6 rounded-lg border-2 border-outline appearance-none cursor-pointer checked:bg-primary checked:border-primary focus:outline-none transition-all"
                  />
                  {guardianConsent && (
                    <span className="material-symbols-outlined absolute text-white pointer-events-none scale-75 left-0" style={{ fontVariationSettings: "'wght' 700" }}>check</span>
                  )}
                </div>
                <span className="text-body-md text-on-surface">보호자 재활 보고서 수신 동의</span>
              </label>
            </div>
          </section>

          {/* Right: Schedule & Hospital */}
          <section className="lg:col-span-7 flex flex-col gap-12">
            {/* Calendar */}
            <div className="space-y-6">
              <h2 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-on-surface">운동 예정일</h2>
              <div className="bg-surface-container-lowest rounded-xl shadow-card p-8 border border-outline-variant">
                <div className="flex items-center justify-between mb-8">
                  <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-high p-2 rounded-full transition-colors">chevron_left</button>
                  <h3 className="text-label-md font-bold text-on-surface-variant tracking-widest uppercase font-display">January 2022</h3>
                  <button className="material-symbols-outlined text-on-surface-variant hover:bg-surface-container-high p-2 rounded-full transition-colors">chevron_right</button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 text-center text-label-sm font-semibold text-outline mb-4">
                  {['M', 'T', 'W', 'Th', 'F', 'S', 'Su'].map((d) => (
                    <div key={d}>{d}</div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-y-2">
                  {calendarDays.padding.map((d) => (
                    <div key={`pad-${d}`} className="h-12 flex items-center justify-center text-surface-variant text-label-md">{d}</div>
                  ))}
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => {
                    const isCompleted = calendarDays.completed.includes(d);
                    const isScheduled = calendarDays.scheduled.includes(d);
                    return (
                      <div key={d} className="h-12 flex items-center justify-center relative">
                        {isCompleted && (
                          <div className="absolute inset-0 m-auto w-10 h-10 bg-inverse-surface text-inverse-on-surface rounded-full flex items-center justify-center shadow-sm text-label-md">
                            {d}
                          </div>
                        )}
                        {isScheduled && (
                          <div className="absolute inset-0 m-auto w-10 h-10 bg-surface-dim rounded-full flex items-center justify-center text-on-surface-variant text-label-md">
                            {d}
                          </div>
                        )}
                        {!isCompleted && !isScheduled && (
                          <span className="text-label-md text-on-surface">{d}</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div className="flex gap-6 mt-8 pt-6 border-t border-outline-variant/30 text-label-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-inverse-surface" />
                    <span className="text-on-surface-variant">운동 수행 완료</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-surface-dim" />
                    <span className="text-on-surface-variant">운동 예정일</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Hospital Info */}
            <div className="space-y-6">
              <h2 className="text-headline-lg-mobile md:text-headline-lg font-display font-bold text-on-surface">병원 정보</h2>
              <div className="bg-surface-container-lowest rounded-xl shadow-card p-6 space-y-4 border border-outline-variant">
                {[
                  { label: '병원명', value: '김망나뇽병원' },
                  { label: '주치의', value: '김나연' },
                ].map((item) => (
                  <div key={item.label} className="flex items-center border border-outline-variant rounded-lg px-4 py-4 bg-surface-bright hover:border-primary transition-colors cursor-pointer group">
                    <span className="w-24 text-label-md font-semibold text-on-surface-variant border-r border-outline-variant/50 mr-4">{item.label}</span>
                    <span className="text-body-md text-on-surface flex-grow font-bold">{item.value}</span>
                    <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">edit</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
