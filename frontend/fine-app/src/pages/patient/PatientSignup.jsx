import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import logo from '../../assets/logo.png';

export default function PatientSignup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState('');

  const handlePhoneChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '');
    let formatted = '';
    if (digits.startsWith('02')) {
      if (digits.length <= 2) formatted = digits;
      else if (digits.length <= 5) formatted = `${digits.slice(0,2)}-${digits.slice(2)}`;
      else if (digits.length <= 9) formatted = `${digits.slice(0,2)}-${digits.slice(2,5)}-${digits.slice(5)}`;
      else formatted = `${digits.slice(0,2)}-${digits.slice(2,6)}-${digits.slice(6,10)}`;
    } else {
      if (digits.length <= 3) formatted = digits;
      else if (digits.length <= 7) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`;
      else formatted = `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7,11)}`;
    }
    setPhone(formatted);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      navigate('/patient/login');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-container-padding-mobile md:px-margin-desktop">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <Link to="/">
            <img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" />
          </Link>
          <Link to="/patient/login" className="text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors px-3 py-1 rounded-lg text-body-md">
            로그인
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-margin-mobile py-24">
        <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-xl p-8 md:p-10 shadow-card">
          <div className="text-center mb-8">
            <img src={logo} alt="Fine Rehabilitation" className="h-20 w-auto mx-auto mb-5" />
            <h1 className="font-display text-headline-xl text-on-surface mb-2">환자 회원가입</h1>
            <p className="text-body-md text-on-surface-variant">재활의 첫 걸음을 피네(Fine)와 함께 시작하세요.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 아이디 ~ 전화번호 */}
            {[
              { label: '아이디', id: 'username', type: 'text', placeholder: '아이디를 입력하세요', icon: 'person' },
              { label: '비밀번호', id: 'password', type: 'password', placeholder: '8자 이상 입력하세요', icon: 'lock' },
              { label: '비밀번호 확인', id: 'password2', type: 'password', placeholder: '비밀번호를 다시 입력하세요', icon: 'lock' },
              { label: '이름', id: 'name', type: 'text', placeholder: '실명을 입력하세요', icon: 'badge' },
            ].map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor={field.id}>{field.label}</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">{field.icon}</span>
                  <input
                    id={field.id}
                    type={field.type}
                    placeholder={field.placeholder}
                    className="w-full h-12 pl-12 pr-4 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md"
                  />
                </div>
              </div>
            ))}

            {/* 전화번호 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="phone">전화번호</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">call</span>
                <input
                  id="phone"
                  type="tel"
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={13}
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md"
                />
              </div>
            </div>

            {/* 성별 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1">성별</label>
              <div className="flex gap-3">
                {['남', '여'].map((g) => (
                  <label key={g} className="flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border border-outline-variant cursor-pointer hover:border-primary-container transition-colors has-[:checked]:border-primary-container has-[:checked]:bg-primary-fixed">
                    <input type="radio" name="gender" value={g} className="accent-primary-container" />
                    <span className="text-body-md font-medium">{g}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 생년월일 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="birth">생년월일</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">calendar_today</span>
                <input
                  id="birth"
                  type="date"
                  className="w-full h-12 pl-12 pr-4 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md"
                />
              </div>
            </div>

            {/* 보호자 이메일 + 수신 동의 */}
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="guardian-email">보호자 이메일</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">family_restroom</span>
                  <input
                    id="guardian-email"
                    type="email"
                    placeholder="guardian@example.com"
                    className="w-full h-12 pl-12 pr-4 rounded-xl border border-outline-variant bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md"
                  />
                </div>
              </div>
              <label className="flex items-start gap-3 cursor-pointer pl-1">
                <input type="checkbox" className="w-5 h-5 rounded accent-primary-container mt-0.5 shrink-0" />
                <span className="text-label-md text-on-surface-variant">
                  보호자 이메일로 재활 서비스 보고서 수신에 동의합니다
                  <span className="text-outline text-label-sm block mt-0.5">(선택) 입력한 보호자 이메일로 주간 재활 보고서가 발송됩니다.</span>
                </span>
              </label>
            </div>

            {/* 동의 항목 */}
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 rounded accent-primary-container mt-0.5 shrink-0" />
                <span className="text-label-md text-on-surface-variant">
                  이용약관 및 개인정보처리방침에 동의합니다
                  <span className="text-outline text-label-sm block mt-0.5">(필수) 서비스 이용을 위해 반드시 동의가 필요합니다.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 rounded accent-primary-container mt-0.5 shrink-0" />
                <span className="text-label-md text-on-surface-variant">
                  카메라 영상 및 생체(얼굴) 데이터 수집·이용에 동의합니다
                  <span className="text-outline text-label-sm block mt-0.5">(필수) 재활 운동 분석을 위해 카메라 영상 및 생체 데이터가 수집됩니다.</span>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-primary-container text-white font-semibold text-label-lg rounded-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md mt-2"
            >
              {loading ? (
                <><span className="material-symbols-outlined animate-spin">progress_activity</span>처리 중...</>
              ) : (
                <><span className="material-symbols-outlined">how_to_reg</span>회원가입</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-outline-variant text-center">
            <p className="text-label-md text-on-surface-variant">
              이미 계정이 있으신가요?{' '}
              <Link to="/patient/login" className="text-primary-container font-bold hover:underline ml-1">로그인</Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
