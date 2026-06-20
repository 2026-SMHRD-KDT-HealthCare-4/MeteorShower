from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date

from crud import doctor as doctor_crud
from crud import patient as patient_crud
from database import get_db
from dependencies import get_token_payload
from models.exercise import Exercise
from models.prescription import Prescription
from models.prescription_exercise import PrescriptionExercise
from models.exercise_schedule import ExerciseSchedule
from schemas.patient import PatientAssignRequest, PatientMedicalUpdateRequest, PatientUpdateRequest
from schemas.prescription import PrescriptionSaveRequest

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


@router.patch("/{patient_id}/medical")
def update_patient_medical(
    patient_id: int,
    body: PatientMedicalUpdateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    updated = patient_crud.update_patient(db, patient, body.model_dump(exclude_unset=True))
    return _patient_to_dict(updated)


@router.get("/me/today-exercises")
def get_my_today_exercises(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])
    today = date.today()

    prescriptions = (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient_id, Prescription.status == "적용중")
        .order_by(Prescription.prescription_date.desc())
        .all()
    )

    exercises = []
    for prescription in prescriptions:
        for pe in sorted(prescription.prescription_exercises, key=lambda x: x.exercise_order):
            scheduled_today = any(s.exercise_date == today for s in pe.schedules)
            if pe.schedules and not scheduled_today:
                continue
            exercises.append({
                "id": pe.prescription_exercise_id,
                "exercise_id": pe.exercise_id,
                "name": pe.exercise.exercise_name,
                "sets": pe.target_sets,
                "reps": pe.target_reps,
                "duration": f"{max(1, pe.target_sets * pe.target_reps * 3 // 60)}분",
                "status": "waiting",
                "videoTime": "01:20",
            })

    return exercises


@router.post("/{patient_id}/prescriptions", status_code=201)
def save_patient_prescription(
    patient_id: int,
    body: PrescriptionSaveRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")

    enabled_exercises = [ex for ex in body.exercises if ex.enabled]
    if not enabled_exercises:
        raise HTTPException(status_code=422, detail="At least one exercise is required")

    (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient_id, Prescription.status == "적용중")
        .update({"status": "종료"})
    )

    prescription = Prescription(
        patient_id=patient_id,
        doctor_id=int(payload["sub"]),
        prescription_date=body.prescription_date or date.today(),
        rehab_phase=body.rehab_phase or patient.current_rehab_phase or "초기",
        status="적용중",
    )
    db.add(prescription)
    db.flush()

    for order, ex in enumerate(enabled_exercises, start=1):
        exercise = db.query(Exercise).filter(Exercise.exercise_name == ex.name).first()
        if not exercise:
            exercise = Exercise(
                exercise_name=ex.name,
                reference_motion={},
                estimated_duration=ex.sets * ex.reps * 3,
            )
            db.add(exercise)
            db.flush()

        prescription_exercise = PrescriptionExercise(
            prescription_id=prescription.prescription_id,
            exercise_id=exercise.exercise_id,
            target_sets=ex.sets,
            target_reps=ex.reps,
            exercise_order=order,
        )
        db.add(prescription_exercise)
        db.flush()

        for key, enabled in body.schedule.items():
            if not enabled:
                continue
            name, _, date_text = key.partition("|")
            if name != ex.name or not date_text:
                continue
            db.add(
                ExerciseSchedule(
                    prescription_exercise_id=prescription_exercise.prescription_exercise_id,
                    exercise_date=date.fromisoformat(date_text),
                )
            )

    db.commit()
    db.refresh(prescription)
    return {"prescription_id": prescription.prescription_id}


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
