import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import logo from '../../assets/logo.png';
import { useAuth } from '../../context/AuthContext';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [loginError, setLoginError] = useState('');

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
    // TODO: 아래 setTimeout 블록을 실제 API 호출로 교체
    // api.post('/auth/doctor/login', { username: id, password })
    //   .then(({ token, name, hospital }) => {
    //     login({ name, hospital, role: 'doctor' }, token);
    //     navigate('/doctor/patients');
    //   })
    //   .catch((err) => setLoginError(err.message))
    //   .finally(() => setLoading(false));
    setTimeout(() => {
      setLoading(false);
      if (id === 'doctor' && password === 'doctor123!') {
        login({ name: '김나연', hospital: '00병원', role: 'doctor' }, 'dummy-doctor-token');
        navigate('/doctor/patients');
      } else {
        setLoginError('아이디 또는 비밀번호가 올바르지 않습니다.');
      }
    }, 1000);
  };

  const inputBorder = (field) =>
    show(field) ? { borderColor: '#ef4444' } : { borderColor: '#c1c6d6' };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fbf9f8' }}>
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-margin-mobile md:px-margin-desktop">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <Link to="/">
            <img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" />
          </Link>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center px-margin-mobile pt-24 pb-12 gap-8">
        <div className="w-full max-w-[420px] bg-white rounded-xl p-8 md:p-10 shadow-card transition-all duration-300">
          <div className="text-center mb-10">
            <img src={logo} alt="Fine Rehabilitation" className="h-20 w-auto mx-auto mb-5" />
            <h1 className="font-display text-headline-xl mb-2" style={{ color: '#1b1c1c' }}>의료진 로그인</h1>
            <p className="text-body-md" style={{ color: '#414754' }}>의료진 전용 포털</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 아이디 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="doc-username">아이디</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>person</span>
                <input
                  id="doc-username"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={id}
                  onChange={(e) => { setId(e.target.value); setLoginError(''); }}
                  onBlur={() => handleBlur('id')}
                  className="w-full h-14 pl-12 pr-4 rounded-xl border bg-white focus:ring-2 focus:ring-blue-600 transition-all outline-none text-body-md"
                  style={inputBorder('id')}
                />
              </div>
              {show('id') && (
                <p className="text-label-sm text-red-500 ml-1">{errors.id}</p>
              )}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="doc-password">비밀번호</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>lock</span>
                <input
                  id="doc-password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
                  onBlur={() => handleBlur('password')}
                  className="w-full h-14 pl-12 pr-12 rounded-xl border bg-white focus:ring-2 focus:ring-blue-600 transition-all outline-none text-body-md"
                  style={inputBorder('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#727785' }}
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
                <input type="checkbox" className="w-6 h-6 rounded-lg" style={{ accentColor: '#005bbf' }} />
                <span className="text-label-md text-on-surface-variant">로그인 상태 유지</span>
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
              className="w-full h-14 text-white font-semibold text-label-lg rounded-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md"
              style={{ background: '#1a73e8' }}
            >
              {loading ? (
                <><span className="material-symbols-outlined animate-spin">progress_activity</span>처리 중...</>
              ) : (
                <>로그인<span className="material-symbols-outlined">login</span></>
              )}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-outline-variant text-center space-y-4">
            <p className="text-label-md text-on-surface-variant">
              아이디가 없으신가요?{' '}
              <Link to="/doctor/signup" className="text-[#1a73e8] font-bold hover:underline ml-1">의사 회원가입</Link>
            </p>
            <p className="text-label-md text-on-surface-variant">
              환자이신가요?{' '}
              <Link to="/patient/login" className="text-primary-container font-bold hover:underline ml-1">환자 로그인</Link>
            </p>
          </div>
        </div>

        {/* Info alert */}
        <div className="w-full max-w-[420px] p-4 rounded-xl flex gap-3 items-start border" style={{ background: '#d8e2ff4d', borderColor: '#d8e2ff' }}>
          <span className="material-symbols-outlined" style={{ color: '#005bbf', fontVariationSettings: "'FILL' 1" }}>info</span>
          <p className="text-label-md leading-relaxed" style={{ color: '#004493' }}>
            인증된 의료진만 접근 가능합니다. 승인되지 않은 접근 시도는 모니터링되며 기록됩니다.
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
