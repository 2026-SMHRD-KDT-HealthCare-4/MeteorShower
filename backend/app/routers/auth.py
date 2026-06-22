import os
import random
import secrets
import string
import uuid

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from crud import doctor as doctor_crud
from crud import patient as patient_crud
from database import get_db
from dependencies import get_token_payload
from models.patient import Patient
from models.social_account import SocialAccount
from schemas.auth import DoctorSignupRequest, LoginRequest, PatientSignupRequest
from security import create_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])

KAKAO_CLIENT_ID     = os.getenv("KAKAO_CLIENT_ID", "")
KAKAO_CLIENT_SECRET = os.getenv("KAKAO_CLIENT_SECRET", "")
GOOGLE_CLIENT_ID   = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")
NAVER_CLIENT_ID    = os.getenv("NAVER_CLIENT_ID", "")
NAVER_CLIENT_SECRET = os.getenv("NAVER_CLIENT_SECRET", "")
FRONTEND_URL       = os.getenv("FRONTEND_URL", "http://localhost:5173")


async def _get_kakao_user_info(code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://kauth.kakao.com/oauth/token",
            data={
                "grant_type": "authorization_code",
                "client_id": KAKAO_CLIENT_ID,
                "client_secret": KAKAO_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "code": code,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        token_data = token_res.json()
        print(f"[Kakao Token Response] {token_data}")
        access_token = token_data.get("access_token")
        if not access_token:
            raise Exception(f"카카오 토큰 발급 실패: {token_data}")
        user_res = await client.get(
            "https://kapi.kakao.com/v2/user/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        data = user_res.json()
        kakao_account = data.get("kakao_account", {})
        profile = kakao_account.get("profile", {})
        return {
            "id": str(data["id"]),
            "name": profile.get("nickname", ""),
            "email": kakao_account.get("email", ""),
        }


async def _get_google_user_info(code: str, redirect_uri: str) -> dict:
    async with httpx.AsyncClient() as client:
        token_res = await client.post(
            "https://oauth2.googleapis.com/token",
            json={
                "code": code,
                "client_id": GOOGLE_CLIENT_ID,
                "client_secret": GOOGLE_CLIENT_SECRET,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )
        access_token = token_res.json().get("access_token")
        user_res = await client.get(
            "https://www.googleapis.com/userinfo/v2/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        data = user_res.json()
        return {
            "id": data["id"],
            "name": data.get("name", ""),
            "email": data.get("email", ""),
        }


async def _get_naver_user_info(code: str, redirect_uri: str, state: str) -> dict:
    async with httpx.AsyncClient() as client:
        token_res = await client.get(
            "https://nid.naver.com/oauth2.0/token",
            params={
                "grant_type": "authorization_code",
                "client_id": NAVER_CLIENT_ID,
                "client_secret": NAVER_CLIENT_SECRET,
                "code": code,
                "state": state,
            },
        )
        access_token = token_res.json().get("access_token")
        user_res = await client.get(
            "https://openapi.naver.com/v1/nid/me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        resp = user_res.json().get("response", {})
        return {
            "id": resp.get("id", ""),
            "name": resp.get("name", ""),
            "email": resp.get("email", ""),
            "phone": resp.get("mobile", ""),
        }

def _generate_patient_code(db: Session) -> str:
    while True:
        code = "F" + "".join(random.choices(string.digits, k=12))
        if not patient_crud.get_patient_by_code(db, code):
            return code


@router.get("/me")
def get_me(
    payload: dict = Depends(get_token_payload),
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
            "email": doctor.email,
            "phone": doctor.phone,
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


@router.patch("/doctor/me")
def update_doctor_profile(
    body: dict,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    if payload["role"] != "doctor":
        raise HTTPException(status_code=403, detail="doctor role required")
    doctor = doctor_crud.get_doctor_by_id(db, int(payload["sub"]))
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    allowed = {k: v for k, v in body.items() if k in ("email", "phone")}
    updated = doctor_crud.update_doctor(db, doctor, allowed)
    return {
        "id": updated.doctor_id,
        "login_id": updated.login_id,
        "name": updated.name,
        "hospital_name": updated.hospital_name,
        "email": updated.email,
        "phone": updated.phone,
        "role": "doctor",
    }


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


# ── 소셜 로그인 ──────────────────────────────────────────────────────────────

@router.get("/social/{provider}/url")
def get_social_login_url(provider: str, redirect_uri: str):
    if provider == "kakao":
        url = (
            f"https://kauth.kakao.com/oauth/authorize"
            f"?client_id={KAKAO_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
        )
    elif provider == "google":
        url = (
            f"https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id={GOOGLE_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}"
            f"&response_type=code"
            f"&scope=email+profile"
        )
    elif provider == "naver":
        state = secrets.token_hex(8)
        url = (
            f"https://nid.naver.com/oauth2.0/authorize"
            f"?response_type=code"
            f"&client_id={NAVER_CLIENT_ID}"
            f"&redirect_uri={redirect_uri}"
            f"&state={state}"
        )
    else:
        raise HTTPException(status_code=400, detail="지원하지 않는 소셜 플랫폼입니다.")
    return {"url": url}


@router.post("/social/{provider}")
async def social_login(provider: str, request: Request, db: Session = Depends(get_db)):
    if provider not in ("kakao", "google", "naver"):
        raise HTTPException(status_code=400, detail="지원하지 않는 소셜 플랫폼입니다.")

    body = await request.json()
    code = body.get("code")
    redirect_uri = body.get("redirect_uri")
    state = body.get("state", "")

    try:
        if provider == "kakao":
            user_info = await _get_kakao_user_info(code, redirect_uri)
        elif provider == "google":
            user_info = await _get_google_user_info(code, redirect_uri)
        else:
            user_info = await _get_naver_user_info(code, redirect_uri, state)
    except Exception as e:
        print(f"[Social Login Error] {provider}: {e}")
        raise HTTPException(status_code=400, detail=f"소셜 로그인 오류: {str(e)}")

    social_account = db.query(SocialAccount).filter(
        SocialAccount.social_platform == provider,
        SocialAccount.social_user_id == user_info["id"],
    ).first()

    if social_account:
        patient = social_account.patient
        token = create_token(str(patient.patient_id), "patient")
        return {"token": token, "name": patient.name, "role": "patient"}

    return {
        "status": "need_signup",
        "social_platform": provider,
        "social_user_id": user_info["id"],
        "name": user_info.get("name", ""),
        "email": user_info.get("email", ""),
        "phone": user_info.get("phone", ""),
    }


@router.post("/social-signup", status_code=201)
async def social_signup(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    social_platform = body.get("social_platform")
    social_user_id  = body.get("social_user_id")
    name       = body.get("name")
    birth_date = body.get("birth_date")
    gender     = body.get("gender")
    phone      = body.get("phone")

    if not all([social_platform, social_user_id, name, birth_date, gender, phone]):
        raise HTTPException(status_code=400, detail="필수 정보가 누락되었습니다.")

    existing = db.query(SocialAccount).filter(
        SocialAccount.social_platform == social_platform,
        SocialAccount.social_user_id == social_user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 연동된 소셜 계정입니다.")

    login_id = f"{social_platform}_{social_user_id}"
    if patient_crud.get_patient_by_login_id(db, login_id):
        login_id = f"{social_platform}_{social_user_id}_{uuid.uuid4().hex[:6]}"

    patient = Patient(
        login_id=login_id,
        password=hash_password(uuid.uuid4().hex),
        name=name,
        birth_date=birth_date,
        gender=gender,
        phone=phone,
        patient_code=_generate_patient_code(db),
    )
    db.add(patient)
    db.flush()

    db.add(SocialAccount(
        patient_id=patient.patient_id,
        social_platform=social_platform,
        social_user_id=social_user_id,
    ))
    db.commit()
    db.refresh(patient)

    token = create_token(str(patient.patient_id), "patient")
    return {"token": token, "name": patient.name, "role": "patient"}
