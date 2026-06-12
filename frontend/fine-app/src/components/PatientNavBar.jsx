import { Link, useLocation, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function PatientNavBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;

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
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 group cursor-pointer active:scale-95 transition-transform duration-150"
          >
            <span className="text-on-surface-variant font-medium group-hover:text-primary">Logout</span>
            <span className="material-symbols-outlined text-primary">logout</span>
          </button>
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
