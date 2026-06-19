import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    type: 'prescription',
    message: '담당 의사가 새 운동 처방을 등록했습니다.',
    time: '방금 전',
    read: false,
  },
  {
    id: 2,
    type: 'appointment',
    message: '다음 진료 예정일: 2026.03.15 (D-7)',
    time: '1시간 전',
    read: false,
  },
  {
    id: 3,
    type: 'report',
    message: '이번 주 재활 보고서가 보호자 이메일로 발송되었습니다.',
    time: '어제',
    read: true,
  },
];

const TYPE_CONFIG = {
  prescription: {
    icon: 'assignment',
    label: '처방 업데이트',
    color: 'text-[#1a73e8]',
    bg: 'bg-[#e8f0fe]',
    border: 'border-[#aecbfa]',
    dot: 'bg-[#1a73e8]',
  },
  appointment: {
    icon: 'edit_calendar',
    label: '진료 예정',
    color: 'text-[#0b8043]',
    bg: 'bg-[#e6f4ea]',
    border: 'border-[#a8d5b5]',
    dot: 'bg-[#0b8043]',
  },
  report: {
    icon: 'summarize',
    label: '보고서 발송',
    color: 'text-[#6200ea]',
    bg: 'bg-[#f3e5f5]',
    border: 'border-[#ce93d8]',
    dot: 'bg-[#6200ea]',
  },
};

export default function PatientNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const path = location.pathname;

  const [showNotif, setShowNotif] = useState(false);
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS);
  const notifRef = useRef(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleClickOutside(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = () =>
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

  const markOneRead = (id) =>
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));

  const NOTIF_NAV = {
    prescription: '/patient/exercise',
    appointment: '/patient/records',
    report: '/patient/records',
  };

  return (
    <>
      {/* Top Nav */}
      <header className="bg-surface shadow-sm sticky top-0 z-50 border-b border-outline-variant">
        <div className="flex justify-between items-center w-full px-container-padding-mobile md:px-container-padding-desktop py-2 max-w-7xl mx-auto">
          <Link to="/patient/exercise">
            <img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" />
          </Link>
          <nav className="hidden md:flex items-center space-x-8">
            <Link
              to="/patient/exercise"
              className={path.includes('/exercise') ? 'nav-link-active' : 'nav-link'}
            >
              오늘의 운동
            </Link>
            <Link
              to="/patient/records"
              className={path.includes('/records') ? 'nav-link-active' : 'nav-link'}
            >
              진료 기록
            </Link>
            <Link
              to="/patient/profile"
              className={path.includes('/profile') ? 'nav-link-active' : 'nav-link'}
            >
              프로필
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {/* 알림 */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotif((v) => !v)}
                className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container transition-colors"
              >
                <span
                  className="material-symbols-outlined text-primary text-2xl"
                  style={{ fontVariationSettings: unreadCount > 0 ? "'FILL' 1" : "'FILL' 0" }}
                >
                  mail
                </span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotif && (
                <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-outline-variant z-50 overflow-hidden">
                  {/* 헤더 */}
                  <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant bg-surface-container-low">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                      <h3 className="text-title-sm font-bold text-primary">알림함</h3>
                      {unreadCount > 0 && (
                        <span className="px-2 py-0.5 bg-error text-white text-[11px] font-bold rounded-full">{unreadCount}개 미확인</span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="text-label-sm text-primary hover:underline font-semibold"
                      >
                        모두 읽음
                      </button>
                    )}
                  </div>

                  {/* 알림 목록 */}
                  <div className="max-h-[360px] overflow-y-auto divide-y divide-outline-variant">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
                        <span className="material-symbols-outlined text-outline text-4xl">mark_email_read</span>
                        <p className="text-label-md text-on-surface-variant">새로운 알림이 없습니다</p>
                      </div>
                    ) : notifications.map((n) => {
                      const cfg = TYPE_CONFIG[n.type];
                      return (
                        <button
                          key={n.id}
                          onClick={() => { markOneRead(n.id); navigate(NOTIF_NAV[n.type]); setShowNotif(false); }}
                          className={`w-full text-left px-5 py-4 flex gap-3 hover:bg-surface-container-lowest transition-colors ${n.read ? 'opacity-60' : ''}`}
                        >
                          <div className={`flex-shrink-0 w-9 h-9 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center mt-0.5`}>
                            <span className={`material-symbols-outlined text-base ${cfg.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                              {cfg.icon}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-label-sm text-on-surface-variant leading-snug">{n.message}</p>
                            <p className="text-[11px] text-outline mt-1">{n.time}</p>
                          </div>
                          {!n.read && (
                            <div className={`flex-shrink-0 w-2 h-2 rounded-full ${cfg.dot} mt-2`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { logout(); navigate('/'); }}
              className="flex items-center gap-2 group cursor-pointer active:scale-95 transition-transform duration-150"
            >
              <span className="text-on-surface-variant font-medium group-hover:text-primary text-label-md">Logout</span>
              <span className="material-symbols-outlined text-primary">logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full z-50 bg-surface shadow-lg border-t border-outline-variant px-4 py-2 flex justify-around items-center">
        <Link
          to="/patient/exercise"
          className={`flex flex-col items-center justify-center rounded-lg px-4 py-1 transition-all ${
            path.includes('/exercise')
              ? 'bg-primary-container text-white scale-90'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined">fitness_center</span>
          <span className="text-label-sm">운동</span>
        </Link>
        <Link
          to="/patient/records"
          className={`flex flex-col items-center justify-center rounded-lg px-4 py-1 transition-all ${
            path.includes('/records')
              ? 'bg-primary-container text-white scale-90'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined">description</span>
          <span className="text-label-sm">기록</span>
        </Link>
        <Link
          to="/patient/profile"
          className={`flex flex-col items-center justify-center rounded-lg px-4 py-1 transition-all ${
            path.includes('/profile')
              ? 'bg-primary-container text-white scale-90'
              : 'text-on-surface-variant hover:bg-surface-container-high'
          }`}
        >
          <span className="material-symbols-outlined">person</span>
          <span className="text-label-sm">프로필</span>
        </Link>
      </nav>
    </>
  );
}
