import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../../assets/logo.png';
import Footer from '../../components/Footer';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';

const PHONE_RE = /^\d{2,3}-\d{3,4}-\d{4}$/;

function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.startsWith('02')) {
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

export default function SocialSignup() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const socialData = JSON.parse(sessionStorage.getItem('socialSignup') ?? 'null');

  useEffect(() => {
    if (!socialData) navigate('/patient/login', { replace: true });
  }, []);

  const [name, setName]   = useState(socialData?.name ?? '');
  const [birth, setBirth] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const errors = {};
  if (!name)  errors.name  = '이름을 입력하세요';
  if (!birth) errors.birth = '생년월일을 입력하세요';
  if (!gender) errors.gender = '성별을 선택하세요';
  if (!phone)  errors.phone  = '전화번호를 입력하세요';
  else if (!PHONE_RE.test(phone)) errors.phone = '전화번호 형식: 010-0000-0000';

  const show = (f) => (touched[f] || submitAttempted) && errors[f];
  const blur = (f) => setTouched((p) => ({ ...p, [f]: true }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setError('');
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    authApi.socialSignup({
      signup_token: socialData.signup_token,
      name,
      birth_date: birth,
      gender,
      phone,
    })
      .then(({ token, name: resName }) => {
        sessionStorage.removeItem('socialSignup');
        login({ name: resName, role: 'patient' }, token, true);
        navigate('/patient/exercise', { replace: true });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  const PROVIDER_LABEL = { kakao: '카카오', google: '구글', naver: '네이버' };

  if (!socialData) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-container-padding-mobile md:px-margin-desktop">
        <Link to="/">
          <img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" />
        </Link>
      </header>

      <main className="flex-grow flex items-center justify-center px-margin-mobile py-24">
        <div className="w-full max-w-[420px] bg-surface-container-lowest rounded-xl p-8 md:p-10 shadow-card">
          <div className="text-center mb-8">
            <img src={logo} alt="Fine Rehabilitation" className="h-16 w-auto mx-auto mb-4" />
            <h1 className="font-display text-headline-md text-on-surface mb-1">추가 정보 입력</h1>
            <p className="text-body-sm text-on-surface-variant">
              {PROVIDER_LABEL[socialData.social_platform]} 계정으로 첫 로그인입니다.<br />
              아래 정보를 입력해 회원가입을 완료해 주세요.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 이름 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1">이름</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => blur('name')}
                placeholder="이름을 입력하세요"
                className={`w-full h-14 px-4 rounded-xl border bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md ${show('name') ? 'border-red-400' : 'border-outline-variant'}`}
              />
              {show('name') && <p className="text-label-sm text-red-500 ml-1">{errors.name}</p>}
            </div>

            {/* 생년월일 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1">생년월일</label>
              <input
                type="date"
                value={birth}
                onChange={(e) => setBirth(e.target.value)}
                onBlur={() => blur('birth')}
                className={`w-full h-14 px-4 rounded-xl border bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md ${show('birth') ? 'border-red-400' : 'border-outline-variant'}`}
              />
              {show('birth') && <p className="text-label-sm text-red-500 ml-1">{errors.birth}</p>}
            </div>

            {/* 성별 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1">성별</label>
              <div className="flex gap-3">
                {['남', '여'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setGender(g)}
                    className={`flex-1 h-14 rounded-xl border text-body-md font-medium transition-all ${
                      gender === g
                        ? 'bg-primary-container text-white border-primary-container'
                        : 'border-outline-variant text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
              {show('gender') && <p className="text-label-sm text-red-500 ml-1">{errors.gender}</p>}
            </div>

            {/* 전화번호 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1">전화번호</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                onBlur={() => blur('phone')}
                placeholder="010-0000-0000"
                className={`w-full h-14 px-4 rounded-xl border bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md ${show('phone') ? 'border-red-400' : 'border-outline-variant'}`}
              />
              {show('phone') && <p className="text-label-sm text-red-500 ml-1">{errors.phone}</p>}
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <span className="material-symbols-outlined text-red-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                <p className="text-label-md text-red-600">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary-container text-white font-semibold text-label-lg rounded-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md"
            >
              {loading ? (
                <>
                  <span className="material-symbols-outlined animate-spin">progress_activity</span>
                  처리 중...
                </>
              ) : '가입 완료'}
            </button>
          </form>
        </div>
      </main>

      <Footer />

      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] bg-primary-fixed/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] bg-secondary-fixed/20 blur-[100px] rounded-full" />
      </div>
    </div>
  );
}
