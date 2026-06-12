import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import LandingPage from './pages/LandingPage';
import PatientLogin from './pages/patient/PatientLogin';
import PatientSignup from './pages/patient/PatientSignup';
import TodayExercise from './pages/patient/TodayExercise';
import ExerciseSession from './pages/patient/ExerciseSession';
import MedicalRecords from './pages/patient/MedicalRecords';
import PatientProfile from './pages/patient/PatientProfile';
import DoctorLogin from './pages/doctor/DoctorLogin';
import DoctorSignup from './pages/doctor/DoctorSignup';
import DoctorPatientList from './pages/doctor/DoctorPatientList';
import WeeklyReport from './pages/doctor/WeeklyReport';
import ProgressReport from './pages/doctor/ProgressReport';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<LandingPage />} />

        {/* Patient routes */}
        <Route path="/patient/login" element={<PatientLogin />} />
        <Route path="/patient/signup" element={<PatientSignup />} />
        <Route path="/patient/exercise" element={<TodayExercise />} />
        <Route path="/patient/exercise/session" element={<ExerciseSession />} />
        <Route path="/patient/records" element={<MedicalRecords />} />
        <Route path="/patient/profile" element={<PatientProfile />} />

        {/* Doctor routes */}
        <Route path="/doctor/login" element={<DoctorLogin />} />
        <Route path="/doctor/signup" element={<DoctorSignup />} />
        <Route path="/doctor/patients" element={<DoctorPatientList />} />
        <Route path="/doctor/report/weekly" element={<WeeklyReport />} />
        <Route path="/doctor/report/progress" element={<ProgressReport />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
