import os
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session
from datetime import date, datetime, timedelta

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
from models.llm_report import LlmReport
from models.patient_rom_setting import PatientRomSetting
from models.prescription_finger_setting import PrescriptionFingerSetting
from models.rehab_exercise_session import RehabExerciseSession
from models.rehab_exercise_capture import RehabExerciseCapture
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
from services.llm_report_generator import generate_daily_report_content, generate_monthly_report_summary
from services.firebase_storage import upload_bytes_to_firebase

router = APIRouter(prefix="/patients", tags=["patients"])

KAKAO_REST_KEY = os.getenv("KAKAO_CLIENT_ID", "")

FINGER_LABELS = {
    "thumb": "엄지",
    "index": "검지",
    "middle": "중지",
    "ring": "약지",
    "pinky": "소지",
}


def _hand_type_from_exercise_name(name: str) -> str:
    # 운동명에 "왼손" 포함 여부로 손 구분, 명시 없으면 오른손 기본값
    if "왼손" in name:
        return "왼손"
    if "오른손" in name:
        return "오른손"
    return "오른손"


# 가이드 영상 실제 길이(ai/guide_videos/*.mp4) 기준. 운동 종류별로 다름.
def _video_time_for_exercise(name: str) -> str:
    if "태핑" in name or "Tapping" in name or "두드리기" in name:
        return "00:24"
    return "00:14"


def _avg_or_none(values) -> float | None:
    values = [float(value) for value in values if value is not None]
    return round(sum(values) / len(values), 1) if values else None


def _round_or_none(value) -> float | None:
    return round(float(value), 1) if value is not None else None


def _collect_active_schedule_maps(db: Session, patient_id: int) -> tuple[dict, dict]:
    # 적용중인 처방의 스케줄을 완료(세션 있음)와 미완료(재사용 가능)로 분류하여 반환
    reusable_schedules = {}
    completed_schedules = {}
    active_prescriptions = (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient_id, Prescription.status == "적용중")
        .all()
    )
    for prescription in active_prescriptions:
        for prescription_exercise in prescription.prescription_exercises:
            exercise_name = prescription_exercise.exercise.exercise_name
            for schedule in prescription_exercise.schedules:
                key = (exercise_name, schedule.exercise_date)
                target = completed_schedules if schedule.sessions else reusable_schedules
                target.setdefault(key, []).append(schedule)
    return reusable_schedules, completed_schedules


def _pop_reusable_schedule(schedule_map: dict, exercise_name: str, exercise_date: date) -> ExerciseSchedule | None:
    schedules = schedule_map.get((exercise_name, exercise_date))
    if not schedules:
        return None
    schedule = schedules.pop(0)
    if not schedules:
        schedule_map.pop((exercise_name, exercise_date), None)
    return schedule


def _first_schedule_log(schedule: ExerciseSchedule) -> RehabExerciseLog | None:
    session = schedule.sessions[0] if schedule.sessions else None
    return session.logs[0] if session and session.logs else None


def _progress_from_log(log) -> int:
    if not log or log.progress_rate is None:
        return 0
    return min(100, max(0, round(float(log.progress_rate))))


def _exercise_status_from_log(log) -> str:
    if not log:
        return "waiting"
    return "done" if _progress_from_log(log) >= 100 else "partial"


async def _upload_capture_photo(
    file: UploadFile | None,
    patient_id: int,
    rehab_session_id: int,
    set_number: int,
    photo_type: str,
) -> str | None:
    if file is None:
        return None

    content_type = file.content_type or "application/octet-stream"
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=422, detail=f"{photo_type} must be an image file")

    data = await file.read()
    if not data:
        return None

    extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
    }.get(content_type, "jpg")
    file_path = (
        f"rehab-captures/patient-{patient_id}/session-{rehab_session_id}/"
        f"set-{set_number}/{photo_type}-{uuid.uuid4().hex}.{extension}"
    )

    try:
        return upload_bytes_to_firebase(data, file_path, content_type)
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


def _finger_key(label: str) -> str:
    return next((key for key, value in FINGER_LABELS.items() if value == label), label)


