import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';
import { doctorApi } from '../../api';

const PHONE_RE = /^\d{2,3}-\d{3,4}-\d{4}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function formatPhone(value) {
  const d = value.replace(/\D/g, '');
  if (d.startsWith('02')) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return `${d.slice(0,2)}-${d.slice(2)}`;
    if (d.length <= 9) return `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
    return `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6,10)}`;
  }
  const s = d.slice(0, 11);
  if (s.length <= 3) return s;
  if (s.length <= 7) return `${s.slice(0,3)}-${s.slice(3)}`;
  return `${s.slice(0,3)}-${s.slice(3,7)}-${s.slice(7)}`;
}

export default function DoctorProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [email, setEmail]     = useState('');
  const [phone, setPhone]     = useState('');
  const [errors, setErrors]   = useState({});
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    doctorApi.getMyProfile().then((data) => {
      setProfile(data);
      setEmail(data.email ?? '');
      setPhone(data.phone ?? '');
    }).catch(() => {});
  }, []);

  const isDirty =
    profile &&
    (email !== (profile.email ?? '') || phone !== (profile.phone ?? ''));

  const validate = () => {
    const next = {};
    if (!EMAIL_RE.test(email)) next.email = '올바른 이메일 형식을 입력해 주세요';
    if (!PHONE_RE.test(phone)) next.phone = '전화번호를 끝까지 입력하세요';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!validate()) return;
    doctorApi.updateMyProfile({ email, phone })
      .then((data) => {
        setProfile(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      })
      .catch(() => {});
  };

  const readOnlyFields = [
    { label: '아이디', value: profile?.login_id ?? '' },
    { label: '이름',   value: profile?.name ?? '' },
    { label: '소속',   value: profile?.hospital_name ?? '' },
  ];

  const roCls = 'w-full px-4 py-2.5 border border-outline-variant rounded-xl text-body-md text-on-surface bg-surface-container cursor-not-allowed';
  const editCls = 'w-full px-4 py-2.5 border border-outline-variant rounded-xl text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-doctor-primary transition-all placeholder:text-outline';
  const errCls = 'w-full px-4 py-2.5 border border-error rounded-xl text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-error transition-all';

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavBar />

      <main className="max-w-2xl mx-auto px-4 md:px-0 py-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-on-surface-variant hover:text-doctor-primary transition-colors mb-6"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-label-md font-medium">돌아가기</span>
        </button>

        <div className="bg-white border border-outline-variant rounded-2xl shadow-card overflow-hidden">
          <div className="px-8 pt-8 pb-6 border-b border-outline-variant">
            <h1 className="text-headline-lg-mobile font-display font-bold text-doctor-primary">프로필 설정</h1>
            <p className="text-body-md text-on-surface-variant mt-1">
              Fine 서비스를 위한 사용자 정보를 관리하세요.
            </p>
          </div>

          <form onSubmit={handleSave} className="px-8 py-6 space-y-4">
            {/* 읽기 전용 */}
            {readOnlyFields.map((f) => (
              <div key={f.label} className="flex items-center gap-4">
                <label className="w-28 flex-shrink-0 text-label-md font-semibold text-on-surface-variant text-right">{f.label}</label>
                <input type="text" value={f.value} readOnly className={roCls} />
              </div>
            ))}

            {/* 이메일 */}
            <div className="flex items-start gap-4">
              <label className="w-28 flex-shrink-0 text-label-md font-semibold text-on-surface-variant text-right pt-2.5">이메일</label>
              <div className="flex-1">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors((p) => ({ ...p, email: undefined })); }}
                  placeholder="이메일을 입력하세요"
                  className={errors.email ? errCls : editCls}
                />
                {errors.email && <p className="text-[11px] text-error mt-1">{errors.email}</p>}
              </div>
            </div>

            {/* 전화번호 */}
            <div className="flex items-start gap-4">
              <label className="w-28 flex-shrink-0 text-label-md font-semibold text-on-surface-variant text-right pt-2.5">전화번호</label>
              <div className="flex-1">
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => { setPhone(formatPhone(e.target.value)); if (errors.phone) setErrors((p) => ({ ...p, phone: undefined })); }}
                  placeholder="010-0000-0000"
                  maxLength={13}
                  className={errors.phone ? errCls : editCls}
                />
                {errors.phone && <p className="text-[11px] text-error mt-1">{errors.phone}</p>}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={!isDirty}
                className={`px-8 py-2.5 rounded-xl text-label-md font-semibold transition-all shadow-md
                  ${isDirty ? 'bg-doctor-primary text-white hover:opacity-90' : 'bg-surface-container text-on-surface-variant cursor-not-allowed'}`}
              >
                {saved ? '저장 완료' : '저장'}
              </button>
            </div>
          </form>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-card flex items-start gap-3">
            <div className="w-9 h-9 bg-[#e8f0fe] rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-doctor-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            </div>
            <div>
              <p className="text-label-md font-bold text-on-surface">보안 설정</p>
              <p className="text-label-sm text-on-surface-variant mt-0.5">마지막 업데이트 약 22일 전</p>
            </div>
          </div>
          <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-card flex items-start gap-3">
            <div className="w-9 h-9 bg-[#e8f0fe] rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[#1a73e8] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div>
              <p className="text-label-md font-bold text-on-surface">인증 상태</p>
              <p className="text-label-sm text-on-surface-variant mt-0.5">전문의 인증이 완료되었습니다.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
