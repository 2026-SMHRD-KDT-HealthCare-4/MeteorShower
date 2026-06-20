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
  updatePatientMedical:   (id, body) => api.patch(`/patients/${id}/medical`, body),
};

export const doctorApi = {
  getMyProfile:    ()     => api.get('/auth/me'),
  updateMyProfile: (body) => api.patch('/auth/doctor/me', body),
};

export const authApi = {
  doctorCheckId:  (login_id)  => request('GET', `/auth/doctor/check-id?login_id=${login_id}`),
  patientCheckId: (login_id)  => request('GET', `/auth/patient/check-id?login_id=${login_id}`),

  doctorLogin:  (login_id, password) =>
    request('POST', '/auth/doctor/login',  { login_id, password }),

  patientLogin: (login_id, password) =>
    request('POST', '/auth/patient/login', { login_id, password }),

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
