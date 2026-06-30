import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../../api';
import Footer from '../../components/Footer';
import PatientConsent from '../../components/PatientConsent';

/* 허용 특수문자 (", ', `, \, <, >, & 제외) */
const PW_ALLOWED_SPECIAL = /[!@#$%^*()_+\-=,./:;[\]{}|~]/;
const PW_FORBIDDEN       = /["'`\\<>&]/;

function getErrors(form, usernameChecked) {
  const e = {};

  // 아이디
  if (!form.username)
    e.username = '아이디를 입력하세요';
  else if (!/^[a-zA-Z0-9]+$/.test(form.username))
    e.username = '영문자와 숫자만 사용 가능합니다';
  else if (form.username.length < 4 || form.username.length > 20)
    e.username = '4~20자로 입력하세요';
  else if (!usernameChecked)
    e.username = '아이디 중복 확인을 해주세요';

  // 비밀번호
  if (!form.password)
    e.password = '비밀번호를 입력하세요';
  else if (form.password.length < 8 || form.password.length > 20)
    e.password = '8~20자로 입력하세요';
  else if (PW_FORBIDDEN.test(form.password))
    e.password = '사용할 수 없는 문자가 포함됐습니다 (", \', `, \\, <, >, &)';

  // 비밀번호 확인
  if (!form.password2)
    e.password2 = '비밀번호를 다시 입력하세요';
  else if (form.password2 !== form.password)
    e.password2 = '비밀번호가 일치하지 않습니다';

  // 이름
  if (!form.name)
    e.name = '이름을 입력하세요';
  else if (form.name.length < 2)
    e.name = '2자 이상 입력하세요';

  // 전화번호
  if (!form.phone)
    e.phone = '전화번호를 입력하세요';
  else if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(form.phone))
    e.phone = '전화번호를 끝까지 입력하세요';

  // 성별
  if (!form.gender) e.gender = '성별을 선택하세요';

  // 생년월일
  if (!form.birth) e.birth = '생년월일을 입력하세요';

  // 보호자 이메일 (입력된 경우에만 형식 검사)
  if (form.guardianEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.guardianEmail))
    e.guardianEmail = '올바른 이메일 형식이 아닙니다 (예: guardian@example.com)';

  return e;
}

const PW_RULES = [
  { label: '8~20자', check: (v) => v.length >= 8 && v.length <= 20 },
  { label: '특수문자 포함 (!@#$%^* 등)', check: (v) => PW_ALLOWED_SPECIAL.test(v) },
];

