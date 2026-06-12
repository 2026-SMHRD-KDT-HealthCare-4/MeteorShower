import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import logo from '../../assets/logo.png';

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/doctor/patients');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fbf9f8' }}>
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-margin-mobile md:px-margin-desktop">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <Link to="/">
            <img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" />
          </Link>
          <div className="flex gap-4">
            <button className="text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors px-3 py-1 rounded-lg text-body-md">Language</button>
            <button className="text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors px-3 py-1 rounded-lg text-body-md">Support</button>
          </div>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center justify-center px-margin-mobile pt-24 pb-12 gap-8">
        <div className="w-full max-w-[420px] bg-white rounded-xl p-8 md:p-10 shadow-card transition-all duration-300">
          <div className="text-center mb-10">
            <img src={logo} alt="Fine Rehabilitation" className="h-20 w-auto mx-auto mb-5" />
            <h1 className="font-display text-headline-xl mb-2" style={{ color: '#1b1c1c' }}>의료진 로그인</h1>
            <p className="text-body-md" style={{ color: '#414754' }}>의료진 전용 포털</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="doc-username">아이디</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>person</span>
                <input
                  id="doc-username"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  className="w-full h-14 pl-12 pr-4 rounded-xl border bg-white focus:ring-2 focus:ring-blue-600 transition-all outline-none text-body-md"
                  style={{ borderColor: '#c1c6d6' }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="doc-password">비밀번호</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>lock</span>
                <input
                  id="doc-password"
                  type="password"
                  placeholder="••••••••"
                  className="w-full h-14 pl-12 pr-4 rounded-xl border bg-white focus:ring-2 focus:ring-blue-600 transition-all outline-none text-body-md"
                  style={{ borderColor: '#c1c6d6' }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" className="w-6 h-6 rounded-lg" style={{ accentColor: '#005bbf' }} />
                <span className="text-label-md text-on-surface-variant">로그인 상태 유지</span>
              </label>
              <a href="#" className="text-label-md hover:underline" style={{ color: '#005bbf' }}>비밀번호 찾기</a>
            </div>

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

          <div className="mt-8 pt-8 border-t text-center" style={{ borderColor: '#c1c6d6' }}>
            <p className="text-label-md text-on-surface-variant">
              접근 권한이 없으신가요?{' '}
              <a href="#" className="font-bold hover:underline" style={{ color: '#005bbf' }}>관리자 문의</a>
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

        <p className="text-label-md text-on-surface-variant">
          환자이신가요?{' '}
          <Link to="/patient/login" className="text-primary-container font-bold hover:underline">환자 로그인</Link>
        </p>
      </main>

      <Footer />
    </div>
  );
}
