from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import date, datetime

from crud import doctor as doctor_crud
from crud import patient as patient_crud
from database import get_db
from dependencies import get_token_payload
from models.doctor_notification import DoctorNotification
from models.exercise import Exercise
from models.patient_notification import PatientNotification
from models.prescription import Prescription
from models.prescription_exercise import PrescriptionExercise
from models.exercise_schedule import ExerciseSchedule
from models.patient_rom_setting import PatientRomSetting
from models.prescription_finger_setting import PrescriptionFingerSetting
from models.rehab_exercise_session import RehabExerciseSession
from models.rehab_exercise_log import RehabExerciseLog
from models.finger_accuracy import FingerAccuracy
from schemas.patient import (
    ExerciseSessionCreateRequest,
    PatientAssignRequest,
    PatientMedicalUpdateRequest,
    PatientRomUpdateRequest,
    PatientUpdateRequest,
)
from schemas.prescription import PrescriptionSaveRequest

router = APIRouter(prefix="/patients", tags=["patients"])

FINGER_LABELS = {
    "thumb": "엄지",
    "index": "검지",
    "middle": "중지",
    "ring": "약지",
    "pinky": "소지",
}


def _hand_type_from_exercise_name(name: str):
    if "왼손" in name:
        return "왼손"
    if "오른손" in name:
        return "오른손"
    return "오른손"


def _parse_rom_key(key: str):
    # format: {finger_key}_{joint_type}_{hand_type}  e.g. thumb_MCP_왼손
    parts = key.split("_", 2)
    if len(parts) != 3:
        return None
    finger_key, joint_type, hand_type = parts
    finger_type = FINGER_LABELS.get(finger_key)
    if not finger_type or joint_type not in {"MCP", "PIP", "DIP"} or hand_type not in {"왼손", "오른손"}:
        return None
    return finger_type, joint_type, hand_type


def _rom_settings_to_dict(settings):
    rom = {}
    for setting in settings:
        finger_key = next(
            (key for key, value in FINGER_LABELS.items() if value == setting.finger_type),
            None,
        )
        if finger_key:
            rom[f"{finger_key}_{setting.joint_type}_{setting.hand_type}"] = float(setting.target_rom)
    return rom


def _get_patient_rom(db: Session, patient_id: int, exercise_type: str = 'grip'):
    return (
        db.query(PatientRomSetting)
        .filter(
            PatientRomSetting.patient_id == patient_id,
            PatientRomSetting.exercise_type == exercise_type,
        )
        .all()
    )


def _save_patient_rom(db: Session, patient_id: int, exercise_type: str, rom: dict):
    db.query(PatientRomSetting).filter(
        PatientRomSetting.patient_id == patient_id,
        PatientRomSetting.exercise_type == exercise_type,
    ).delete()
    for key, target_rom in rom.items():
        parsed = _parse_rom_key(key)
        if not parsed or target_rom in (None, ""):
            continue
        finger_type, joint_type, hand_type = parsed
        db.add(
            PatientRomSetting(
                patient_id=patient_id,
                exercise_type=exercise_type,
                hand_type=hand_type,
                finger_type=finger_type,
                joint_type=joint_type,
                target_rom=target_rom,
            )
        )
    db.commit()
    return _rom_settings_to_dict(_get_patient_rom(db, patient_id, exercise_type))


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
        "doctor_name": patient.doctor.name if patient.doctor else None,
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