export default function PatientSignup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '', password: '', password2: '',
    name: '', phone: '', gender: '', birth: '', guardianEmail: '',
  });
  const [touched, setTouched]               = useState({});
  const [usernameChecked, setUsernameChecked] = useState(false);
  const [usernameTaken, setUsernameTaken]     = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [consentAgreed, setConsentAgreed]     = useState({});
  const [loading, setLoading]               = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const errors   = getErrors(form, usernameChecked);
  const canSubmit = Object.keys(errors).length === 0 && consentAgreed.terms && consentAgreed.privacy;

  const show = (field) => (touched[field] || submitAttempted) && errors[field];

  /* 비밀번호 전용 핸들러 — 한글 포함 ASCII 외 문자 제거 */
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

  /* 입력 핸들러 */
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    setTouched((p) => ({ ...p, [name]: true }));
    if (name === 'username') { setUsernameChecked(false); setUsernameTaken(false); }
  };

  const handleBlur = (field) => setTouched((p) => ({ ...p, [field]: true }));

  /* 전화번호 자동 하이픈 */
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

  /* 중복 확인 */
  const isUsernameFmtOk = /^[a-zA-Z0-9]{4,20}$/.test(form.username);
  const checkUsername = () => {
    if (!isUsernameFmtOk || checkingUsername) return;
    setCheckingUsername(true);
    authApi.patientCheckId(form.username)
      .then(({ available }) => {
        if (available) {
          setUsernameChecked(true);
          setUsernameTaken(false);
        } else {
          setUsernameTaken(true);
          setTouched((p) => ({ ...p, username: true }));
        }
      })
      .catch(() => {})
      .finally(() => setCheckingUsername(false));
  };

  /* 제출 */
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitAttempted(true);
    setTouched({ username:true, password:true, password2:true, name:true, phone:true, gender:true, birth:true, guardianEmail:true });
    if (!canSubmit) return;
    setLoading(true);
    authApi.patientSignup(form)
      .then(() => navigate('/patient/login'))
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  };

  /* 공통 input 클래스 */
  const inputCls = (field) =>
    `w-full h-12 pl-12 pr-4 rounded-xl border bg-surface-container-lowest focus:ring-2 focus:ring-primary-container focus:border-primary-container transition-all outline-none text-body-md ${
      show(field) ? 'border-red-400' : 'border-outline-variant'
    }`;

  return (
    <div className="min-h-screen flex flex-col bg-background" style={{ backgroundImage: "url('/patient-bg-pattern.svg')", backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }}>
      <header className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl shadow-sm h-16 flex items-center px-container-padding-mobile md:px-margin-desktop">
        <div className="flex justify-between items-center w-full max-w-7xl mx-auto">
          <Link to="/"><img src="/logo.png" alt="Fine Rehabilitation" className="h-12 w-auto" /></Link>
          <Link to="/patient/login" className="text-on-surface-variant font-medium hover:bg-surface-container-low transition-colors px-3 py-1 rounded-lg text-body-md">로그인</Link>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center px-margin-mobile py-24">
        <div className="w-full max-w-[480px] bg-surface-container-lowest rounded-xl p-8 md:p-10 shadow-card">
          <div className="text-center mb-8">
            <img src="/logo.png" alt="Fine Rehabilitation" className="h-20 w-auto mx-auto mb-5" />
            <h1 className="font-display text-headline-xl text-on-surface mb-2">환자 회원가입</h1>
            <p className="text-body-md text-on-surface-variant">재활의 첫 걸음을 피네(Fine)와 함께 시작하세요.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {/* 아이디 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="username">
                아이디 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <div className="relative group flex-1">
                  <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">person</span>
                  <input
                    id="username" name="username" type="text"
                    placeholder="영문, 숫자 4~20자"
                    value={form.username}
                    onChange={handleChange}
                    onBlur={() => handleBlur('username')}
                    className={inputCls('username')}
                  />
                </div>
                <button
                  type="button"
                  onClick={checkUsername}
                  disabled={!isUsernameFmtOk || checkingUsername}
                  className="flex-shrink-0 px-3 h-12 rounded-xl text-label-md font-semibold border-2 border-primary-container text-primary-container hover:bg-primary-fixed transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
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
              {usernameTaken && (
                <p className="text-label-sm text-red-500 flex items-center gap-1 ml-1">
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  이미 사용 중인 아이디입니다
                </p>
              )}
              {show('username') && !usernameTaken && <p className="text-label-sm text-red-500 ml-1">{errors.username}</p>}
            </div>

            {/* 비밀번호 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="password">
                비밀번호 <span className="text-red-500">*</span>
                <span className="text-label-sm font-normal text-outline ml-2">{form.password.length}/20</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">lock</span>
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
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPw ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              {/* 비밀번호 요건 체크리스트 */}
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
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="password2">
                비밀번호 확인 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">lock</span>
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
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface transition-colors"
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
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="name">
                이름 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">badge</span>
                <input
                  id="name" name="name" type="text"
                  placeholder="실명을 입력하세요"
                  value={form.name}
                  onChange={handleChange}
                  onBlur={() => handleBlur('name')}
                  className={inputCls('name')}
                />
              </div>
              {show('name') && <p className="text-label-sm text-red-500 ml-1">{errors.name}</p>}
            </div>

            {/* 전화번호 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="phone">
                전화번호 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">call</span>
                <input
                  id="phone" name="phone" type="tel"
                  placeholder="010-0000-0000"
                  value={form.phone}
                  onChange={handlePhone}
                  onBlur={() => handleBlur('phone')}
                  maxLength={13}
                  className={inputCls('phone')}
                />
              </div>
              {show('phone') && <p className="text-label-sm text-red-500 ml-1">{errors.phone}</p>}
            </div>

            {/* 성별 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1">
                성별 <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-3">
                {['남', '여'].map((g) => (
                  <label key={g} className={`flex-1 flex items-center justify-center gap-2 h-12 rounded-xl border cursor-pointer transition-colors ${
                    form.gender === g ? 'border-primary-container bg-primary-fixed' : 'border-outline-variant hover:border-primary-container'
                  }`}>
                    <input
                      type="radio" name="gender" value={g}
                      checked={form.gender === g}
                      onChange={handleChange}
                      className="accent-primary-container"
                    />
                    <span className="text-body-md font-medium">{g}</span>
                  </label>
                ))}
              </div>
              {show('gender') && <p className="text-label-sm text-red-500 ml-1">{errors.gender}</p>}
            </div>

            {/* 생년월일 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="birth">
                생년월일 <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">calendar_today</span>
                <input
                  id="birth" name="birth" type="date"
                  value={form.birth}
                  onChange={handleChange}
                  onBlur={() => handleBlur('birth')}
                  max={new Date().toISOString().split('T')[0]}
                  className={inputCls('birth')}
                />
              </div>
              {show('birth') && <p className="text-label-sm text-red-500 ml-1">{errors.birth}</p>}
            </div>

            {/* 보호자 이메일 */}
            <div className="space-y-1.5">
              <label className="block text-label-lg font-semibold text-on-surface-variant ml-1" htmlFor="guardian-email">
                보호자 이메일 <span className="text-outline text-label-sm font-normal">(선택)</span>
              </label>
              <div className="relative group">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary-container transition-colors">family_restroom</span>
                <input
                  id="guardian-email" name="guardianEmail" type="email"
                  placeholder="guardian@example.com"
                  value={form.guardianEmail}
                  onChange={handleChange}
                  onBlur={() => handleBlur('guardianEmail')}
                  className={inputCls('guardianEmail')}
                />
              </div>
              {show('guardianEmail') && <p className="text-label-sm text-red-500 ml-1">{errors.guardianEmail}</p>}
            </div>

            {/* 동의 항목 */}
            <div className="pt-1">
              <PatientConsent onChange={setConsentAgreed} submitAttempted={submitAttempted} />
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full h-14 font-semibold text-label-lg rounded-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md mt-2 ${
                canSubmit
                  ? 'bg-primary-container text-white hover:brightness-110 cursor-pointer'
                  : 'bg-surface-container text-outline cursor-not-allowed'
              }`}
            >
              {loading
                ? <><span className="material-symbols-outlined animate-spin">progress_activity</span>처리 중...</>
                : <><span className="material-symbols-outlined">how_to_reg</span>회원가입</>
              }
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
