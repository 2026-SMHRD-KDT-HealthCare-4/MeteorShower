import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';

const allPatients = [
  { id: 'F310957194583', name: '김망나뇽', gender: '남', birth: '1999.01.21', phone: '010-0000-0000' },
  { id: 'F310957194584', name: '이피카츄', gender: '여', birth: '1995.05.12', phone: '010-1234-5678' },
  { id: 'F310957194585', name: '박파이리', gender: '남', birth: '1988.11.02', phone: '010-9999-8888' },
  { id: 'F310957194586', name: '최꼬부기', gender: '남', birth: '2001.03.30', phone: '010-1111-2222' },
  { id: 'F310957194587', name: '강뮤츠', gender: '여', birth: '1990.07.15', phone: '010-3333-4444' },
  { id: 'F310957194588', name: '윤리자몽', gender: '여', birth: '1993.09.22', phone: '010-5555-6666' },
  { id: 'F310957194589', name: '정이상해씨', gender: '남', birth: '1992.08.15', phone: '010-5555-4444' },
];

const waitingPatients = [
  { id: 'F310957194583', name: '김망나뇽', gender: '남', birth: '1999.01.21', phone: '010-0000-0000', urgent: true },
  { id: 'F310957194589', name: '정이상해씨', gender: '남', birth: '1992.08.15', phone: '010-5555-4444', urgent: false },
  { id: 'F310957194590', name: '김이브', gender: '여', birth: '1997.12.24', phone: '010-7777-6666', urgent: false },
];

const prescribedPatients = [
  { id: 'F310957194583', name: '김망나뇽', gender: '남', birth: '1999.01.21', phone: '010-0000-0000', exercises: 12, status: 'Completed' },
  { id: 'F310957194595', name: '한라프라스', gender: '여', birth: '1985.04.10', phone: '010-8888-9999', exercises: 8, status: 'In Progress' },
];

function PatientCard({ patient, selected, onSelect, accent = 'primary', showUrgent = false, showExercises = false }) {
  const colors = {
    primary: 'border-doctor-primary',
    secondary: 'border-secondary',
    tertiary: 'border-tertiary',
  };

  return (
    <div
      onClick={() => onSelect(patient.id)}
      className={`bg-surface-container-lowest p-4 rounded-xl border shadow-sm cursor-pointer transition-all hover:shadow-md
        ${selected ? `border-2 ${colors[accent]}` : 'border border-outline-variant hover:border-doctor-primary'}
      `}
    >
      <div className="flex justify-between items-start mb-2">
        <span className={`text-title-md font-bold ${selected ? 'text-doctor-primary' : 'text-on-surface'}`}>{patient.name}</span>
        {selected && <span className="text-label-sm px-2 py-1 bg-blue-100 text-blue-700 rounded font-semibold">Selected</span>}
        {showUrgent && patient.urgent && (
          <span className="text-label-sm px-2 py-1 bg-error-container text-on-error-container rounded flex items-center gap-1 font-semibold">
            <span className="material-symbols-outlined text-sm">priority_high</span>Urgency
          </span>
        )}
        {showExercises && (
          <span className="text-label-sm px-2 py-1 bg-surface-container-high text-on-surface-variant rounded font-semibold">{patient.status}</span>
        )}
      </div>
      <div className="space-y-0.5 text-on-surface-variant text-label-md">
        <p className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">id_card</span>{patient.id}</p>
        <p className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">person</span>{patient.gender} / {patient.birth}</p>
        <p className="flex items-center gap-2"><span className="material-symbols-outlined text-sm">call</span>{patient.phone}</p>
        {showExercises && (
          <p className="flex items-center gap-1 text-doctor-primary font-semibold mt-1">
            <span className="material-symbols-outlined text-sm">fitness_center</span>{patient.exercises} Exercises assigned
          </p>
        )}
      </div>
    </div>
  );
}

