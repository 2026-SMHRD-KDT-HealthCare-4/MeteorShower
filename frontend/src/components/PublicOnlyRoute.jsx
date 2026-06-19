import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PublicOnlyRoute({ children }) {
  const { user, token } = useAuth();

  if (token && user) {
    return <Navigate to={user.role === 'doctor' ? '/doctor/patients' : '/patient/exercise'} replace />;
  }

  return children;
}
