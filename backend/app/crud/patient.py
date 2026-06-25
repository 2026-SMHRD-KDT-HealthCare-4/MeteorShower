from sqlalchemy import or_
from sqlalchemy.orm import Session

from models.patient import Patient
from schemas.auth import PatientSignupRequest


def get_patient_by_login_id(db: Session, login_id: str):
    return db.query(Patient).filter(Patient.login_id == login_id).first()


def get_patient_by_id(db: Session, patient_id: int):
    return db.query(Patient).filter(Patient.patient_id == patient_id).first()


def get_patients_by_doctor_id(db: Session, doctor_id: int):
    return db.query(Patient).filter(Patient.doctor_id == doctor_id).order_by(Patient.name).all()


def get_patient_by_code(db: Session, patient_code: str):
    return db.query(Patient).filter(Patient.patient_code == patient_code).first()


def create_patient(
    db: Session,
    body: PatientSignupRequest,
    hashed_password: str,
    patient_code: str,
):
    patient = Patient(
        login_id=body.login_id,
        password=hashed_password,
        name=body.name,
        phone=body.phone,
        gender=body.gender,
        birth_date=body.birth_date,
        guardian_email=body.guardian_email or None,
        report_consent=bool(body.guardian_email),
        patient_code=patient_code,
    )
    db.add(patient)
    db.commit()
    db.refresh(patient)
    return patient


def search_unassigned_patients(db: Session, q: str):
    term = f"%{q}%"
    return (
        db.query(Patient)
        .filter(
            Patient.doctor_id.is_(None),
            or_(
                Patient.login_id.ilike(term),
                Patient.patient_code.ilike(term),
                Patient.name.ilike(term),
            ),
        )
        .limit(20)
        .all()
    )


def update_patient(db: Session, patient: Patient, values: dict):
    for key, value in values.items():
        if value is not None:
            setattr(patient, key, value)
    db.commit()
    db.refresh(patient)
    return patient
