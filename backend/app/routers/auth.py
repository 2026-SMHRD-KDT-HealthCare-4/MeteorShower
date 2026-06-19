import random
import string

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from crud import doctor as doctor_crud
from crud import patient as patient_crud
from database import get_db
from schemas.auth import DoctorSignupRequest, LoginRequest, PatientSignupRequest
from security import create_token, decode_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer()

def _generate_patient_code(db: Session) -> str:
    while True:
        code = "F" + "".join(random.choices(string.digits, k=12))
        if not patient_crud.get_patient_by_code(db, code):
            return code


def _get_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    payload = decode_token(credentials.credentials)
    if not payload.get("sub") or not payload.get("role"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload


@router.get("/me")
def get_me(
    payload: dict = Depends(_get_token_payload),
    db: Session = Depends(get_db),
):
    user_id = int(payload["sub"])
    role = payload["role"]

    if role == "doctor":
        doctor = doctor_crud.get_doctor_by_id(db, user_id)
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        return {
            "id": doctor.doctor_id,
            "login_id": doctor.login_id,
            "name": doctor.name,
            "hospital_name": doctor.hospital_name,
            "role": "doctor",
        }

    if role == "patient":
        patient = patient_crud.get_patient_by_id(db, user_id)
        if not patient:
            raise HTTPException(status_code=404, detail="Patient not found")
        return {
            "id": patient.patient_id,
            "login_id": patient.login_id,
            "name": patient.name,
            "patient_code": patient.patient_code,
            "role": "patient",
        }

    raise HTTPException(status_code=401, detail="Invalid role")


# ── 아이디 중복 확인 ─────────────────────────────────────────────────────────

@router.get("/doctor/check-id")
def doctor_check_id(login_id: str, db: Session = Depends(get_db)):
    exists = doctor_crud.get_doctor_by_login_id(db, login_id) is not None
    return {"available": not exists}


@router.get("/patient/check-id")
def patient_check_id(login_id: str, db: Session = Depends(get_db)):
    exists = patient_crud.get_patient_by_login_id(db, login_id) is not None
    return {"available": not exists}


# ── 의사 회원가입 ────────────────────────────────────────────────────────────

@router.post("/doctor/signup", status_code=201)
def doctor_signup(body: DoctorSignupRequest, db: Session = Depends(get_db)):
    if doctor_crud.get_doctor_by_login_id(db, body.login_id):
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다.")
    if doctor_crud.get_doctor_by_email(db, body.email):
        raise HTTPException(status_code=400, detail="이미 사용 중인 이메일입니다.")
    if doctor_crud.get_doctor_by_license_number(db, body.license_number):
        raise HTTPException(status_code=400, detail="이미 등록된 면허 번호입니다.")

    doctor_crud.create_doctor(db, body, hash_password(body.password))
    return {"message": "회원가입이 완료되었습니다."}


# ── 의사 로그인 ──────────────────────────────────────────────────────────────

@router.post("/doctor/login")
def doctor_login(body: LoginRequest, db: Session = Depends(get_db)):
    doctor = doctor_crud.get_doctor_by_login_id(db, body.login_id)
    if not doctor or not verify_password(body.password, doctor.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    token = create_token(str(doctor.doctor_id), "doctor")
    return {
        "token": token,
        "name": doctor.name,
        "hospital_name": doctor.hospital_name,
        "role": "doctor",
    }


# ── 환자 회원가입 ────────────────────────────────────────────────────────────

@router.post("/patient/signup", status_code=201)
def patient_signup(body: PatientSignupRequest, db: Session = Depends(get_db)):
    if patient_crud.get_patient_by_login_id(db, body.login_id):
        raise HTTPException(status_code=400, detail="이미 사용 중인 아이디입니다.")

    patient_crud.create_patient(
        db,
        body,
        hash_password(body.password),
        _generate_patient_code(db),
    )
    return {"message": "회원가입이 완료되었습니다."}


# ── 환자 로그인 ──────────────────────────────────────────────────────────────

@router.post("/patient/login")
def patient_login(body: LoginRequest, db: Session = Depends(get_db)):
    patient = patient_crud.get_patient_by_login_id(db, body.login_id)
    if not patient or not verify_password(body.password, patient.password):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다.")

    token = create_token(str(patient.patient_id), "patient")
    return {
        "token": token,
        "name": patient.name,
        "role": "patient",
    }
