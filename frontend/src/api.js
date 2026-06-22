const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8001';

function getToken() {
  return localStorage.getItem('token') ?? sessionStorage.getItem('token');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };

  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? '서버 오류가 발생했습니다.');
  }

  return res.json();
}

export const api = {
  get:    (path)        => request('GET',    path),
  post:   (path, body)  => request('POST',   path, body),
  patch:  (path, body)  => request('PATCH',  path, body),
  put:    (path, body)  => request('PUT',    path, body),
  delete: (path)        => request('DELETE', path),
};

export const patientApi = {
  getMyProfile:    ()         => api.get('/patients/me'),
  updateMyProfile: (body)     => api.patch('/patients/me', body),
  listPatients:    ()         => api.get('/patients'),
  getPatient:      (id)       => api.get(`/patients/${id}`),
  searchPatients:       (q)        => api.get(`/patients/search?q=${encodeURIComponent(q)}`),
  assignPatient:        (id, body) => api.patch(`/patients/${id}/register`, body),
  getPatientPrescription:  (id)       => api.get(`/patients/${id}/prescriptions`),
  savePatientPrescription: (id, body) => api.post(`/patients/${id}/prescriptions`, body),
  updatePatientMedical:   (id, body) => api.patch(`/patients/${id}/medical`, body),
  getPatientRom:          (id, exerciseType = 'grip') => api.get(`/patients/${id}/rom?exercise_type=${exerciseType}`),
  updatePatientRom:       (id, body) => api.patch(`/patients/${id}/rom`, body),
  getTodayExercises:      ()         => api.get('/patients/me/today-exercises'),
  getWeeklyStats:         ()         => api.get('/patients/me/weekly-stats'),
  getMySchedule:          ()         => api.get('/patients/me/schedule'),
  getNotifications:         ()   => api.get('/patients/me/notifications'),
  markNotificationRead:     (id) => api.patch(`/patients/me/notifications/${id}/read`),
  markAllNotificationsRead: ()   => api.patch('/patients/me/notifications/read-all'),
  reportExerciseBlocked:    ()   => api.post('/patients/me/exercise-blocked'),
  getNearbyHospitals:       (lat, lng, radius = 2000) => api.get(`/patients/me/nearby-hospitals?lat=${lat}&lng=${lng}&radius=${radius}`),
  saveExerciseSession:      (body) => api.post('/patients/me/exercise-sessions', body),
};

export const doctorApi = {
  getMyProfile:    ()     => api.get('/auth/me'),
  updateMyProfile: (body) => api.patch('/auth/doctor/me', body),
  getNotifications:         ()   => api.get('/doctor/me/notifications'),
  markNotificationRead:     (id) => api.patch(`/doctor/me/notifications/${id}/read`),
  markAllNotificationsRead: ()   => api.patch('/doctor/me/notifications/read-all'),
  getDashboard:             ()   => api.get('/doctor/me/dashboard'),
};

export const reportApi = {
  createMockReport:    (body)     => api.post('/reports/mock', body),
  getDoctorReports:    ()         => api.get('/doctor/me/reports'),
  getDoctorReport:     (id)       => api.get(`/doctor/me/reports/${id}`),
  updateDoctorReport:  (id, body) => api.patch(`/doctor/me/reports/${id}`, body),
  approveDoctorReport: (id, body = {}) => api.patch(`/doctor/me/reports/${id}/approve`, body),
  getPatientReports:   ()         => api.get('/patients/me/reports'),
  getPatientReport:    (id)       => api.get(`/patients/me/reports/${id}`),
};

export const authApi = {
  doctorCheckId:  (login_id)  => request('GET', `/auth/doctor/check-id?login_id=${login_id}`),
  patientCheckId: (login_id)  => request('GET', `/auth/patient/check-id?login_id=${login_id}`),

  doctorLogin:  (login_id, password) =>
    request('POST', '/auth/doctor/login',  { login_id, password }),

  patientLogin: (login_id, password) =>
    request('POST', '/auth/patient/login', { login_id, password }),

  getSocialLoginUrl: (provider, redirectUri) =>
    request('GET', `/auth/social/${provider}/url?redirect_uri=${encodeURIComponent(redirectUri)}`),
  socialLogin: (provider, body) => request('POST', `/auth/social/${provider}`, body),
  socialSignup: (body) => request('POST', '/auth/social-signup', body),

  doctorSignup: (form) =>
    request('POST', '/auth/doctor/signup', {
      login_id:       form.username,
      password:       form.password,
      name:           form.name,
      hospital_name:  form.hospital,
      license_number: form.license,
      phone:          form.phone,
      email:          form.email,
    }),

  patientSignup: (form) =>
    request('POST', '/auth/patient/signup', {
      login_id:      form.username,
      password:      form.password,
      name:          form.name,
      phone:         form.phone,
      gender:        form.gender,
      birth_date:    form.birth,
      guardian_email: form.guardianEmail || null,
    }),
};
