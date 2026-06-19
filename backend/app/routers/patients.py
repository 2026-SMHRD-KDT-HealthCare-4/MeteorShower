from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from crud import doctor as doctor_crud
from crud import patient as patient_crud
from database import get_db
from dependencies import get_token_payload
from models.prescription import Prescription
from schemas.patient import PatientAssignRequest, PatientUpdateRequest

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


@router.get("/search")
def search_patients(
    q: str,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    if not q or not q.strip():
        return []
    patients = patient_crud.search_unassigned_patients(db, q.strip())
    return [_patient_to_dict(p) for p in patients]


@router.patch("/{patient_id}/register")
def assign_patient(
    patient_id: int,
    body: PatientAssignRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id is not None:
        raise HTTPException(status_code=409, detail="이미 담당 의사가 있는 환자입니다.")

    doctor = doctor_crud.get_doctor_by_id(db, int(payload["sub"]))
    values = body.model_dump(exclude_unset=True)
    values["doctor_id"] = int(payload["sub"])
    if doctor:
        values["hospital_name"] = doctor.hospital_name

    updated = patient_crud.update_patient(db, patient, values)
    return _patient_to_dict(updated)


@router.get("/{patient_id}/prescriptions")
def get_patient_prescriptions(
    patient_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")

    prescriptions = (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient_id)
        .order_by(Prescription.prescription_date.desc())
        .all()
    )

    current = next((p for p in prescriptions if p.status == "적용중"), None)
    if current is None and prescriptions:
        current = prescriptions[0]
    if current is None:
        return None

    exercises = []
    schedule = {}
    for pe in sorted(current.prescription_exercises, key=lambda x: x.exercise_order):
        exercises.append({
            "exercise_id": pe.exercise_id,
            "name": pe.exercise.exercise_name,
            "sets": pe.target_sets,
            "reps": pe.target_reps,
            "enabled": True,
        })
        for s in pe.schedules:
            schedule[f"{pe.exercise.exercise_name}|{s.exercise_date.isoformat()}"] = True

    return {
        "prescription_id": current.prescription_id,
        "saved_at": current.prescription_date.isoformat() if current.prescription_date else None,
        "rehab_phase": current.rehab_phase,
        "status": current.status,
        "exercises": exercises,
        "schedule": schedule,
    }


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
