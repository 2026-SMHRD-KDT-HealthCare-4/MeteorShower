import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DoctorNavBar from '../../components/DoctorNavBar';

export default function DoctorProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    id: 'test',
    email: '1111@naver.com',
    phone: '010-0000-0000',
    name: '김나연',
    hospital: '00병원',
  });

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    // TODO: API 연동
    alert('저장되었습니다.');
  };

  const readOnlyFields = [
    { label: '아이디', name: 'id' },
    { label: '이름', name: 'name' },
    { label: '소속', name: 'hospital' },
  ];

  const editableFields = [
    { label: '이메일', name: 'email', type: 'email', placeholder: '이메일을 입력하세요' },
    { label: '전화번호', name: 'phone', type: 'tel', placeholder: '010-0000-0000' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <DoctorNavBar />

      <main className="max-w-2xl mx-auto px-4 md:px-0 py-10">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-on-surface-variant hover:text-doctor-primary transition-colors mb-6"
        >
          <span className="material-symbols-outlined">arrow_back</span>
          <span className="text-label-md font-medium">돌아가기</span>
        </button>

        {/* Card */}
        <div className="bg-white border border-outline-variant rounded-2xl shadow-card overflow-hidden">
          {/* Header */}
          <div className="px-8 pt-8 pb-6 border-b border-outline-variant">
            <h1 className="text-headline-lg-mobile font-display font-bold text-doctor-primary">프로필 설정</h1>
            <p className="text-body-md text-on-surface-variant mt-1">
              Fine 서비스를 위한 사용자 정보를 관리하세요.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="px-8 py-6 space-y-4">
            {/* 변경 불가 필드 */}
            {readOnlyFields.map((f) => (
              <div key={f.name} className="flex items-center gap-4">
                <label className="w-28 flex-shrink-0 text-label-md font-semibold text-on-surface-variant text-right">
                  {f.label}
                </label>
                <div className="flex-1">
                  <input
                    name={f.name}
                    type="text"
                    value={form[f.name]}
                    readOnly
                    className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-body-md text-on-surface bg-surface-container cursor-not-allowed"
                  />
                </div>
              </div>
            ))}

            {/* 변경 가능 필드 */}
            {editableFields.map((f) => (
              <div key={f.name} className="flex items-center gap-4">
                <label className="w-28 flex-shrink-0 text-label-md font-semibold text-on-surface-variant text-right">
                  {f.label}
                </label>
                <div className="flex-1">
                  <input
                    name={f.name}
                    type={f.type}
                    value={form[f.name]}
                    onChange={handleChange}
                    placeholder={f.placeholder}
                    className="w-full px-4 py-2.5 border border-outline-variant rounded-xl text-body-md text-on-surface bg-surface-container-lowest focus:outline-none focus:ring-2 focus:ring-doctor-primary transition-all placeholder:text-outline"
                  />
                </div>
              </div>
            ))}

            {/* Save */}
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-8 py-2.5 bg-doctor-primary text-white rounded-xl text-label-md font-semibold hover:opacity-90 transition-opacity shadow-md"
              >
                저장
              </button>
            </div>
          </form>
        </div>

        {/* Bottom info cards */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-card flex items-start gap-3">
            <div className="w-9 h-9 bg-[#e8f0fe] rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-doctor-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                shield
              </span>
            </div>
            <div>
              <p className="text-label-md font-bold text-on-surface">보안 설정</p>
              <p className="text-label-sm text-on-surface-variant mt-0.5">마지막 업데이트 약 22일 전</p>
            </div>
          </div>
          <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-card flex items-start gap-3">
            <div className="w-9 h-9 bg-[#e8f0fe] rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[#1a73e8] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                verified
              </span>
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