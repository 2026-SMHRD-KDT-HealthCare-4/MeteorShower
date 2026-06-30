import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { patientApi } from '../../api';
import { useAuth } from '../../context/AuthContext';

function InfoRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-2.5 border-b border-outline-variant last:border-0">
      <span className="text-label-md text-on-surface-variant">{label}</span>
      <span className="text-label-md font-semibold text-on-surface text-right">{value}</span>
    </div>
  );
}

export default function PatientApproval() {
  const navigate = useNavigate();
  const { user, login, token } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    patientApi.getMyProfile()
      .then(setProfile)
      .catch(() => setError('정보를 불러오지 못했습니다.'))
      .finally(() => setLoading(false));
  }, []);

  const handleApprove = () => {
    setApproving(true);
    setError('');
    patientApi.approveMyRegistration()
      .then(() => {
        login({ ...user, approval_status: '승인' }, token);
        navigate('/patient/exercise', { replace: true });
      })
      .catch(() => {
        setError('승인 처리 중 오류가 발생했습니다. 다시 시도해 주세요.');
        setApproving(false);
      });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ backgroundImage: "url('/patient-bg-pattern.svg')", backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }}>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-6 md:px-10">
        <img src="/logo.png" alt="Fine Rehabilitation" className="h-10 w-auto" />
      </header>

      <main className="flex-grow flex items-center justify-center px-4 py-24">
        <div className="w-full max-w-lg bg-surface-container-lowest rounded-2xl p-8 shadow-card">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-primary-fixed rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-primary-container text-3xl">assignment_ind</span>
            </div>
            <h1 className="text-headline-sm font-bold text-on-surface mb-2">등록 정보 확인</h1>
            <p className="text-body-md text-on-surface-variant">
              담당 의사가 등록한 내 정보를 확인하고 동의해 주세요.
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <span className="material-symbols-outlined animate-spin text-primary-container text-3xl">progress_activity</span>
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 mb-4">
                  <span className="material-symbols-outlined text-red-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                  <p className="text-label-md text-red-600">{error}</p>
                </div>
              )}

              {profile && (
                <>
                  <div className="bg-surface-container rounded-xl px-4 py-2 mb-3">
                    <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider py-2">기본 정보</p>
                    <InfoRow label="이름"     value={profile.name} />
                    <InfoRow label="생년월일" value={profile.birth_date} />
                    <InfoRow label="성별"     value={profile.gender} />
                    <InfoRow label="연락처"   value={profile.phone} />
                  </div>

                  <div className="bg-surface-container rounded-xl px-4 py-2 mb-6">
                    <p className="text-label-sm font-bold text-on-surface-variant uppercase tracking-wider py-2">진료 정보</p>
                    <InfoRow label="병원"        value={profile.hospital_name} />
                    <InfoRow label="수술명"      value={profile.surgery_name} />
                    <InfoRow label="수술 부위"   value={profile.surgery_area} />
                    <InfoRow label="수술일"      value={profile.surgery_date} />
                    <InfoRow label="재활 시작일" value={profile.rehab_start_date} />
                    <InfoRow label="재활 단계"   value={profile.current_rehab_phase} />
                    <InfoRow label="담당 의사"   value={profile.doctor_name} />
                  </div>

                  <p className="text-label-sm text-on-surface-variant text-center mb-4">
                    위 정보가 본인의 정보와 일치하는 경우 동의 버튼을 눌러 주세요.
                  </p>

                  <button
                    onClick={handleApprove}
                    disabled={approving}
                    className="w-full h-14 bg-primary-container text-white font-semibold text-label-lg rounded-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-60"
                  >
                    {approving ? (
                      <>
                        <span className="material-symbols-outlined animate-spin">progress_activity</span>
                        처리 중...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">check_circle</span>
                        정보 확인 및 동의
                      </>
                    )}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
