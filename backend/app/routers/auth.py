import os
import random
import string
from datetime import datetime, timedelta, date as date_type
from typing import Optional

import bcrypt
from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.doctor import Doctor
from models.patient import Patient

router = APIRouter(prefix="/auth", tags=["auth"])

SECRET_KEY = os.getenv("SECRET_KEY", "fallback-secret")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def _create_token(sub: str, role: str) -> str:
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def _generate_patient_code(db: Session) -> str:
    while True:
        code = "F" + "".join(random.choices(string.digits, k=12))
        if not db.query(Patient).filter(Patient.patient_code == code).first():
            return code


# ── 아이디 중복 확인 ─────────────────────────────────────────────────────────

@router.get("/doctor/check-id")
def doctor_check_id(login_id: str, db: Session = Depends(get_db)):
    exists = db.query(Doctor).filter(Doctor.login_id == login_id).first() is not None
    return {"available": not exists}


@router.get("/patient/check-id")
def patient_check_id(login_id: str, db: Session = Depends(get_db)):
    exists = db.query(Patient).filter(Patient.login_id == login_id).first() is not None
    return {"available": not exists}


# ── 의사 회원가입 ────────────────────────────────────────────────────────────

class DoctorSignupRequest(BaseModel):
    login_id: str
    password: str
    name: str
    hospital_name: str
    license_number: str
    phone: str
    email: str


@router.post("/doctor/signup", status_code=201)
def doctor_signup(body: DoctorSignupRequest, db: Session = Depends(get_db)):
    if db.query(Doctor).filter(Doctor.login_id == body.login_id).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다.")
    if db.query(Doctor).filter(Doctor.email == body.email).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
    if db.query(Doctor).filter(Doctor.license_number == body.license_number).first():
        raise HTTPException(status_code=400, detail="이미 등록된 면허 번호입니다.")

    doctor = Doctor(
        login_id=body.login_id,
        password=_hash_password(body.password),
        name=body.name,
        hospital_name=body.hospital_name,
        license_number=body.license_number,
        phone=body.phone,
        email=body.email,
    )
    db.add(doctor)
    db.commit()
    return {"message": "회원가입이 완료되었습니다."}


# ── 의사 로그인 ──────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    login_id: str
    password: str


@router.post("/doctor/login")
def doctor_login(body: LoginRequest, db: Session = Depends(get_db)):
    doctor = db.query(Doctor).filter(Doctor.login_id == body.login_id).first()
    if not doctor or not _verify_password(body.password, doctor.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    token = _create_token(str(doctor.doctor_id), "doctor")
    return {
        "token": token,
        "name": doctor.name,
        "hospital_name": doctor.hospital_name,
        "role": "doctor",
    }


# ── 환자 회원가입 ────────────────────────────────────────────────────────────

class PatientSignupRequest(BaseModel):
    login_id: str
    password: str
    name: str
    phone: str
    gender: str
    birth_date: date_type
    guardian_email: Optional[str] = None


@router.post("/patient/signup", status_code=201)
def patient_signup(body: PatientSignupRequest, db: Session = Depends(get_db)):
    if db.query(Patient).filter(Patient.login_id == body.login_id).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다.")

    patient = Patient(
        login_id=body.login_id,
        password=_hash_password(body.password),
        name=body.name,
        phone=body.phone,
        gender=body.gender,
        birth_date=body.birth_date,
        guardian_email=body.guardian_email or None,
        report_consent=bool(body.guardian_email),
        patient_code=_generate_patient_code(db),
    )
    db.add(patient)
    db.commit()
    return {"message": "회원가입이 완료되었습니다."}


# ── 환자 로그인 ──────────────────────────────────────────────────────────────

@router.post("/patient/login")
def patient_login(body: LoginRequest, db: Session = Depends(get_db)):
    patient = db.query(Patient).filter(Patient.login_id == body.login_id).first()
    if not patient or not _verify_password(body.password, patient.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    token = _create_token(str(patient.patient_id), "patient")
    return {
        "token": token,
        "name": patient.name,
        "role": "patient",
    }
