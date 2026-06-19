import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../../components/Footer';
import logo from '../../assets/logo.png';

const PW_ALLOWED_SPECIAL = /[!@#$%^*()_+\-=,./:;[\]{}|~]/;
const PW_FORBIDDEN       = /["'`\\<>&]/;

function getErrors(form, usernameChecked, licenseVerified) {
  const e = {};

  if (!form.username)
    e.username = '아이디를 입력하세요';
  else if (!/^[a-zA-Z0-9]+$/.test(form.username))
    e.username = '영문자와 숫자만 사용 가능합니다';
  else if (form.username.length < 4 || form.username.length > 20)
    e.username = '4~20자로 입력하세요';
  else if (!usernameChecked)
    e.username = '아이디 중복 확인을 해주세요';

  if (!form.password)
    e.password = '비밀번호를 입력하세요';
  else if (form.password.length < 8 || form.password.length > 20)
    e.password = '8~20자로 입력하세요';
  else if (PW_FORBIDDEN.test(form.password))
    e.password = '사용할 수 없는 문자가 포함됐습니다 (", \', `, \\, <, >, &)';

  if (!form.password2)
    e.password2 = '비밀번호를 다시 입력하세요';
  else if (form.password2 !== form.password)
    e.password2 = '비밀번호가 일치하지 않습니다';

  if (!form.name)
    e.name = '이름을 입력하세요';
  else if (form.name.length < 2)
    e.name = '2자 이상 입력하세요';

  if (!form.hospital)
    e.hospital = '소속 병원을 입력하세요';

  if (!form.license)
    e.license = '면허 번호를 입력하세요';
  else if (!form.licenseDate)
    e.license = '취득 날짜를 입력해주세요';
  else if (!licenseVerified)
    e.license = '면허 번호 인증을 완료해주세요';

  if (!form.phone)
    e.phone = '전화번호를 입력하세요';
  else if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(form.phone))
    e.phone = '전화번호를 끝까지 입력하세요';

  if (!form.email)
    e.email = '이메일을 입력하세요';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    e.email = '올바른 이메일 형식이 아닙니다 (예: doctor@example.com)';

  return e;
}

const PW_RULES = [
  { label: '8~20자', check: (v) => v.length >= 8 && v.length <= 20 },
  { label: '특수문자 포함 (!@#$%^* 등)', check: (v) => PW_ALLOWED_SPECIAL.test(v) },
];

export default function DoctorSignup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '', password: '', password2: '',
    name: '', hospital: '', license: '', licenseDate: '', phone: '', email: '',
  });
  const [touched, setTouched]                   = useState({});
  const [usernameChecked, setUsernameChecked]   = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [licenseVerified, setLicenseVerified]   = useState(false);
  const [verifyingLicense, setVerifyingLicense] = useState(false);
  const [agree, setAgree]                       = useState({ terms: false, data: false });
  const [loading, setLoading]                   = useState(false);
  const [submitAttempted, setSubmitAttempted]   = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const errors   = getErrors(form, usernameChecked, licenseVerified);
  const canSubmit = Object.keys(errors).length === 0 && agree.terms && agree.data;

  const show = (field) => (touched[field] || submitAttempted) && errors[field];

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    const stripped = value.replace(/[^\x20-\x7E]/g, '');
    setForm((p) => ({ ...p, [name]: stripped }));
    setTouched((p) => ({ ...p, [name]: true }));
  };
  const handlePasswordComposition = (e) => {
    const stripped = e.target.value.replace(/[^\x20-\x7E]/g, '');
    setForm((p) => ({ ...p, [e.target.name]: stripped }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setTouched((p) => ({ ...p, [name]: true }));
    if (name === 'username') setUsernameChecked(false);
    if (name === 'license' || name === 'licenseDate') setLicenseVerified(false);
  };

  const handleBlur = (field) => setTouched((p) => ({ ...p, [field]: true }));

  const handlePhone = (e) => {
    const d = e.target.value.replace(/\D/g, '');
    let f = '';
    if (d.startsWith('02')) {
      if (d.length <= 2) f = d;
      else if (d.length <= 5) f = `${d.slice(0,2)}-${d.slice(2)}`;
      else if (d.length <= 9) f = `${d.slice(0,2)}-${d.slice(2,5)}-${d.slice(5)}`;
      else f = `${d.slice(0,2)}-${d.slice(2,6)}-${d.slice(6,10)}`;
    } else {
      if (d.length <= 3) f = d;
      else if (d.length <= 7) f = `${d.slice(0,3)}-${d.slice(3)}`;
      else f = `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7,11)}`;
    }
    setForm((p) => ({ ...p, phone: f }));
    setTouched((p) => ({ ...p, phone: true }));
  };

  const isUsernameFmtOk = /^[a-zA-Z0-9]{4,20}$/.test(form.username);
  const checkUsername = () => {
    if (!isUsernameFmtOk || checkingUsername) return;
    setCheckingUsername(true);
    // TODO: API 연동
    setTimeout(() => { setCheckingUsername(false); setUsernameChecked(true); }, 800);
  };

  const isLicenseFmtOk = form.license.trim().length >= 5 && !!form.licenseDate;
  const verifyLicense = () => {
    if (!isLicenseFmtOk || verifyingLicense) return;
    setVerifyingLicense(true);
    // TODO: 면허 인증 API 연동
    setTimeout(() => { setVerifyingLicense(false); setLicenseVerified(true); }, 1000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setTouched({ username:true, password:true, password2:true, name:true, hospital:true, license:true, licenseDate:true, phone:true, email:true });
    if (!canSubmit) return;
    setLoading(true);
    // TODO: 아래 setTimeout 블록을 실제 API 호출로 교체
    // api.post('/auth/doctor/signup', { username: form.username, password: form.password, name: form.name, hospital: form.hospital, license: form.license, phone: form.phone, email: form.email })
    //   .then(() => navigate('/doctor/login'))
    //   .catch((err) => alert(err.message))
    //   .finally(() => setLoading(false));
    setTimeout(() => { setLoading(false); navigate('/doctor/login'); }, 1000);
  };

  const inputCls = (field) =>
    `w-full h-12 pl-12 pr-4 rounded-xl border bg-white focus:ring-2 focus:ring-blue-600 transition-all outline-none text-body-md ${
      show(field) ? 'border-red-400' : ''
    }`;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fbf9f8' }}>
      <header className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-margin-mobile md:px-margin-desktop">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <Link to="/"><img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" /></Link>
          <Link to="/doctor/login" className="text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors px-3 py-1 rounded-lg text-body-md">로그인</Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-margin-mobile py-24">
        <div className="w-full max-w-[480px] bg-white rounded-xl p-8 md:p-10 shadow-card">
          <div className="text-center mb-8">
            <img src={logo} alt="Fine Rehabilitation" className="h-20 w-auto mx-auto mb-5" />
            <h1 className="font-display text-headline-xl mb-2" style={{ color: '#1b1c1c' }}>의료진 회원가입</h1>
            <p className="text-body-md" style={{ color: '#414754' }}>인증된 의료진만 가입할 수 있습니다.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* 아이디 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="username">
                아이디 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative group flex-1">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>person</span>
                  <input
                    id="username" name="username" type="text"
                    placeholder="영문, 숫자 4~20자"
                    value={form.username}
                    onChange={handleChange}
                    onBlur={() => handleBlur('username')}
                    className={inputCls('username')}
                    style={!show('username') ? { borderColor: '#c1c6d6' } : {}}
                  />
                </div>
                <button
                  type="button"
                  onClick={checkUsername}
                  disabled={!isUsernameFmtOk || checkingUsername}
                  className="flex-shrink-0 px-3 h-12 rounded-xl text-label-md font-semibold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{ borderColor: '#005bbf', color: '#005bbf' }}
                >
                  {checkingUsername ? '확인 중…' : '중복 확인'}
                </button>
              </div>
              {usernameChecked && !show('username') && (
                <p className="text-label-sm text-green-600 flex items-center gap-1 ml-1">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings:"'FILL' 1" }}>check_circle</span>
                  사용 가능한 아이디입니다
                </p>
              )}
              {show('username') && <p className="text-label-sm text-red-500 ml-1">{errors.username}</p>}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="password">
                비밀번호 <span className="text-red-500">*</span>
                <span className="text-label-sm font-normal ml-2" style={{ color: '#727785' }}>{form.password.length}/20</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>lock</span>
                <input
                  id="password" name="password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="8~20자 (영문·숫자·특수문자)"
                  value={form.password}
                  onChange={handlePasswordChange}
                  onCompositionEnd={handlePasswordComposition}
                  onBlur={() => handleBlur('password')}
                  maxLength={20}
                  lang="en"
                  className={`${inputCls('password')} pr-12`}
                  style={!show('password') ? { borderColor: '#c1c6d6' } : {}}
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
              {form.password && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 ml-1 mt-1">
                  {PW_RULES.map(({ label, check }) => (
                    <p key={label} className={`text-label-sm flex items-center gap-1 ${check(form.password) ? 'text-green-600' : 'text-outline'}`}>
                      <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings:"'FILL' 1" }}>
                        {check(form.password) ? 'check_circle' : 'radio_button_unchecked'}
                      </span>
                      {label}
                    </p>
                  ))}
                </div>
              )}
              {show('password') && <p className="text-label-sm text-red-500 ml-1">{errors.password}</p>}
            </div>

            {/* 비밀번호 확인 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="password2">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>lock</span>
                <input
                  id="password2" name="password2"
                  type={showPw2 ? 'text' : 'password'}
                  placeholder="비밀번호를 다시 입력하세요"
                  value={form.password2}
                  onChange={handlePasswordChange}
                  onCompositionEnd={handlePasswordComposition}
                  onBlur={() => handleBlur('password2')}
                  maxLength={20}
                  lang="en"
                  className={`${inputCls('password2')} pr-12`}
                  style={!show('password2') ? { borderColor: '#c1c6d6' } : {}}
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: '#727785' }}
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPw2 ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {form.password2 && form.password2 === form.password && (
                <p className="text-label-sm text-green-600 flex items-center gap-1 ml-1">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings:"'FILL' 1" }}>check_circle</span>
                  비밀번호가 일치합니다
                </p>
              )}
              {show('password2') && <p className="text-label-sm text-red-500 ml-1">{errors.password2}</p>}
            </div>

            {/* 이름 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="name">
                이름 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>badge</span>
                <input
                  id="name" name="name" type="text"
                  placeholder="실명을 입력하세요"
                  value={form.name}
                  onChange={handleChange}
                  onBlur={() => handleBlur('name')}
                  className={inputCls('name')}
                  style={!show('name') ? { borderColor: '#c1c6d6' } : {}}
                />
              </div>
              {show('name') && <p className="text-label-sm text-red-500 ml-1">{errors.name}</p>}
            </div>

            {/* 소속 병원 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="hospital">
                소속 병원 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>local_hospital</span>
                <input
                  id="hospital" name="hospital" type="text"
                  placeholder="소속 병원명을 입력하세요"
                  value={form.hospital}
                  onChange={handleChange}
                  onBlur={() => handleBlur('hospital')}
                  className={inputCls('hospital')}
                  style={!show('hospital') ? { borderColor: '#c1c6d6' } : {}}
                />
              </div>
              {show('hospital') && <p className="text-label-sm text-red-500 ml-1">{errors.hospital}</p>}
            </div>

            {/* 면허 번호 + 취득날짜 + 인증 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="license">
                면허 번호 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>verified</span>
                <input
                  id="license" name="license" type="text"
                  placeholder="의사 면허 번호를 입력하세요"
                  value={form.license}
                  onChange={handleChange}
                  onBlur={() => handleBlur('license')}
                  className={inputCls('license')}
                  style={!show('license') ? { borderColor: '#c1c6d6' } : {}}
                />
              </div>

              <label className="block text-label-sm font-semibold ml-1 mt-2" style={{ color: '#727785' }}>
                취득 날짜 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative group flex-1">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>calendar_today</span>
                  <input
                    id="licenseDate" name="licenseDate" type="date"
                    value={form.licenseDate}
                    onChange={handleChange}
                    onBlur={() => handleBlur('licenseDate')}
                    max={new Date().toISOString().split('T')[0]}
                    className={inputCls('license')}
                    style={!show('license') ? { borderColor: '#c1c6d6' } : {}}
                  />
                </div>
                <button
                  type="button"
                  onClick={verifyLicense}
                  disabled={!isLicenseFmtOk || verifyingLicense || licenseVerified}
                  className="flex-shrink-0 px-3 h-12 rounded-xl text-label-md font-semibold border-2 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  style={{ borderColor: '#005bbf', color: '#005bbf' }}
                >
                  {verifyingLicense ? '인증 중…' : licenseVerified ? '인증 완료' : '인증'}
                </button>
              </div>

              {licenseVerified && !show('license') && (
                <p className="text-label-sm text-green-600 flex items-center gap-1 ml-1">
                  <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings:"'FILL' 1" }}>verified</span>
                  면허 인증이 완료되었습니다
                </p>
              )}
              {show('license') && <p className="text-label-sm text-red-500 ml-1">{errors.license}</p>}
            </div>

            {/* 전화번호 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="phone">
                전화번호 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>call</span>
                <input
                  id="phone" name="phone" type="tel"
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={handlePhone}
                  onBlur={() => handleBlur('phone')}
                  maxLength={13}
                  className={inputCls('phone')}
                  style={!show('phone') ? { borderColor: '#c1c6d6' } : {}}
                />
              </div>
              {show('phone') && <p className="text-label-sm text-red-500 ml-1">{errors.phone}</p>}
            </div>

            {/* 이메일 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold ml-1" style={{ color: '#414754' }} htmlFor="email">
                이메일 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-blue-600 transition-colors" style={{ color: '#727785' }}>mail</span>
                <input
                  id="email" name="email" type="email"
                  placeholder="doctor@example.com"
                  value={form.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur('email')}
                  className={inputCls('email')}
                  style={!show('email') ? { borderColor: '#c1c6d6' } : {}}
                />
              </div>
              {show('email') && <p className="text-label-sm text-red-500 ml-1">{errors.email}</p>}
            </div>

            {/* 필수 동의 */}
            <div className="space-y-3 pt-1">
              {[
                { key: 'terms', label: '이용약관 및 개인정보처리방침에 동의합니다', sub: '(필수) 서비스 이용을 위해 반드시 동의가 필요합니다.' },
                { key: 'data',  label: '환자 데이터 수집·이용·처리에 동의합니다', sub: '(필수) 의료진으로서 환자 재활 데이터를 처리하는 데 동의합니다.' },
              ].map(({ key, label, sub }) => (
                <label key={key} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agree[key]}
                    onChange={(e) => setAgree((p) => ({ ...p, [key]: e.target.checked }))}
                    className="w-5 h-5 rounded mt-0.5 shrink-0"
                    style={{ accentColor: '#005bbf' }}
                  />
                  <span className="text-label-md" style={{ color: '#414754' }}>
                    {label}
                    <span className="block mt-0.5 text-label-sm" style={{ color: '#727785' }}>{sub}</span>
                  </span>
                </label>
              ))}
              {submitAttempted && (!agree.terms || !agree.data) && (
                <p className="text-label-sm text-red-500 ml-1">필수 항목에 모두 동의해주세요.</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full h-14 text-white font-semibold text-label-lg rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md mt-2 ${
                canSubmit ? 'hover:brightness-110 cursor-pointer' : 'opacity-50 cursor-not-allowed'
              }`}
              style={{ background: canSubmit ? '#1a73e8' : '#9ab4d8' }}
            >
              {loading
                ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>처리 중...</>
                : <><span className="material-symbols-outlined">how_to_reg</span>회원가입</>
              }
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
