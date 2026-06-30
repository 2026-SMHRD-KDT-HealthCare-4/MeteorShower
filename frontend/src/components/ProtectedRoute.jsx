import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, role }) {
  const { user, token } = useAuth();

  if (!token || !user) {
    return <Navigate to={role === 'doctor' ? '/doctor/login' : '/patient/login'} replace />;
  }

  if (user.role !== role) {
    return <Navigate to={user.role === 'doctor' ? '/doctor/patients' : '/patient/exercise'} replace />;
  }

  if (role === 'patient' && user.approval_status === '대기') {
    return <Navigate to="/patient/approval" replace />;
  }

  return children;
}