def _parse_rom_key(key: str) -> tuple[str, str, str] | None:
    # "{finger_key}_{joint_type}_{hand_type}" 형식의 ROM 키를 파싱, 유효하지 않으면 None 반환
    # format: {finger_key}_{joint_type}_{hand_type}  e.g. thumb_MCP_왼손
    parts = key.split("_", 2)
    if len(parts) != 3:
        return None
    finger_key, joint_type, hand_type = parts
    finger_type = FINGER_LABELS.get(finger_key)
    if not finger_type or joint_type not in {"MCP", "PIP", "DIP", "IP"} or hand_type not in {"왼손", "오른손"}:
        return None
    return finger_type, joint_type, hand_type


def _rom_settings_to_dict(settings) -> dict[str, float]:
    rom = {}
    for setting in settings:
        finger_key = next(
            (key for key, value in FINGER_LABELS.items() if value == setting.finger_type),
            None,
        )
        if finger_key:
            rom[f"{finger_key}_{setting.joint_type}_{setting.hand_type}"] = float(setting.target_rom)
    return rom


def _get_patient_rom(db: Session, patient_id: int, exercise_type: str = 'grip') -> list[PatientRomSetting]:
    return (
        db.query(PatientRomSetting)
        .filter(
            PatientRomSetting.patient_id == patient_id,
            PatientRomSetting.exercise_type == exercise_type,
        )
        .all()
    )


def _save_patient_rom(db: Session, patient_id: int, exercise_type: str, rom: dict) -> dict[str, float]:
    # 기존 ROM 설정을 전부 삭제하고 새 값으로 교체 후 저장된 결과를 반환 (replace all)
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


def _patient_to_dict(patient) -> dict:
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
        "approval_status": patient.approval_status,
    }


def _require_role(payload: dict, role: str) -> None:
    if payload["role"] != role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{role} role required",
        )


def _require_patient_approved(patient) -> None:
    if patient.approval_status != "승인":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="환자가 아직 등록 정보에 동의하지 않았습니다.",
        )


def _ensure_pending_report_for_exercise(db: Session, patient, schedule: ExerciseSchedule, log: RehabExerciseLog | None = None) -> LlmReport | None:
    # 운동 세션 저장 후 해당 날짜 리포트가 없으면 생성, 있으면 draft 갱신 (upsert)
    if not patient.doctor_id:
        return None

    draft_content = generate_daily_report_content(
        db,
        patient,
        schedule.exercise_date,
        exercise_blocked=False,
    )

    report = (
        db.query(LlmReport)
        .filter(
            LlmReport.patient_id == patient.patient_id,
            LlmReport.report_date == schedule.exercise_date,
        )
        .first()
    )
    if report:
        report.doctor_id = patient.doctor_id
        report.draft_content = draft_content
        report.approval_status = "대기"
        return report

    report = LlmReport(
        patient_id=patient.patient_id,
        doctor_id=patient.doctor_id,
        report_date=schedule.exercise_date,
        draft_content=draft_content,
        approval_status="대기",
        guardian_sent_status="대기",
        exercise_blocked=False,
    )
    db.add(report)
    return report


def _save_finger_accuracy_items(db: Session, log: RehabExerciseLog, items) -> None:
    # 손가락별 정확도를 upsert (같은 finger_type+joint_type이면 덮어쓰고, 없으면 새로 추가)
    for item in items:
        joint_type = item.joint_type
        existing = (
            db.query(FingerAccuracy)
            .filter(
                FingerAccuracy.rehab_exercise_log_id == log.rehab_exercise_log_id,
                FingerAccuracy.finger_type == item.finger_type,
                FingerAccuracy.joint_type == joint_type,
            )
            .first()
        )
        values = {
            "max_angle": item.max_angle,
            "min_angle": item.min_angle,
            "avg_match_rate": item.avg_match_rate,
        }
        if existing:
            for key, value in values.items():
                setattr(existing, key, value)
        else:
            db.add(
                FingerAccuracy(
                    rehab_exercise_log_id=log.rehab_exercise_log_id,
                    finger_type=item.finger_type,
                    joint_type=joint_type,
                    **values,
                )
            )