export default function DoctorPatientList() {
  const [selectedPatient, setSelectedPatient] = useState('F310957194583');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const selectedInfo = allPatients.find((p) => p.id === selectedPatient);

  const filtered = allPatients.filter(
    (p) =>
      p.name.includes(search) ||
      p.id.includes(search) ||
      p.phone.includes(search)
  );

  return (
    <div className="min-h-screen" style={{ background: '#fbf9f8' }}>
      <DoctorNavBar />

      <main
        className="max-w-[1280px] mx-auto px-4 md:px-10 py-8 space-y-6 flex flex-col"
        style={{ minHeight: 'calc(100vh - 64px)' }}
      >
        {/* Search + Register */}
        <section className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="relative w-full md:max-w-xl">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-12 py-4 bg-white border border-outline-variant rounded-2xl focus:outline-none focus:ring-2 focus:ring-doctor-primary transition-all text-body-md shadow-sm"
              placeholder="Search patients by name or ID..."
              type="text"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="material-symbols-outlined absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-error transition-colors"
              >
                cancel
              </button>
            )}
          </div>
          <button
            className="text-white px-6 py-3 rounded-xl text-label-md font-semibold flex items-center gap-2 shadow-md hover:opacity-90 transition-opacity"
            style={{ background: '#1a73e8' }}
          >
            <span className="material-symbols-outlined">person_add</span>
            Register Patient
          </button>
        </section>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
          {/* All Patients */}
          <section className="space-y-4 flex flex-col">
            <div className="flex items-center gap-3 px-2">
              <span className="material-symbols-outlined text-doctor-primary text-3xl">groups</span>
              <h2 className="text-title-md font-bold text-on-surface">전체 환자</h2>
              <span className="ml-auto bg-surface-container-high text-on-surface-variant px-2.5 py-0.5 rounded-full text-label-sm font-semibold">
                {allPatients.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
              {filtered.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  selected={selectedPatient === p.id}
                  onSelect={setSelectedPatient}
                  accent="primary"
                />
              ))}
            </div>
          </section>

          {/* Waiting */}
          <section className="space-y-4 flex flex-col">
            <div className="flex items-center gap-3 px-2">
              <span className="material-symbols-outlined text-secondary text-3xl">hourglass_empty</span>
              <h2 className="text-title-md font-bold text-on-surface">처방 대기 환자</h2>
              <span className="ml-auto bg-secondary-fixed text-on-secondary-fixed-variant px-2.5 py-0.5 rounded-full text-label-sm font-semibold">
                {waitingPatients.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
              {waitingPatients.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  selected={false}
                  onSelect={() => {}}
                  accent="secondary"
                  showUrgent
                />
              ))}
            </div>
          </section>

          {/* Weekly Prescribed */}
          <section className="space-y-4 flex flex-col">
            <div className="flex items-center gap-3 px-2">
              <span className="material-symbols-outlined text-tertiary text-3xl">task_alt</span>
              <h2 className="text-title-md font-bold text-on-surface">이번 주 처방 현황</h2>
              <span className="ml-auto bg-tertiary-fixed text-on-tertiary-fixed-variant px-2.5 py-0.5 rounded-full text-label-sm font-semibold">
                {prescribedPatients.length}
              </span>
            </div>
            <div className="space-y-3 flex-1 overflow-y-auto max-h-[500px] pr-1">
              {prescribedPatients.map((p) => (
                <PatientCard
                  key={p.id}
                  patient={p}
                  selected={false}
                  onSelect={() => {}}
                  accent="tertiary"
                  showExercises
                />
              ))}
            </div>
          </section>
        </div>

        {/* Selected Patient Actions */}
        {selectedInfo && (
          <section className="bg-white border border-outline-variant rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary-fixed rounded-xl flex items-center justify-center">
                <span className="material-symbols-outlined text-doctor-primary text-2xl">person</span>
              </div>
              <div>
                <p className="text-label-sm text-on-surface-variant">선택된 환자</p>
                <p className="text-title-md font-bold text-on-surface">{selectedInfo.name}</p>
                <p className="text-label-sm text-on-surface-variant">{selectedInfo.id}</p>
              </div>
            </div>
            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => navigate('/doctor/patient/info')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-doctor-primary text-white font-semibold text-label-md hover:opacity-90 transition-opacity shadow-md"
              >
                <span className="material-symbols-outlined text-sm">person</span>
                환자 정보
              </button>
              <button
                onClick={() => navigate('/doctor/report/daily')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-doctor-primary text-doctor-primary font-semibold text-label-md hover:bg-doctor-primary hover:text-white transition-all"
              >
                <span className="material-symbols-outlined text-sm">today</span>
                일일 리포트
              </button>
              <button
                onClick={() => navigate('/doctor/report/progress')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl border-2 border-doctor-primary text-doctor-primary font-semibold text-label-md hover:bg-doctor-primary hover:text-white transition-all"
              >
                <span className="material-symbols-outlined text-sm">bar_chart</span>
                누적 리포트
              </button>
            </div>
          </section>
        )}
      </main>

      <div
        className="fixed top-0 right-0 -z-10 w-1/3 h-1/3 blur-[120px] rounded-full pointer-events-none"
        style={{ background: 'rgba(26,115,232,0.05)' }}
      />
      <div
        className="fixed bottom-0 left-0 -z-10 w-1/4 h-1/4 blur-[100px] rounded-full pointer-events-none"
        style={{ background: 'rgba(72,88,171,0.05)' }}
      />
    </div>
  );
}