@router.get("/{patient_id}/rom")
def get_patient_rom(
    patient_id: int,
    exercise_type: str = 'grip',
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    return {"rom": _rom_settings_to_dict(_get_patient_rom(db, patient_id, exercise_type))}


@router.patch("/{patient_id}/rom")
def update_patient_rom(
    patient_id: int,
    body: PatientRomUpdateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    return {"rom": _save_patient_rom(db, patient_id, body.exercise_type, body.rom)}


@router.post("/me/exercise-blocked", status_code=201)
def report_exercise_blocked(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])

    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if not patient.doctor_id:
        return {"message": "담당 의사 없음"}

    db.add(DoctorNotification(
        doctor_id=patient.doctor_id,
        patient_id=patient_id,
        notification_type="운동차단",
        notification_content=f"{patient.name} 환자가 사전 문진에서 증상을 호소하여 운동이 차단되었습니다.",
        is_read=False,
    ))
    db.commit()
    return {"message": "의사에게 알림이 전송되었습니다."}


@router.get("/me/schedule")
def get_my_schedule(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])
    today = date.today()

    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    result = []

    # 운동 일정: 적용중 처방의 exercise_schedule 전체
    prescriptions = (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient_id, Prescription.status == "적용중")
        .all()
    )
    for prescription in prescriptions:
        for pe in prescription.prescription_exercises:
            for schedule in pe.schedules:
                ex_date = schedule.exercise_date
                if ex_date < today:
                    status = "done" if schedule.sessions else "missed"
                else:
                    status = "upcoming"
                result.append({
                    "date": ex_date.isoformat(),
                    "type": "exercise",
                    "status": status,
                })

    # 진료 예정일
    if patient.appointment_date:
        appt_date = patient.appointment_date
        status = "done" if appt_date < today else "upcoming"
        result.append({
            "date": appt_date.isoformat(),
            "type": "hospital",
            "status": status,
        })

    return result


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
            today_schedule = next((s for s in pe.schedules if s.exercise_date == today), None)
            scheduled_today = today_schedule is not None
            if pe.schedules and not scheduled_today:
                continue
            exercises.append({
                "id": pe.prescription_exercise_id,
                "schedule_id": today_schedule.schedule_id if today_schedule else None,
                "exercise_id": pe.exercise_id,
                "name": pe.exercise.exercise_name,
                "sets": pe.target_sets,
                "reps": pe.target_reps,
                "duration": f"{max(1, pe.target_sets * pe.target_reps * 3 // 60)}분",
                "status": "done" if today_schedule and today_schedule.sessions else "waiting",
                "videoTime": "01:20",
            })

    return exercises


@router.post("/me/exercise-sessions", status_code=201)
def create_my_exercise_session(
    body: ExerciseSessionCreateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])

    schedule = db.query(ExerciseSchedule).filter(ExerciseSchedule.schedule_id == body.schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Exercise schedule not found")

    prescription = schedule.prescription_exercise.prescription
    if prescription.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Cannot access this schedule")

    existing = (
        db.query(RehabExerciseSession)
        .filter(RehabExerciseSession.schedule_id == body.schedule_id)
        .first()
    )
    if existing:
        log = existing.logs[0] if existing.logs else None
        return {
            "rehab_session_id": existing.rehab_session_id,
            "rehab_exercise_log_id": log.rehab_exercise_log_id if log else None,
            "already_saved": True,
        }

    now = datetime.now()
    session = RehabExerciseSession(schedule_id=body.schedule_id, start_time=now)
    db.add(session)
    db.flush()

    log = RehabExerciseLog(
        rehab_session_id=session.rehab_session_id,
        performed_reps=body.performed_reps,
        performed_sets=body.performed_sets,
        progress_rate=body.progress_rate,
        end_time=now,
        end_type=body.end_type,
    )
    db.add(log)
    db.flush()

    for item in body.finger_accuracy:
        db.add(
            FingerAccuracy(
                rehab_exercise_log_id=log.rehab_exercise_log_id,
                hand_type=item.hand_type,
                finger_type=item.finger_type,
                accuracy=item.accuracy,
                rom=item.rom,
            )
        )

    db.commit()
    db.refresh(session)
    return {
        "rehab_session_id": session.rehab_session_id,
        "rehab_exercise_log_id": log.rehab_exercise_log_id,
        "already_saved": False,
    }


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

        for key, target_rom in body.rom.items():
            parsed = _parse_rom_key(key)
            if not parsed or target_rom in (None, ""):
                continue
            finger_type, joint_type, hand_type = parsed
            db.add(
                PrescriptionFingerSetting(
                    prescription_exercise_id=prescription_exercise.prescription_exercise_id,
                    hand_type=hand_type,
                    finger_type=finger_type,
                    joint_type=joint_type,
                    target_rom=target_rom,
                )
            )

    db.add(PatientNotification(
        patient_id=patient_id,
        notification_type="처방등록",
        notification_content="담당 의사가 새 운동 처방을 등록했습니다.",
        is_read=False,
    ))

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
    rom = _rom_settings_to_dict(_get_patient_rom(db, patient_id, 'grip'))
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
        for setting in pe.finger_settings:
            finger_key = next(
                (key for key, value in FINGER_LABELS.items() if value == setting.finger_type),
                None,
            )
            if finger_key:
                rom[f"{finger_key}_{setting.joint_type}_{setting.hand_type}"] = float(setting.target_rom)

    return {
        "prescription_id": current.prescription_id,
        "saved_at": current.prescription_date.isoformat() if current.prescription_date else None,
        "rehab_phase": current.rehab_phase,
        "status": current.status,
        "exercises": exercises,
        "schedule": schedule,
        "rom": rom,
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
