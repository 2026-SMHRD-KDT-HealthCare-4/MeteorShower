import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function DoctorNavBar() {
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);
  const [aiApproval, setAiApproval] = useState(true);
  const popupRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setShowProfile(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-surface shadow-sm sticky top-0 z-50 border-b border-outline-variant">
      <nav className="flex justify-between items-center w-full px-container-padding-mobile md:px-container-padding-desktop py-2 max-w-7xl mx-auto">
        <Link to="/doctor/patients">
          <img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" />
        </Link>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 group cursor-pointer active:scale-95 transition-transform duration-150"
          >
            <span className="text-on-surface-variant font-medium group-hover:text-doctor-primary text-label-md">Logout</span>
            <span className="material-symbols-outlined text-doctor-primary">logout</span>
          </button>

          {/* Profile icon + popup */}
          <div className="relative" ref={popupRef}>
            <button
              onClick={() => setShowProfile((v) => !v)}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-doctor-primary text-3xl">account_circle</span>
            </button>

            {showProfile && (
              <div className="absolute right-0 top-12 w-72 bg-white rounded-2xl shadow-2xl border border-outline-variant z-50 overflow-hidden">
                {/* Avatar area */}
                <div className="flex flex-col items-center pt-6 pb-4 px-6 border-b border-outline-variant bg-[#f0f6ff]">
                  <div className="w-20 h-20 rounded-full bg-[#d0e4ff] flex items-center justify-center mb-3 border-4 border-white shadow-md">
                    <span className="material-symbols-outlined text-doctor-primary" style={{ fontSize: '44px', fontVariationSettings: "'FILL' 1" }}>
                      account_circle
                    </span>
                  </div>
                  <p className="text-title-md font-bold text-on-surface">00병원 김나연 의사님</p>
                  <span className="mt-1 px-3 py-0.5 bg-white border border-outline-variant rounded-full text-label-sm text-on-surface-variant font-medium">
                    상지 재활 전문의
                  </span>
                </div>

                {/* Info rows */}
                <div className="px-5 py-4 space-y-3">
                  {/* AI toggle */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base text-[#1a73e8]">auto_awesome</span>
                      <span className="text-label-md text-on-surface font-medium">AI 난이도 조절 승인</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {aiApproval && (
                        <span className="material-symbols-outlined text-[#34a853] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      )}
                      <button
                        onClick={() => setAiApproval((v) => !v)}
                        className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${aiApproval ? 'bg-doctor-primary' : 'bg-outline-variant'}`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${aiApproval ? 'translate-x-[22px]' : 'translate-x-0'}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="bg-[#f0f6ff] rounded-xl p-3 text-center">
                      <p className="text-title-md font-bold text-doctor-primary">12명</p>
                      <p className="text-label-sm text-on-surface-variant mt-0.5">담당 환자</p>
                    </div>
                    <div className="bg-[#f0f6ff] rounded-xl p-3 text-center">
                      <p className="text-title-md font-bold text-doctor-primary">3건</p>
                      <p className="text-label-sm text-on-surface-variant mt-0.5">처방 대기</p>
                    </div>
                  </div>
                </div>

                {/* Edit button */}
                <div className="px-5 pb-5">
                  <button
                    onClick={() => { navigate('/doctor/profile'); setShowProfile(false); }}
                    className="w-full h-10 bg-doctor-primary text-white rounded-xl text-label-md font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <span className="material-symbols-outlined text-base">edit</span>
                    수정
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}