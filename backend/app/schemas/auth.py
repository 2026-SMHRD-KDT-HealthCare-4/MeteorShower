from datetime import date
from typing import Optional

from pydantic import BaseModel


class DoctorSignupRequest(BaseModel):
    login_id: str
    password: str
    name: str
    hospital_name: str
    license_number: str
    phone: str
    email: str


class PatientSignupRequest(BaseModel):
    login_id: str
    password: str
    name: str
    phone: str
    gender: str
    birth_date: date
    guardian_email: Optional[str] = None


class LoginRequest(BaseModel):
    login_id: str
    password: str
