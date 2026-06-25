from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class DoctorSignupRequest(BaseModel):
    login_id: str = Field(min_length=4, max_length=50, pattern=r'^[a-zA-Z0-9_]+$')
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=50)
    hospital_name: str = Field(min_length=1, max_length=100)
    license_number: str = Field(min_length=1, max_length=50)
    phone: str = Field(pattern=r'^\d{2,3}-\d{3,4}-\d{4}$')
    email: EmailStr


class PatientSignupRequest(BaseModel):
    login_id: str = Field(min_length=4, max_length=50, pattern=r'^[a-zA-Z0-9_]+$')
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=50)
    phone: str = Field(pattern=r'^\d{2,3}-\d{3,4}-\d{4}$')
    gender: Literal['남', '여']
    birth_date: date
    guardian_email: Optional[EmailStr] = None


class LoginRequest(BaseModel):
    login_id: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=1, max_length=128)


class DoctorProfileUpdateRequest(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, pattern=r'^\d{2,3}-\d{3,4}-\d{4}$')
