from sqlalchemy.orm import Session

from models.doctor import Doctor
from schemas.auth import DoctorSignupRequest


def get_doctor_by_login_id(db: Session, login_id: str):
    return db.query(Doctor).filter(Doctor.login_id == login_id).first()


def get_doctor_by_id(db: Session, doctor_id: int):
    return db.query(Doctor).filter(Doctor.doctor_id == doctor_id).first()


def get_doctor_by_email(db: Session, email: str):
    return db.query(Doctor).filter(Doctor.email == email).first()


def get_doctor_by_license_number(db: Session, license_number: str):
    return db.query(Doctor).filter(Doctor.license_number == license_number).first()


def update_doctor(db: Session, doctor, values: dict):
    for key, value in values.items():
        if value is not None:
            setattr(doctor, key, value)
    db.commit()
    db.refresh(doctor)
    return doctor


def create_doctor(db: Session, body: DoctorSignupRequest, hashed_password: str):
    doctor = Doctor(
        login_id=body.login_id,
        password=hashed_password,
        name=body.name,
        hospital_name=body.hospital_name,
        license_number=body.license_number,
        phone=body.phone,
        email=body.email,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor
