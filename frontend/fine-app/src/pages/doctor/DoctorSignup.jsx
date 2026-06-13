import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import logo from '../../assets/logo.png';

export default function DoctorSignup() {
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
      navigate('/doctor/login');
    }, 1000);
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fbf9f8' }}>
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-margin-mobile md:px-margin-desktop">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <Link to="/">
            <img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" />
          </Link>
          <Link to="/doctor/login" className="text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors px-3 py-1 rounded-lg text-body-md">
            로그인
          </Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-margin-mobile py-24">
        <div className="w-full max-w-[480px] bg-white rounded-xl p-8 md:p-10 shadow-card">
          <div className="text-center mb-8">
            <img src={logo} alt="Fine Rehabilitation" className="h-20 w-auto mx-auto mb-5" />
            <h1 className="font-display text-headline-xl mb-2" style={{ color: '#1b1c1c' }}>의료진 회원가입</h1>
            <p className="text-body-md" style={{ color: '#414754' }}>인증된 의료진만 가입할 수 있습니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {[
              { label: '아이디', id: 'username', type: 'text', placeholder: '아이디를 입력하세요', icon: 'person' },
              { label: '비밀번호', id: 'password', type: 'password', placeholder: '8자 이상 입력하세요', icon: 'lock' },
              { label: '비밀번호 확인', id: 'password2', type: 'password', placeholder: '비밀번호를 다시 입력하세요', icon: 'lock' },
              { label: '이름', id: 'name', type: 'text', placeholder: '실명을 입력하세요', icon: 'badge' },
              { label: '소속 병원', id: 'hospital', type: 'text', placeholder: '소속 병원명을 입력하세요', icon: 'local_hospital' },
              { label: '전문과목', id: 'specialty', type: 'text', placeholder: '예) 재활의학과', icon: 'stethoscope' },
              { label: '면허 번호', id: 'license', type: 'text', placeholder: '의사 면허 번호를 입력하세요', icon: 'verified' },
            ].map((field) => (
              <div key={field.id} className="space-y-1.5">
                <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor={field.id}>{field.label}</label>
                <div className="relative group">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>{field.icon}</span>
                  <input
                    id={field.id}
                    type={field.type}
                    placeholder={field.placeholder}
                    className="w-full h-12 pl-12 pr-4 rounded-xl border bg-white focus:ring-2 focus:ring-blue-600 transition-all outline-none text-body-md"
                    style={{ borderColor: '#c1c6d6' }}
                  />
                </div>
              </div>
            ))}

            {/* 전화번호 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="phone">전화번호</label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>call</span>
                <input
                  id="phone"
                  type="tel"
                  placeholder="010-0000-0000"
                  value={phone}
                  onChange={handlePhoneChange}
                  maxLength={13}
                  className="w-full h-12 pl-12 pr-4 rounded-xl border bg-white focus:ring-2 focus:ring-blue-600 transition-all outline-none text-body-md"
                  style={{ borderColor: '#c1c6d6' }}
                />
              </div>
            </div>

            {/* 동의 항목 */}
            <div className="space-y-3 pt-1">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 rounded mt-0.5 shrink-0" style={{ accentColor: '#005bbf' }} />
                <span className="text-label-md" style={{ color: '#414754' }}>
                  이용약관 및 개인정보처리방침에 동의합니다
                  <span className="block mt-0.5 text-label-sm" style={{ color: '#727785' }}>(필수) 서비스 이용을 위해 반드시 동의가 필요합니다.</span>
                </span>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" className="w-5 h-5 rounded mt-0.5 shrink-0" style={{ accentColor: '#005bbf' }} />
                <span className="text-label-md" style={{ color: '#414754' }}>
                  환자 데이터 수집·이용·처리에 동의합니다
                  <span className="block mt-0.5 text-label-sm" style={{ color: '#727785' }}>(필수) 의료진으로서 환자 재활 데이터를 처리하는 데 동의합니다.</span>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 text-white font-semibold text-label-lg rounded-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md mt-2"
              style={{ background: '#1a73e8' }}
            >
              {loading ? (
                <><span className="material-symbols-outlined animate-spin">progress_activity</span>처리 중...</>
              ) : (
                <><span className="material-symbols-outlined">how_to_reg</span>회원가입</>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t text-center" style={{ borderColor: '#c1c6d6' }}>
            <p className="text-label-md" style={{ color: '#414754' }}>
              이미 계정이 있으신가요?{' '}
              <Link to="/doctor/login" className="font-bold hover:underline ml-1" style={{ color: '#005bbf' }}>로그인</Link>
            </p>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}