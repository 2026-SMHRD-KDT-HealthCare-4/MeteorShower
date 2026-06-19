import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';

export default function PatientLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [remember, setRemember] = useState(false);

  const errors = {};
  if (!id) errors.id = '아이디를 입력하세요';
  if (!password) errors.password = '비밀번호를 입력하세요';

  const show = (field) => (touched[field] || submitAttempted) && errors[field];
  const handleBlur = (field) => setTouched((p) => ({ ...p, [field]: true }));

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setLoginError('');
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    authApi.patientLogin(id, password)
      .then(({ token, name }) => {
        login({ name, role: 'patient' }, token, remember);
        navigate('/patient/exercise', { replace: true });
      })
      .catch((err) => setLoginError(err.message))
      .finally(() => setLoading(false));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-container-padding-mobile md:px-margin-desktop">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <Link to="/">
            <img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" />
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex items-center justify-center px-margin-mobile py-24">
        <div className="w-full max-w-[420px] bg-surface-container-lowest rounded-xl p-8 md:p-10 shadow-card transition-all duration-300">
          {/* Brand */}
          <div className="text-center mb-10">
            <img src={logo} alt="Fine Rehabilitation" className="h-20 w-auto mx-auto mb-5" />
            <h1 className="font-display text-headline-xl text-on-surface mb-2">환자 로그인</h1>
            <p className="text-body-md text-on-surface-variant">손 재활의 새로운 시작, 피네와 함께하세요.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 아이디 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="username">아이디</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">person</span>
                <input
                  id="username"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={id}
                  onChange={(e) => { setId(e.target.value); setLoginError(''); }}
                  onBlur={() => handleBlur('id')}
                  className={`w-full h-14 pl-12 pr-4 rounded-xl border bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md ${show('id') ? 'border-red-400' : 'border-outline-variant'}`}
                />
              </div>
              {show('id') && (
                <p className="text-label-sm text-red-500 ml-1">{errors.id}</p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="password">비밀번호</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">lock</span>
                <input
                  id="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
                  onBlur={() => handleBlur('password')}
                  className={`w-full h-14 pl-12 pr-12 rounded-xl border bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md ${show('password') ? 'border-red-400' : 'border-outline-variant'}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {show('password') && (
                <p className="text-label-sm text-red-500 ml-1">{errors.password}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-6 h-6 rounded-lg border-outline-variant accent-primary-container" />
                <span className="text-label-md text-on-surface-variant group-hover:text-on-surface transition-colors">로그인 상태 유지</span>
              </label>
            </div>

            {/* 로그인 오류 메시지 */}
            {loginError && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200">
                <span className="material-symbols-outlined text-red-500 text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
                <p className="text-label-md text-red-600">{loginError}</p>
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
              ) : (
                <>
                  로그인
                  <span className="material-symbols-outlined">login</span>
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center my-8">
            <div className="flex-grow border-t border-outline-variant" />
            <span className="flex-shrink mx-4 text-on-surface-variant text-label-sm">또는 소셜 계정으로 로그인</span>
            <div className="flex-grow border-t border-outline-variant" />
          </div>

          {/* Social */}
          <div className="flex justify-center gap-4">
            <button title="Google 로그인" className="w-12 h-12 rounded-full border border-outline-variant flex items-center justify-center bg-white hover:bg-surface-container transition-colors active:scale-95">
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 6.57l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
            <button title="Naver 로그인" className="w-12 h-12 rounded-full flex items-center justify-center bg-[#03C75A] hover:brightness-95 transition-all active:scale-95">
              <span className="text-white font-black text-lg">N</span>
            </button>
            <button title="Kakao 로그인" className="w-12 h-12 rounded-full flex items-center justify-center bg-[#FEE500] hover:brightness-95 transition-all active:scale-95">
              <span className="text-[#3C1E1E] font-black text-lg">K</span>
            </button>
          </div>

          {/* Footer links */}
          <div className="mt-8 pt-8 border-t border-outline-variant text-center space-y-4">
            <p className="text-label-md text-on-surface-variant">
              계정이 없으신가요?{' '}
              <Link to="/patient/signup" className="text-primary-container font-bold hover:underline ml-1">회원가입</Link>
            </p>
            <p className="text-label-md text-on-surface-variant">
              의료진이신가요?{' '}
              <Link to="/doctor/login" className="text-[#1a73e8] font-bold hover:underline ml-1">의료진 로그인</Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />

      {/* Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-[10%] right-[5%] w-[400px] h-[400px] bg-primary-fixed/20 blur-[100px] rounded-full" />
        <div className="absolute bottom-[10%] left-[5%] w-[300px] h-[300px] bg-secondary-fixed/20 blur-[100px] rounded-full" />
      </div>
    </div>
  );
}
