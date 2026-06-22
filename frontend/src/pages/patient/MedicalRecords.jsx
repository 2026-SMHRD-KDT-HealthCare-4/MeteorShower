import { useEffect, useState } from 'react';
import PatientNavBar from '../../components/PatientNavBar';
import { useAuth } from '../../context/AuthContext';
import { reportApi } from '../../api';

const fallbackRecords = [
  {
    id: 1,
    date: '2026.03.28',
    doctor: '김나연 원장',
    specialty: '재활의학과 전문의',
    status: '진료 완료',
    statusColor: 'bg-primary-fixed text-on-primary-fixed',
    feedback: '"손가락 움직임과 악력이 전반적으로 향상되어 매우 긍정적이에요. 특히 엄지와 검지의 협응력이 눈에 띄게 좋아졌습니다. 지속적인 스트레칭과 강화 운동을 통해 더 안정적인 기능 회복을 기대할 수 있어요. 꾸준히 잘 따라오고 계십니다! 👍"',
    exercises: [
      { name: '오른손 두드리기', sets: 2, reps: 5, achievement: 85, icon: 'back_hand', badgeColor: 'bg-surface-container-high text-primary' },
      { name: '오른손 쥐었다펴기', sets: 3, reps: 5, achievement: 100, icon: 'adjust', badgeColor: 'bg-secondary-fixed text-on-secondary-fixed' },
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
    feedback: '손가락 가동성과 근력이 전반적으로 향상되고 있어요. 특히 쥐는 동작이 훨씬 안정적으로 개선되었으며, 손가락 각 마디의 독립적인 움직임도 눈에 띄게 좋아졌습니다. 태핑 훈련을 통해 반응 속도와 리듬감이 개선되고 있고, 그립 강화 운동으로 일상적인 쥐기 동작에서의 안정성도 높아졌습니다. 앞으로도 꾸준히 운동 루틴을 유지해 주시면 더욱 빠른 기능 회복을 기대할 수 있습니다.',
    exercises: [
      { name: '왼손 두드리기', sets: 2, reps: 5, achievement: 75, icon: 'pan_tool_alt', badgeColor: 'bg-surface-container-high text-primary' },
      { name: '왼손 쥐었다펴기', sets: 3, reps: 10, achievement: 68, icon: 'back_hand', badgeColor: 'bg-surface-container-high text-primary' },
    ],
    featured: false,
  },
  {
    id: 3,
    date: '2026.03.22',
    doctor: '김나연 원장',
    specialty: '재활의학과 전문의',
    status: '처방 대기',
    statusColor: 'bg-tertiary-fixed text-on-tertiary-fixed',
    feedback: '처방 대기 중',
    exercises: [{ name: '오른손 쥐었다펴기 / 3세트 / 5회', icon: 'brightness_7', achievement: 60 }],
    featured: false,
  },
];

function formatRecordDate(dateStr) {
  if (!dateStr) return '';
  return dateStr.replace(/-/g, '.');
}

function mapReportToRecord(report, index) {
  const exercises = (report.exercises ?? []).map((exercise) => ({
    name: exercise.name,
    sets: exercise.sets,
    reps: exercise.reps,
    achievement: exercise.achievement ?? null,
    icon: 'fitness_center',
    badgeColor: 'bg-surface-container-high text-primary',
  }));

  return {
    id: report.report_id,
    date: formatRecordDate(report.report_date),
    doctor: report.doctor_name ? `${report.doctor_name} 의사` : '담당 의사',
    specialty: '재활의학과',
    status: '진료 완료',
    statusColor: index === 0 ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container-high text-on-surface-variant',
    feedback: report.content ?? report.edited_content ?? '',
    exercises: exercises.length > 0
      ? exercises
      : [{
          name: 'LLM 재활 리포트',
          sets: null,
          reps: null,
          achievement: null,
          icon: 'description',
          badgeColor: 'bg-surface-container-high text-primary',
        }],
    featured: index === 0,
  };
}

function SmallRecordCard({ record }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-card p-6 transition-all duration-200">
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
      <p className={`text-sm text-on-surface-variant mb-6 ${expanded ? '' : 'line-clamp-2'}`}>{record.feedback}</p>
      <div className="border-t border-outline-variant pt-4 space-y-2">
        {(expanded ? record.exercises : record.exercises.slice(0, 1)).map((ex, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-xl">{ex.icon}</span>
              <div>
                <span className="text-sm text-on-surface">{ex.name}</span>
                {expanded && ex.sets && <p className="text-[12px] text-on-surface-variant">{ex.sets}세트 / {ex.reps}회</p>}
              </div>
            </div>
            {ex.achievement != null && (
              <span className="text-label-sm font-semibold text-primary">{ex.achievement}%</span>
            )}
          </div>
        ))}
        {!expanded && record.exercises.length > 1 && (
          <p className="text-[11px] text-on-surface-variant pl-2">외 {record.exercises.length - 1}개 운동</p>
        )}
        <div className="pt-2 text-right">
          <button
            className="text-primary text-label-sm font-semibold hover:underline flex items-center gap-1 ml-auto"
            onClick={() => setExpanded(!expanded)}
          >
            상세 보기
            <span className={`material-symbols-outlined text-base transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>expand_more</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MedicalRecords() {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    reportApi.getPatientReports()
      .then(async (items) => {
        if (!items.length) {
          setRecords([]);
          return;
        }
        const details = await Promise.all(items.map((item) => reportApi.getPatientReport(item.report_id)));
        setRecords(details.map(mapReportToRecord));
      })
      .catch((err) => setLoadError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <PatientNavBar />

      <main className="pt-12 pb-stack-lg px-container-padding-mobile md:px-container-padding-desktop max-w-[1280px] mx-auto">
        {/* Greeting */}
        <section className="mb-12 text-center">
          <h1 className="text-headline-lg md:text-display-lg font-display font-bold text-primary mb-2">
            {user?.name ?? ''}님, 안녕하세요!
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
            지금까지의 재활과 처방 기록을 확인하고, 회복 과정을 함께 점검해요. 💪
          </p>
        </section>

        {/* Records */}
        <section className="space-y-6 max-w-4xl mx-auto">
          {loading && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-card p-6 text-center text-on-surface-variant">
              진료 기록을 불러오는 중입니다.
            </div>
          )}
          {loadError && (
            <div className="bg-error-container rounded-2xl border border-outline-variant shadow-card p-6 text-center text-on-error-container font-semibold">
              {loadError}
            </div>
          )}
          {/* 기록 없음 */}
          {!loading && !loadError && records.length === 0 && (
            <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-card p-12 text-center">
              <span className="material-symbols-outlined text-outline text-5xl mb-4 block">folder_open</span>
              <p className="text-label-md font-semibold text-on-surface">아직 진료 기록이 없습니다</p>
              <p className="text-label-sm text-on-surface-variant mt-1">의사가 리포트를 승인하면 이곳에 표시됩니다.</p>
            </div>
          )}

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
                  </div>
                  <div className="space-y-3">
                    {record.exercises.map((ex, i) => (
                      <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-outline-variant">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-lg bg-primary/5 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">{ex.icon}</span>
                          </div>
                          <div>
                            <p className="text-label-md font-medium text-on-surface">{ex.name}</p>
                            {ex.sets && <p className="text-[12px] text-on-surface-variant">{ex.sets}세트 / {ex.reps}회</p>}
                          </div>
                        </div>
                        {ex.achievement != null && (
                          <span className={`px-3 py-1 ${ex.badgeColor} rounded-lg text-label-sm font-semibold`}>목표 달성 {ex.achievement}%</span>
                        )}
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
              <SmallRecordCard key={record.id} record={record} />
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
