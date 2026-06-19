from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from crud import patient as patient_crud
from database import get_db
from dependencies import get_token_payload
from schemas.patient import PatientUpdateRequest

router = APIRouter(prefix="/patients", tags=["patients"])


def _patient_to_dict(patient):
    return {
        "patient_id": patient.patient_id,
        "doctor_id": patient.doctor_id,
        "login_id": patient.login_id,
        "name": patient.name,
        "birth_date": patient.birth_date,
        "gender": patient.gender,
        "phone": patient.phone,
        "patient_code": patient.patient_code,
        "hospital_name": patient.hospital_name,
        "surgery_name": patient.surgery_name,
        "surgery_area": patient.surgery_area,
        "surgery_date": patient.surgery_date,
        "rehab_start_date": patient.rehab_start_date,
        "current_rehab_phase": patient.current_rehab_phase,
        "guardian_email": patient.guardian_email,
        "report_consent": patient.report_consent,
        "ai_difficulty_enabled": patient.ai_difficulty_enabled,
        "appointment_date": patient.appointment_date,
    }


def _require_role(payload: dict, role: str):
    if payload["role"] != role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{role} role required",
        )


@router.get("/me")
def get_my_patient_profile(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "patient")
    patient = patient_crud.get_patient_by_id(db, int(payload["sub"]))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _patient_to_dict(patient)


@router.patch("/me")
def update_my_patient_profile(
    body: PatientUpdateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "patient")
    patient = patient_crud.get_patient_by_id(db, int(payload["sub"]))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    updated = patient_crud.update_patient(
        db,
        patient,
        body.model_dump(exclude_unset=True),
    )
    return _patient_to_dict(updated)


@router.get("")
def list_my_patients(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    patients = patient_crud.get_patients_by_doctor_id(db, int(payload["sub"]))
    return [_patient_to_dict(patient) for patient in patients]


@router.get("/{patient_id}")
def get_patient_detail(
    patient_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor_id = int(payload["sub"])
    if patient.doctor_id is not None and patient.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail="Cannot access this patient")

    return _patient_to_dict(patient)
