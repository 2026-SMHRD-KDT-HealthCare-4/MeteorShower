import { Link, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';

export default function DoctorNavBar() {
  const navigate = useNavigate();

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
          <span className="material-symbols-outlined text-doctor-primary text-3xl cursor-pointer">account_circle</span>
        </div>
      </nav>
    </header>
  );
}
