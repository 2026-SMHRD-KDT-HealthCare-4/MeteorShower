from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_token_payload
from models.exercise_schedule import ExerciseSchedule
from models.patient import Patient
from models.prescription import Prescription
from models.prescription_exercise import PrescriptionExercise
from models.rehab_exercise_session import RehabExerciseSession

router = APIRouter(prefix="/doctor/me", tags=["doctor-dashboard"])


def _require_doctor(payload: dict):
    if payload["role"] != "doctor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="doctor role required",
        )


def _patient_card(patient: Patient) -> dict:
    return {
        "patient_id": patient.patient_id,
        "id": patient.patient_code,
        "name": patient.name,
        "gender": patient.gender,
        "birth": patient.birth_date.isoformat() if patient.birth_date else None,
        "phone": patient.phone,
    }


def _week_range(today: date):
    start = today - timedelta(days=today.weekday())
    end = start + timedelta(days=6)
    return start, end


@router.get("/dashboard")
def get_doctor_dashboard(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_doctor(payload)
    doctor_id = int(payload["sub"])
    week_start, week_end = _week_range(date.today())

    waiting_rows = (
        db.query(Patient, RehabExerciseSession)
        .join(Prescription, Prescription.patient_id == Patient.patient_id)
        .join(PrescriptionExercise, PrescriptionExercise.prescription_id == Prescription.prescription_id)
        .join(ExerciseSchedule, ExerciseSchedule.prescription_exercise_id == PrescriptionExercise.prescription_exercise_id)
        .join(RehabExerciseSession, RehabExerciseSession.schedule_id == ExerciseSchedule.schedule_id)
        .filter(Patient.doctor_id == doctor_id)
        .order_by(RehabExerciseSession.created_at.desc())
        .all()
    )

    seen_waiting = set()
    waiting_patients = []
    for patient, session in waiting_rows:
        if patient.patient_id in seen_waiting:
            continue
        seen_waiting.add(patient.patient_id)
        waiting_patients.append(
            {
                **_patient_card(patient),
                "urgent": False,
                "reason": "운동 완료",
                "last_exercise_date": session.start_time.date().isoformat() if session.start_time else None,
            }
        )

    weekly_rows = (
        db.query(Patient)
        .join(Prescription, Prescription.patient_id == Patient.patient_id)
        .join(PrescriptionExercise, PrescriptionExercise.prescription_id == Prescription.prescription_id)
        .join(ExerciseSchedule, ExerciseSchedule.prescription_exercise_id == PrescriptionExercise.prescription_exercise_id)
        .filter(
            Patient.doctor_id == doctor_id,
            Prescription.status == "적용중",
            ExerciseSchedule.exercise_date >= week_start,
            ExerciseSchedule.exercise_date <= week_end,
        )
        .distinct()
        .all()
    )

    weekly_prescriptions = []
    for patient in weekly_rows:
        schedules = [
            schedule
            for prescription in patient.prescriptions
            if prescription.status == "적용중"
            for prescription_exercise in prescription.prescription_exercises
            for schedule in prescription_exercise.schedules
            if week_start <= schedule.exercise_date <= week_end
        ]
        done_count = sum(1 for schedule in schedules if schedule.sessions)
        weekly_prescriptions.append(
            {
                **_patient_card(patient),
                "exercises": len(schedules),
                "done": done_count,
                "status": "Completed" if schedules and done_count == len(schedules) else "In Progress",
            }
        )

    return {
        "waiting_patients": waiting_patients,
        "weekly_prescriptions": weekly_prescriptions,
    }