@router.get("/me")
def get_my_patient_profile(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "patient")
    patient = patient_crud.get_patient_by_id(db, int(payload["sub"]))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return _patient_to_dict(patient)


@router.patch("/me/approve")
def approve_my_registration(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "patient")
    patient = patient_crud.get_patient_by_id(db, int(payload["sub"]))
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    patient.approval_status = "승인"
    db.commit()
    return {"approval_status": "승인"}


@router.patch("/me")
def update_my_patient_profile(
    body: PatientUpdateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
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
) -> list[dict]:
    _require_role(payload, "doctor")
    patients = patient_crud.get_patients_by_doctor_id(db, int(payload["sub"]))
    return [_patient_to_dict(patient) for patient in patients]


@router.get("/search")
def search_patients(
    q: str,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> list[dict]:
    _require_role(payload, "doctor")
    if not q or not q.strip():
        return []
    patients = patient_crud.search_unassigned_patients(db, q.strip())
    return [_patient_to_dict(p) for p in patients]


@router.get("/exercises")
def list_all_exercises(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> list[dict]:
    _require_role(payload, "doctor")
    exercises = db.query(Exercise).order_by(Exercise.exercise_name).all()
    return [
        {
            "exercise_id": ex.exercise_id,
            "name": ex.exercise_name,
            "estimated_duration": ex.estimated_duration,
        }
        for ex in exercises
    ]


@router.patch("/{patient_id}/register")
def assign_patient(
    patient_id: int,
    body: PatientAssignRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id is not None:
        raise HTTPException(status_code=409, detail="이미 담당 의사가 있는 환자입니다.")

    doctor = doctor_crud.get_doctor_by_id(db, int(payload["sub"]))
    values = body.model_dump(exclude_unset=True)
    values["doctor_id"] = int(payload["sub"])
    values["approval_status"] = "대기"
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
) -> dict:
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    _require_patient_approved(patient)
    updated = patient_crud.update_patient(db, patient, body.model_dump(exclude_unset=True))
    return _patient_to_dict(updated)


@router.get("/{patient_id}/rom")
def get_patient_rom(
    patient_id: int,
    exercise_type: str = 'grip',
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    _require_patient_approved(patient)
    return {"rom": _rom_settings_to_dict(_get_patient_rom(db, patient_id, exercise_type))}


@router.patch("/{patient_id}/rom")
def update_patient_rom(
    patient_id: int,
    body: PatientRomUpdateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    _require_patient_approved(patient)
    return {"rom": _save_patient_rom(db, patient_id, body.exercise_type, body.rom)}


@router.post("/me/exercise-blocked", status_code=201)
def report_exercise_blocked(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
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


@router.get("/me/nearby-hospitals")
def get_nearby_hospitals(
    lat: float,
    lng: float,
    radius: int = 2000,
    payload: dict = Depends(get_token_payload),
) -> list[dict]:
    _require_role(payload, "patient")
    if not KAKAO_REST_KEY:
        raise HTTPException(status_code=503, detail="카카오 API 키가 설정되지 않았습니다.")

    with httpx.Client(timeout=5.0) as client:
        resp = client.get(
            "https://dapi.kakao.com/v2/local/search/category.json",
            headers={"Authorization": f"KakaoAK {KAKAO_REST_KEY}"},
            params={
                "category_group_code": "HP8",
                "x": str(lng),
                "y": str(lat),
                "radius": radius,
                "sort": "distance",
                "size": 10,
            },
        )

    print(f"[Kakao] status={resp.status_code} body={resp.text}")
    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail=f"카카오 API 오류 ({resp.status_code}): {resp.text}")

    return [
        {
            "name": p["place_name"],
            "address": p.get("road_address_name") or p.get("address_name", ""),
            "phone": p.get("phone", ""),
            "distance": int(p.get("distance", 0)),
            "place_url": p.get("place_url", ""),
        }
        for p in resp.json().get("documents", [])
    ]


@router.get("/me/schedule")
def get_my_schedule(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> list[dict]:
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
) -> list[dict]:
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])
    today = date.today()

    active_schedules = (
        db.query(ExerciseSchedule)
        .join(
            PrescriptionExercise,
            PrescriptionExercise.prescription_exercise_id == ExerciseSchedule.prescription_exercise_id,
        )
        .join(Prescription, Prescription.prescription_id == PrescriptionExercise.prescription_id)
        .filter(
            Prescription.patient_id == patient_id,
            Prescription.status == "적용중",
            ExerciseSchedule.exercise_date == today,
        )
        .order_by(Prescription.prescription_date.desc(), PrescriptionExercise.exercise_order)
        .all()
    )
    completed_schedules = (
        db.query(ExerciseSchedule)
        .join(
            PrescriptionExercise,
            PrescriptionExercise.prescription_exercise_id == ExerciseSchedule.prescription_exercise_id,
        )
        .join(Prescription, Prescription.prescription_id == PrescriptionExercise.prescription_id)
        .filter(
            Prescription.patient_id == patient_id,
            ExerciseSchedule.exercise_date == today,
        )
        .order_by(Prescription.prescription_date.desc(), PrescriptionExercise.exercise_order)
        .all()
    )

    exercises = []
    added_keys = set()
    attempted_schedules = [schedule for schedule in completed_schedules if schedule.sessions]
    attempted_by_key = {
        (schedule.prescription_exercise.exercise.exercise_name, schedule.exercise_date): schedule
        for schedule in attempted_schedules
    }
    schedules = list(active_schedules)
    active_keys = {
        (schedule.prescription_exercise.exercise.exercise_name, schedule.exercise_date)
        for schedule in schedules
    }
    schedules.extend(
        schedule
        for schedule in attempted_schedules
        if (schedule.prescription_exercise.exercise.exercise_name, schedule.exercise_date) not in active_keys
    )
    for schedule in schedules:
        pe = schedule.prescription_exercise
        exercise_name = pe.exercise.exercise_name
        schedule_key = (exercise_name, schedule.exercise_date)
        log_source = schedule if schedule.sessions else attempted_by_key.get(schedule_key, schedule)
        log = _first_schedule_log(log_source)
        progress_rate = _progress_from_log(log)
        status_text = _exercise_status_from_log(log)
        key = (exercise_name, schedule.exercise_date, status_text)
        if key in added_keys:
            continue
        added_keys.add(key)
        exercises.append({
            "id": pe.prescription_exercise_id,
            "schedule_id": schedule.schedule_id,
            "exercise_id": pe.exercise_id,
            "name": exercise_name,
            "sets": pe.target_sets,
            "reps": pe.target_reps,
            "duration": f"{max(1, pe.target_sets * pe.target_reps * 3 // 60)}분",
            "status": status_text,
            "videoTime": _video_time_for_exercise(exercise_name),
            "progress_rate": progress_rate,
        })

    return exercises


@router.get("/me/weekly-stats")
def get_my_weekly_stats(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> list[dict]:
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])
    today = date.today()

    week_start = today - timedelta(days=today.weekday())  # 이번 주 월요일

    day_labels = ["월", "화", "수", "목", "금", "토", "일"]
    result = []

    for i in range(7):
        day_date = week_start + timedelta(days=i)
        schedules = (
            db.query(ExerciseSchedule)
            .join(PrescriptionExercise, PrescriptionExercise.prescription_exercise_id == ExerciseSchedule.prescription_exercise_id)
            .join(Prescription, Prescription.prescription_id == PrescriptionExercise.prescription_id)
            .filter(
                Prescription.patient_id == patient_id,
                Prescription.status == "적용중",
                ExerciseSchedule.exercise_date == day_date,
            )
            .all()
        )
        total = len(schedules)
        progress_values = [_progress_from_log(_first_schedule_log(s)) for s in schedules]
        done = sum(1 for value in progress_values if value >= 100)
        rate = round(sum(progress_values) / total) if total > 0 else 0
        result.append({
            "day": day_labels[i],
            "date": day_date.isoformat(),
            "total": total,
            "done": done,
            "rate": rate,
            "is_today": day_date == today,
        })

    return result


@router.post("/me/exercise-sessions", status_code=201)
def create_my_exercise_session(
    body: ExerciseSessionCreateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    # 운동 세션과 로그를 저장하고, 이미 존재하면 수치를 업데이트한 뒤 리포트 초안을 갱신
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])

    schedule = db.query(ExerciseSchedule).filter(ExerciseSchedule.schedule_id == body.schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Exercise schedule not found")

    prescription = schedule.prescription_exercise.prescription
    if prescription.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Cannot access this schedule")
    patient = prescription.patient

    existing = (
        db.query(RehabExerciseSession)
        .filter(RehabExerciseSession.schedule_id == body.schedule_id)
        .first()
    )
    if existing:
        log = existing.logs[0] if existing.logs else None
        now = datetime.now()
        if log:
            log.performed_reps = body.performed_reps
            log.performed_sets = body.performed_sets
            log.progress_rate = body.progress_rate
            log.end_time = now
            log.end_type = body.end_type
            _save_finger_accuracy_items(db, log, body.finger_accuracy)
            db.flush()
        else:
            log = RehabExerciseLog(
                rehab_session_id=existing.rehab_session_id,
                performed_reps=body.performed_reps,
                performed_sets=body.performed_sets,
                progress_rate=body.progress_rate,
                end_time=now,
                end_type=body.end_type,
            )
            db.add(log)
            db.flush()
            _save_finger_accuracy_items(db, log, body.finger_accuracy)
            db.flush()
        _ensure_pending_report_for_exercise(db, patient, schedule, log)
        db.commit()
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

    _save_finger_accuracy_items(db, log, body.finger_accuracy)
    db.flush()

    _ensure_pending_report_for_exercise(db, patient, schedule, log)
    db.commit()
    db.refresh(session)
    return {
        "rehab_session_id": session.rehab_session_id,
        "rehab_exercise_log_id": log.rehab_exercise_log_id,
        "already_saved": False,
    }


@router.post("/me/exercise-sessions/{rehab_session_id}/captures", status_code=201)
async def upload_my_exercise_capture(
    rehab_session_id: int,
    set_number: int = Form(...),
    set_first_photo: UploadFile | None = File(None),
    set_last_photo: UploadFile | None = File(None),
    overload_before_photo: UploadFile | None = File(None),
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    # 운동 중 촬영된 사진을 Firebase에 업로드하고 URL을 세션/세트 단위로 저장
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])
    if set_number < 1:
        raise HTTPException(status_code=422, detail="set_number must be greater than 0")
    if not any([set_first_photo, set_last_photo, overload_before_photo]):
        raise HTTPException(status_code=422, detail="At least one photo is required")

    session = (
        db.query(RehabExerciseSession)
        .filter(RehabExerciseSession.rehab_session_id == rehab_session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Exercise session not found")

    prescription = session.schedule.prescription_exercise.prescription
    if prescription.patient_id != patient_id:
        raise HTTPException(status_code=403, detail="Cannot access this session")

    first_url = await _upload_capture_photo(
        set_first_photo, patient_id, rehab_session_id, set_number, "set-first"
    )
    last_url = await _upload_capture_photo(
        set_last_photo, patient_id, rehab_session_id, set_number, "set-last"
    )
    overload_url = await _upload_capture_photo(
        overload_before_photo, patient_id, rehab_session_id, set_number, "overload-before"
    )

    capture = (
        db.query(RehabExerciseCapture)
        .filter(
            RehabExerciseCapture.rehab_session_id == rehab_session_id,
            RehabExerciseCapture.set_number == set_number,
        )
        .first()
    )
    if not capture:
        capture = RehabExerciseCapture(
            rehab_session_id=rehab_session_id,
            set_number=set_number,
        )
        db.add(capture)

    if first_url:
        capture.set_first_photo_url = first_url
    if last_url:
        capture.set_last_photo_url = last_url
    if overload_url:
        capture.overload_before_photo_url = overload_url
    capture.updated_at = datetime.now()

    db.commit()
    db.refresh(capture)
    return {
        "capture_id": capture.capture_id,
        "rehab_session_id": capture.rehab_session_id,
        "set_number": capture.set_number,
        "set_first_photo_url": capture.set_first_photo_url,
        "set_last_photo_url": capture.set_last_photo_url,
        "overload_before_photo_url": capture.overload_before_photo_url,
    }


@router.post("/{patient_id}/prescriptions", status_code=201)
def save_patient_prescription(
    patient_id: int,
    body: PrescriptionSaveRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    # 기존 적용중 처방을 종료하고 새 처방을 생성하며, 재사용 가능한 스케줄은 이전 것을 그대로 활용
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    _require_patient_approved(patient)

    enabled_exercises = [ex for ex in body.exercises if ex.enabled]
    if not enabled_exercises:
        raise HTTPException(status_code=422, detail="At least one exercise is required")

    reusable_schedules, completed_schedules = _collect_active_schedule_maps(db, patient_id)

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
            sched_date = date.fromisoformat(date_text)
            if sched_date < date.today():
                continue
            if completed_schedules.get((ex.name, sched_date)):
                continue
            existing_schedule = _pop_reusable_schedule(reusable_schedules, ex.name, sched_date)
            if existing_schedule:
                existing_schedule.prescription_exercise_id = prescription_exercise.prescription_exercise_id
            else:
                db.add(
                    ExerciseSchedule(
                        prescription_exercise_id=prescription_exercise.prescription_exercise_id,
                        exercise_date=sched_date,
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
) -> dict | None:
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    _require_patient_approved(patient)

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


@router.get("/{patient_id}/daily-exercise-result")
def get_patient_daily_exercise_result(
    patient_id: int,
    target_date: Optional[date] = Query(None, alias="date"),
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    _require_patient_approved(patient)

    result_date = target_date or date.today()
    schedules = (
        db.query(ExerciseSchedule)
        .join(PrescriptionExercise, PrescriptionExercise.prescription_exercise_id == ExerciseSchedule.prescription_exercise_id)
        .join(Prescription, Prescription.prescription_id == PrescriptionExercise.prescription_id)
        .filter(
            Prescription.patient_id == patient_id,
            ExerciseSchedule.exercise_date == result_date,
        )
        .order_by(ExerciseSchedule.schedule_id)
        .all()
    )

    exercise_results = []
    total_logs = 0
    progress_values = []
    schedule_progress_values = []
    match_values = []

    for schedule in schedules:
        pe = schedule.prescription_exercise
        exercise_name = pe.exercise.exercise_name
        hand_type = _hand_type_from_exercise_name(exercise_name)
        exercise_type = "tapping" if any(word in exercise_name for word in ["태핑", "Tapping", "두드리기"]) else "grip"

        patient_rom_map = {
            (s.hand_type, s.finger_type, s.joint_type): float(s.target_rom)
            for s in _get_patient_rom(db, patient_id, exercise_type)
        }
        prescription_rom_map = {
            (s.hand_type, s.finger_type, s.joint_type): float(s.target_rom)
            for s in pe.finger_settings
        }

        session = schedule.sessions[0] if schedule.sessions else None
        log = session.logs[0] if session and session.logs else None
        total_logs += 1
        if log:
            if log.progress_rate is not None:
                progress = float(log.progress_rate)
                progress_values.append(progress)
                schedule_progress_values.append(progress)
            else:
                schedule_progress_values.append(0)
        else:
            schedule_progress_values.append(0)

        finger_accuracy = []
        if log:
            for item in log.finger_accuracies:
                target_rom = (
                    prescription_rom_map.get((hand_type, item.finger_type, item.joint_type))
                    or patient_rom_map.get((hand_type, item.finger_type, item.joint_type))
                )
                avg_match_rate = float(item.avg_match_rate) if item.avg_match_rate is not None else None
                if avg_match_rate is not None:
                    match_values.append(avg_match_rate)
                finger_accuracy.append({
                    "finger_type": item.finger_type,
                    "joint_type": item.joint_type,
                    "target_rom": target_rom,
                    "min_angle": float(item.min_angle) if item.min_angle is not None else None,
                    "max_angle": float(item.max_angle) if item.max_angle is not None else None,
                    "avg_match_rate": avg_match_rate,
                })

        exercise_results.append({
            "schedule_id": schedule.schedule_id,
            "exercise_name": exercise_name,
            "exercise_date": schedule.exercise_date.isoformat(),
            "target_sets": pe.target_sets,
            "target_reps": pe.target_reps,
            "performed_sets": log.performed_sets if log else None,
            "performed_reps": log.performed_reps if log else None,
            "progress_rate": float(log.progress_rate) if log and log.progress_rate is not None else None,
            "end_type": log.end_type if log else None,
            "is_done": log is not None,
            "finger_accuracy": finger_accuracy,
        })

    overall_compliance = round(sum(schedule_progress_values) / total_logs) if total_logs else 0
    accuracy_average = round(sum(match_values) / len(match_values), 1) if match_values else (
        round(sum(progress_values) / len(progress_values), 1) if progress_values else 0
    )

    return {
        "patient_id": patient.patient_id,
        "date": result_date.isoformat(),
        "overall_compliance": overall_compliance,
        "accuracy_average": accuracy_average,
        "exercises": exercise_results,
    }


@router.get("/{patient_id}/weekly-progress")
def get_patient_weekly_progress(
    patient_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    # 재활 시작일부터 최대 12주치 운동 수행률·정확도·ROM을 집계하고 LLM 월간 요약을 함께 반환
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id is not None and patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    _require_patient_approved(patient)

    today = date.today()
    rehab_start = patient.rehab_start_date or today
    days_since = (today - rehab_start).days
    total_weeks = min(max(1, days_since // 7 + 1), 12)

    weeks = []
    for week_num in range(1, total_weeks + 1):
        week_start = rehab_start + timedelta(weeks=week_num - 1)
        week_end = week_start + timedelta(days=6)

        schedules = (
            db.query(ExerciseSchedule)
            .join(PrescriptionExercise, PrescriptionExercise.prescription_exercise_id == ExerciseSchedule.prescription_exercise_id)
            .join(Prescription, Prescription.prescription_id == PrescriptionExercise.prescription_id)
            .filter(
                Prescription.patient_id == patient_id,
                ExerciseSchedule.exercise_date >= week_start,
                ExerciseSchedule.exercise_date <= week_end,
            )
            .all()
        )

        total = len(schedules)
        done_schedules = [s for s in schedules if s.sessions]
        done = len(done_schedules)

        progress_values = []
        match_values = []

        exercise_map: dict = {}
        rom_map: dict = {}
        for s in schedules:
            pe = s.prescription_exercise
            name = pe.exercise.exercise_name
            if name not in exercise_map:
                exercise_map[name] = {"total": 0, "done": 0, "progress": [], "match": []}
            exercise_map[name]["total"] += 1

            hand_type = _hand_type_from_exercise_name(name)
            exercise_type = "tapping" if any(word in name for word in ["태핑", "Tapping", "두드리기"]) else "grip"
            patient_rom_map = {
                (setting.hand_type, setting.finger_type, setting.joint_type): float(setting.target_rom)
                for setting in _get_patient_rom(db, patient_id, exercise_type)
            }
            prescription_rom_map = {
                (setting.hand_type, setting.finger_type, setting.joint_type): float(setting.target_rom)
                for setting in pe.finger_settings
            }
            target_rom_map = {**patient_rom_map, **prescription_rom_map}
            exercise_rom = rom_map.setdefault(name, {})
            for (target_hand, finger_type, joint_type), target_rom in target_rom_map.items():
                if target_hand != hand_type:
                    continue
                exercise_rom.setdefault(
                    (finger_type, joint_type),
                    {
                        "finger_type": finger_type,
                        "joint_type": joint_type,
                        "target_rom": target_rom,
                        "min_values": [],
                        "max_values": [],
                        "match_values": [],
                    },
                )

            if s.sessions:
                exercise_map[name]["done"] += 1
                for session in s.sessions:
                    for log in session.logs:
                        if log.progress_rate is not None:
                            progress = float(log.progress_rate)
                            progress_values.append(progress)
                            exercise_map[name]["progress"].append(progress)
                        for accuracy in log.finger_accuracies:
                            target_rom = (
                                prescription_rom_map.get((hand_type, accuracy.finger_type, accuracy.joint_type))
                                or patient_rom_map.get((hand_type, accuracy.finger_type, accuracy.joint_type))
                            )
                            rom_item = exercise_rom.setdefault(
                                (accuracy.finger_type, accuracy.joint_type),
                                {
                                    "finger_type": accuracy.finger_type,
                                    "joint_type": accuracy.joint_type,
                                    "target_rom": target_rom,
                                    "min_values": [],
                                    "max_values": [],
                                    "match_values": [],
                                },
                            )
                            if rom_item["target_rom"] is None:
                                rom_item["target_rom"] = target_rom
                            if accuracy.min_angle is not None:
                                rom_item["min_values"].append(float(accuracy.min_angle))
                            if accuracy.max_angle is not None:
                                rom_item["max_values"].append(float(accuracy.max_angle))
                            if accuracy.avg_match_rate is not None:
                                match = float(accuracy.avg_match_rate)
                                match_values.append(match)
                                exercise_map[name]["match"].append(match)
                                rom_item["match_values"].append(match)

        compliance = round(done / total * 100) if total > 0 else None
        accuracy_avg = _avg_or_none(match_values) or _avg_or_none(progress_values)

        exercises = [
            {
                "name": name,
                "compliance": round(v["done"] / v["total"] * 100) if v["total"] > 0 else None,
                "accuracy": _avg_or_none(v["match"]) or _avg_or_none(v["progress"]),
            }
            for name, v in exercise_map.items()
        ]

        rom = []
        for exercise_name, items in rom_map.items():
            fingers = []
            for finger_type in ["엄지", "검지", "중지", "약지", "소지"]:
                joints = []
                for joint_type in ["MCP", "IP", "PIP", "DIP"]:
                    item = items.get((finger_type, joint_type))
                    if not item:
                        continue
                    max_angle = max(item["max_values"]) if item["max_values"] else None
                    target_rom = item["target_rom"]
                    achievement = (
                        min(round(float(max_angle) / float(target_rom) * 100), 100)
                        if max_angle is not None and target_rom
                        else None
                    )
                    joints.append(
                        {
                            "name": joint_type,
                            "ref": _round_or_none(target_rom),
                            "max": _round_or_none(max_angle),
                            "min": _round_or_none(min(item["min_values"]) if item["min_values"] else None),
                            "avg": _avg_or_none(item["match_values"]),
                            "achievement": achievement,
                        }
                    )
                if joints:
                    fingers.append(
                        {
                            "key": _finger_key(finger_type),
                            "label": finger_type,
                            "joints": joints,
                        }
                    )
            rom.append(
                {
                    "key": exercise_name,
                    "label": exercise_name,
                    "fingers": fingers,
                }
            )

        weeks.append({
            "week": f"{week_num}주차",
            "dates": f"{week_start.strftime('%Y.%m.%d')} ~ {week_end.strftime('%Y.%m.%d')}",
            "sessionCount": done,
            "overallCompliance": compliance,
            "accuracyAvg": accuracy_avg,
            "exercises": exercises,
            "rom": rom,
        })

    if patient.overall_evaluation:
        return {
            "weeks": weeks,
            "summary": patient.overall_evaluation,
            "keywords": [],
        }
    llm_summary = generate_monthly_report_summary(patient, weeks)
    return {
        "weeks": weeks,
        "summary": llm_summary.get("summary"),
        "keywords": llm_summary.get("keywords") or [],
    }


@router.patch("/{patient_id}/overall-evaluation")
def save_overall_evaluation(
    patient_id: int,
    body: dict,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != int(payload["sub"]):
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    patient.overall_evaluation = body.get("summary", "")
    db.commit()
    return {"summary": patient.overall_evaluation}


@router.get("/{patient_id}")
def get_patient_detail(
    patient_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "doctor")
    patient = patient_crud.get_patient_by_id(db, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    doctor_id = int(payload["sub"])
    if patient.doctor_id is not None and patient.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail="Cannot access this patient")
    _require_patient_approved(patient)

    return _patient_to_dict(patient)
