import PatientNavBar from '../../components/PatientNavBar';

const records = [
  {
    id: 1,
    date: '2026.03.28',
    doctor: '김나연 원장',
    specialty: '재활의학과 전문의',
    status: '진료 완료',
    statusColor: 'bg-primary-fixed text-on-primary-fixed',
    feedback: '"손가락 움직임과 악력이 전반적으로 향상되어 매우 긍정적이에요. 특히 엄지와 검지의 협응력이 눈에 띄게 좋아졌습니다. 지속적인 스트레칭과 강화 운동을 통해 더 안정적인 기능 회복을 기대할 수 있어요. 꾸준히 잘 따라오고 계십니다! 👍"',
    exercises: [
      { name: '태핑 (Tapping)', sets: 2, reps: 5, achievement: 85, icon: 'back_hand', badgeColor: 'bg-surface-container-high text-primary' },
      { name: '그립 강화', sets: 3, reps: 5, achievement: 100, icon: 'adjust', badgeColor: 'bg-secondary-fixed text-on-secondary-fixed' },
    ],
    featured: true,
  },
  {
    id: 2,
    date: '2026.03.25',
    doctor: '김나연 원장',
    specialty: '재활의학과 전문의',
    status: '진료 완료',
    statusColor: 'bg-surface-container-high text-on-surface-variant',
    feedback: '손가락 가동성과 근력이 향상되고 있어요. 특히 쥐는 동작이 훨씬 안정적으로 개선되었습니다...',
    exercises: [{ name: '태핑 / 2세트 / 5회', icon: 'pan_tool_alt' }],
    featured: false,
  },
  {
    id: 3,
    date: '2026.03.22',
    doctor: '김나연 원장',
    specialty: '재활의학과 전문의',
    status: '처방 갱신',
    statusColor: 'bg-tertiary-fixed text-on-tertiary-fixed',
    feedback: '전반적인 회복 흐름이 좋아요. 지금 단계에서 강도 조절이 중요해요. 무리하지 않고 천천히 진행해요.',
    exercises: [{ name: '그립 강화 / 3세트 / 5회', icon: 'brightness_7' }],
    featured: false,
  },
];

export default function MedicalRecords() {
  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <PatientNavBar />

      <main className="pt-12 pb-stack-lg px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
        {/* Greeting */}
        <section className="mb-12 text-center">
          <h1 className="text-headline-lg md:text-display-lg font-display font-bold text-primary mb-2">
            김망나뇽님, 안녕하세요!
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
            지금까지의 재활과 처방 기록을 확인하고, 회복 과정을 함께 점검해요. 💪
          </p>
        </section>

        {/* Records */}
        <section className="space-y-6 max-w-4xl mx-auto">
          {/* Featured record */}
          {records.filter((r) => r.featured).map((record) => (
            <div key={record.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-card overflow-hidden">
              <div className="p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>calendar_today</span>
                    <h2 className="text-title-md font-bold text-on-surface">{record.date}</h2>
                    <span className={`px-3 py-1 ${record.statusColor} rounded-full text-label-sm font-semibold`}>{record.status}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary-fixed flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary-container">person</span>
                    </div>
                    <div>
                      <p className="text-label-md font-semibold text-on-surface">{record.doctor}</p>
                      <p className="text-[12px] text-on-surface-variant">{record.specialty}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-surface-container-low p-6 rounded-xl mb-6">
                  <p className="text-body-md text-on-surface leading-relaxed">{record.feedback}</p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-label-md font-semibold text-primary uppercase tracking-wider">처방 운동</h4>
                    <button className="text-primary text-label-sm font-semibold hover:underline">전체 기록 상세 보기</button>
                  </div>
                  <div className="space-y-3">
                    {record.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant hover:border-primary/50 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                            <span className="material-symbols-outlined">{ex.icon}</span>
                          </div>
                          <div>
                            <p className="text-label-md font-medium text-on-surface">{ex.name}</p>
                            {ex.sets && <p className="text-[12px] text-on-surface-variant">{ex.sets}세트 / {ex.reps}회</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {ex.achievement && (
                            <span className={`px-3 py-1 ${ex.badgeColor} rounded-lg text-label-sm font-semibold`}>목표 달성 {ex.achievement}%</span>
                          )}
                          <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {/* Other records */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {records.filter((r) => !r.featured).map((record) => (
              <div key={record.id} className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-card p-6 hover:-translate-y-1 hover:shadow-card-hover transition-all duration-200 cursor-pointer">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-outline text-xl">calendar_today</span>
                    <span className="text-label-md font-medium text-on-surface">{record.date}</span>
                  </div>
                  <span className={`px-2 py-0.5 ${record.statusColor} rounded text-[11px] font-bold`}>{record.status}</span>
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center">
                    <span className="material-symbols-outlined text-primary-container text-sm">person</span>
                  </div>
                  <div className="text-sm">
                    <p className="font-bold text-on-surface">{record.doctor}</p>
                    <p className="text-on-surface-variant">{record.specialty}</p>
                  </div>
                </div>
                <p className="text-sm text-on-surface-variant line-clamp-3 mb-6">{record.feedback}</p>
                <div className="border-t border-outline-variant pt-4 space-y-2">
                  {record.exercises.map((ex, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-low transition-all">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-primary text-xl">{ex.icon}</span>
                        <span className="text-sm text-on-surface">{ex.name}</span>
                      </div>
                      <span className="material-symbols-outlined text-on-surface-variant text-lg">chevron_right</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          <div className="flex justify-center pt-8">
            <button className="flex items-center gap-2 px-8 py-3 rounded-full border-2 border-primary text-primary font-bold hover:bg-primary hover:text-white transition-all duration-300 active:scale-95 group">
              더 많은 기록 불러오기
              <span className="material-symbols-outlined group-hover:translate-y-1 transition-transform">expand_more</span>
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
