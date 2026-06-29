import { Link } from 'react-router-dom';
import Footer from '../components/Footer';

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface-container-low">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-container-padding-mobile md:px-margin-desktop">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <img src="/logo.png" alt="Fine Rehabilitation" className="h-12 w-auto" />
        </div>
      </header>

      {/* Main */}
      <main className="flex-grow flex flex-col items-center justify-center px-4 pt-24 pb-16">
        {/* Title */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Fine Rehabilitation" className="h-30 w-auto mx-auto mb-6" />
          <h1 className="text-headline-lg md:text-headline-lg font-display font-bold text-on-surface mb-3">
            저희는 손 재활 보조 도우미&nbsp; "
            <span className="text-[#39C5A8]">피네(Fine)</span>
            "&nbsp; 입니다.
          </h1>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          {/* 환자 카드 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-card p-8 flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl bg-primary-fixed flex items-center justify-center">
                <span className="material-symbols-outlined text-primary-container text-3xl">accessibility_new</span>
              </div>
              <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center">
                <span className="material-symbols-outlined text-outline text-2xl">person</span>
              </div>
            </div>

            <div>
              <h2 className="text-headline-lg-mobile font-display font-bold text-on-surface mb-2">
                환자(Patient)
              </h2>
              <p className="text-body-md text-on-surface-variant leading-relaxed">
                개인 맞춤형 재활 운동 계획을 확인하고 진행 상황을 모니터링하세요.
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-auto">
              <Link
                to="/patient/login"
                className="w-full h-12 bg-primary-container text-white font-semibold text-label-lg rounded-xl flex items-center justify-center hover:brightness-110 active:scale-[0.98] transition-all shadow-md"
              >
                환자 로그인
              </Link>
              <Link
                to="/patient/signup"
                className="w-full h-12 border-2 border-primary-container text-primary-container font-semibold text-label-lg rounded-xl flex items-center justify-center hover:bg-primary-fixed transition-all"
              >
                환자 회원가입
              </Link>
            </div>

            <div className="flex items-center gap-2 text-label-sm text-on-surface-variant pt-1">
              <span className="material-symbols-outlined text-primary text-base">verified_user</span>
              안전한 재활 데이터 관리
            </div>
          </div>

          {/* 의사 카드 */}
          <div className="bg-white rounded-2xl border border-outline-variant shadow-card p-8 flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: '#d8e2ff' }}>
                <span className="material-symbols-outlined text-3xl" style={{ color: '#1a73e8' }}>stethoscope</span>
              </div>
              <div className="w-12 h-12 rounded-full bg-surface-container-low flex items-center justify-center">
                <span className="material-symbols-outlined text-outline text-2xl">medical_services</span>
              </div>
            </div>

            <div>
              <h2 className="text-headline-lg-mobile font-display font-bold text-on-surface mb-2">
                의사(Doctor)
              </h2>
              <p className="text-body-md text-on-surface-variant leading-relaxed">
                환자의 운동 데이터를 분석하고 최적화된 처방을 제공하세요.
              </p>
            </div>

            <div className="flex flex-col gap-3 mt-auto">
              <Link
                to="/doctor/login"
                className="w-full h-12 text-white font-semibold text-label-lg rounded-xl flex items-center justify-center hover:brightness-110 active:scale-[0.98] transition-all shadow-md"
                style={{ background: '#1a73e8' }}
              >
                의사 로그인
              </Link>
              <Link
                to="/doctor/signup"
                className="w-full h-12 border-2 font-semibold text-label-lg rounded-xl flex items-center justify-center transition-all"
                style={{ borderColor: '#1a73e8', color: '#1a73e8' }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#e8f0fe'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                의사 회원가입
              </Link>
            </div>

            <div className="flex items-center gap-2 text-label-sm text-on-surface-variant pt-1">
              <span className="material-symbols-outlined text-base" style={{ color: '#1a73e8' }}>insights</span>
              강력한 데이터 분석 도구 지원
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}