import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useAuth } from '../context/AuthContext';
import { doctorApi } from '../api';

function timeAgo(isoString) {
  if (!isoString) return '';
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return '방금 전';
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${Math.floor(diff / 86400)}일 전`;
}

const TYPE_CONFIG = {
  missed: {
    icon: 'event_busy',
    label: '운동 미수행',
    color: 'text-[#e37400]',
    bg: 'bg-[#fff3e0]',
    border: 'border-[#ffcc80]',
    dot: 'bg-[#e37400]',
  },
  운동미수행: {
    icon: 'event_busy',
    label: '운동 미수행',
    color: 'text-[#e37400]',
    bg: 'bg-[#fff3e0]',
    border: 'border-[#ffcc80]',
    dot: 'bg-[#e37400]',
  },
  운동차단: {
    icon: 'block',
    label: '운동 차단',
    color: 'text-error',
    bg: 'bg-[#fff4f4]',
    border: 'border-[#ffdad6]',
    dot: 'bg-error',
  },
  strain: {
    icon: 'warning',
    label: '과부하 감지',
    color: 'text-error',
    bg: 'bg-[#fff4f4]',
    border: 'border-[#ffdad6]',
    dot: 'bg-error',
  },
};

export default function DoctorNavBar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showProfile, setShowProfile]   = useState(false);
  const [showNotif, setShowNotif]       = useState(false);
  const [notifications, setNotifications] = useState([]);
  const profileRef = useRef(null);
  const notifRef   = useRef(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const fetchNotifications = useCallback(() => {
    doctorApi.getNotifications()
      .then(setNotifications)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setShowProfile(false);
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAllRead = () => {
    doctorApi.markAllNotificationsRead()
      .then(() => setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true }))))
      .catch(() => {});
  };

  const markOneRead = (id) => {
    doctorApi.markNotificationRead(id)
      .then(() => setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, is_read: true } : n)))
      .catch(() => {});
  };

  return (
    <header className="bg-surface shadow-sm sticky top-0 z-50 border-b border-outline-variant">
      <nav className="flex justify-between items-center w-full px-container-padding-mobile md:px-container-padding-desktop py-2 max-w-7xl mx-auto">
        <Link to="/doctor/patients">
          <img src={logo} alt="Fine Rehabilitation" className="h-12 w-auto" />
        </Link>

        <div className="flex items-center gap-3">
          <button
            onClick={() => { logout(); navigate('/'); }}
            className="flex items-center gap-2 group cursor-pointer active:scale-95 transition-transform duration-150"
          >
            <span className="text-on-surface-variant font-medium group-hover:text-doctor-primary text-label-md">Logout</span>
            <span className="material-symbols-outlined text-doctor-primary">logout</span>
          </button>

          {/* 알림 */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={() => { setShowNotif((v) => !v); setShowProfile(false); }}
              className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-surface-container transition-colors"
            >
              <span className="material-symbols-outlined text-doctor-primary text-2xl"
                style={{ fontVariationSettings: unreadCount > 0 ? "'FILL' 1" : "'FILL' 0" }}>
                mail
              </span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadCount}
                </span>
              )}
            </button>

            {showNotif && (
              <div className="absolute right-0 top-12 w-96 bg-white rounded-2xl shadow-2xl border border-outline-variant z-50 overflow-hidden">
                {/* 헤더 */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant bg-[#f0f6ff]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-doctor-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                    <h3 className="text-title-sm font-bold text-doctor-primary">알림함</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-error text-white text-[11px] font-bold rounded-full">{unreadCount}개 미확인</span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="text-label-sm text-doctor-primary hover:underline font-semibold"
                    >
                      모두 읽음
                    </button>
                  )}
                </div>

                {/* 알림 목록 */}
                <div className="max-h-[420px] overflow-y-auto divide-y divide-outline-variant">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                      <span className="material-symbols-outlined text-outline text-4xl">mark_email_read</span>
                      <p className="text-label-md text-on-surface-variant">새로운 알림이 없습니다</p>
                    </div>
                  ) : notifications.map((n) => {
                    const cfg = TYPE_CONFIG[n.type] ?? TYPE_CONFIG['missed'];
                    return (
                      <button
                        key={n.id}
                        onClick={() => {
                          markOneRead(n.id);
                          if (n.patient_id) navigate(`/doctor/patients/${n.patient_id}`);
                          setShowNotif(false);
                        }}
                        className={`w-full text-left px-5 py-4 flex gap-3 hover:bg-surface-container-lowest transition-colors ${n.is_read ? 'opacity-60' : ''}`}
                      >
                        {/* 타입 아이콘 */}
                        <div className={`flex-shrink-0 w-9 h-9 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center mt-0.5`}>
                          <span className={`material-symbols-outlined text-base ${cfg.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                            {cfg.icon}
                          </span>
                        </div>

                        {/* 내용 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                            {n.patient && <span className="text-label-sm font-bold text-on-surface">{n.patient}</span>}
                          </div>
                          <p className="text-label-sm text-on-surface-variant leading-snug">{n.message}</p>
                          <p className="text-[11px] text-outline mt-1">{timeAgo(n.created_at)}</p>
                        </div>

                        {/* 미읽음 점 */}
                        {!n.is_read && (
                          <div className={`flex-shrink-0 w-2 h-2 rounded-full ${cfg.dot} mt-2`} />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Profile icon + popup */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setShowProfile((v) => !v); setShowNotif(false); }}
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
                  <p className="text-title-md font-bold text-on-surface">{user?.hospital} {user?.name} 의사님</p>
                  <span className="mt-1 px-3 py-0.5 bg-white border border-outline-variant rounded-full text-label-sm text-on-surface-variant font-medium">
                    상지 재활 전문의
                  </span>
                </div>

                {/* Info rows */}
                <div className="px-5 py-4 space-y-3">
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
