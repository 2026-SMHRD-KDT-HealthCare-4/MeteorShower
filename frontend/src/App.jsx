import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import PublicOnlyRoute from './components/PublicOnlyRoute';

import LandingPage from './pages/LandingPage';
import PatientLogin from './pages/patient/PatientLogin';
import PatientSignup from './pages/patient/PatientSignup';
import SocialCallback from './pages/patient/SocialCallback';
import SocialSignup from './pages/patient/SocialSignup';
import TodayExercise from './pages/patient/TodayExercise';
import ExerciseSession from './pages/patient/ExerciseSession';
import MedicalRecords from './pages/patient/MedicalRecords';
import PatientProfile from './pages/patient/PatientProfile';
import DoctorLogin from './pages/doctor/DoctorLogin';
import DoctorSignup from './pages/doctor/DoctorSignup';
import DoctorPatientList from './pages/doctor/DoctorPatientList';
import ProgressReport from './pages/doctor/ProgressReport';
import PatientInfo from './pages/doctor/PatientInfo';
import PatientRegister from './pages/doctor/PatientRegister';
import DoctorProfile from './pages/doctor/DoctorProfile';
import DailyReport from './pages/doctor/DailyReport';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing */}
          <Route path="/" element={<LandingPage />} />

          {/* Patient public routes */}
          <Route path="/patient/login" element={<PublicOnlyRoute><PatientLogin /></PublicOnlyRoute>} />
          <Route path="/patient/signup" element={<PublicOnlyRoute><PatientSignup /></PublicOnlyRoute>} />
          <Route path="/patient/auth/callback/:provider" element={<SocialCallback />} />
          <Route path="/patient/auth/social-signup" element={<SocialSignup />} />

          {/* Patient protected routes */}
          <Route path="/patient/exercise" element={<ProtectedRoute role="patient"><TodayExercise /></ProtectedRoute>} />
          <Route path="/patient/exercise/session" element={<ProtectedRoute role="patient"><ExerciseSession /></ProtectedRoute>} />
          <Route path="/patient/records" element={<ProtectedRoute role="patient"><MedicalRecords /></ProtectedRoute>} />
          <Route path="/patient/profile" element={<ProtectedRoute role="patient"><PatientProfile /></ProtectedRoute>} />

          {/* Doctor public routes */}
          <Route path="/doctor/login" element={<PublicOnlyRoute><DoctorLogin /></PublicOnlyRoute>} />
          <Route path="/doctor/signup" element={<PublicOnlyRoute><DoctorSignup /></PublicOnlyRoute>} />

          {/* Doctor protected routes */}
          <Route path="/doctor/patients" element={<ProtectedRoute role="doctor"><DoctorPatientList /></ProtectedRoute>} />
          <Route path="/doctor/report/progress" element={<ProtectedRoute role="doctor"><ProgressReport /></ProtectedRoute>} />
          <Route path="/doctor/patient/info/:patientId" element={<ProtectedRoute role="doctor"><PatientInfo /></ProtectedRoute>} />
          <Route path="/doctor/patient/register" element={<ProtectedRoute role="doctor"><PatientRegister /></ProtectedRoute>} />
          <Route path="/doctor/profile" element={<ProtectedRoute role="doctor"><DoctorProfile /></ProtectedRoute>} />
          <Route path="/doctor/report/daily" element={<ProtectedRoute role="doctor"><DailyReport /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
