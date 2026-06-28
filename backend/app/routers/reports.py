from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from crud import patient as patient_crud
from crud import report as report_crud
from database import get_db
from dependencies import get_token_payload
from models.exercise import Exercise
from models.exercise_schedule import ExerciseSchedule
from models.llm_report import LlmReport
from models.patient_notification import PatientNotification
from models.prescription import Prescription
from models.prescription_exercise import PrescriptionExercise
from models.rehab_exercise_log import RehabExerciseLog
from models.rehab_exercise_session import RehabExerciseSession
from schemas.report import LlmReportCreateRequest, ReportApproveRequest, ReportUpdateRequest
from services.llm_report_generator import generate_daily_report_content

router = APIRouter(tags=["reports"])


def _require_role(payload: dict, role: str) -> None:
    if payload["role"] != role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{role} role required",
        )


def _require_doctor_report_access(report: LlmReport, doctor_id: int) -> None:
    if report.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail="Cannot access this report")


def _latest_active_prescription(db: Session, patient_id: int) -> Optional[Prescription]:
    return (
        db.query(Prescription)
        .filter(Prescription.patient_id == patient_id, Prescription.status == "적용중")
        .order_by(Prescription.prescription_date.desc(), Prescription.created_at.desc())
        .first()
    )


def _prescription_exercises_to_dict(prescription: Optional[Prescription]) -> list[dict]:
    if not prescription:
        return []

    exercises = []
    for pe in sorted(prescription.prescription_exercises, key=lambda item: item.exercise_order):
        exercises.append(
            {
                "exercise_id": pe.exercise_id,
                "name": pe.exercise.exercise_name if pe.exercise else None,
                "sets": pe.target_sets,
                "reps": pe.target_reps,
                "order": pe.exercise_order,
                "schedule": [s.exercise_date.isoformat() for s in pe.schedules],
            }
        )
    return exercises


def _get_date_achievements(db: Session, patient_id: int, report_date) -> dict:
    """리포트 날짜 기준 운동별 달성률 {exercise_name: rate%}"""
    if not report_date:
        return {}
    schedules = (
        db.query(ExerciseSchedule)
        .join(PrescriptionExercise, PrescriptionExercise.prescription_exercise_id == ExerciseSchedule.prescription_exercise_id)
        .join(Prescription, Prescription.prescription_id == PrescriptionExercise.prescription_id)
        .filter(
            Prescription.patient_id == patient_id,
            ExerciseSchedule.exercise_date == report_date,
        )
        .all()
    )
    achievements = {}
    for schedule in schedules:
        name = schedule.prescription_exercise.exercise.exercise_name if schedule.prescription_exercise.exercise else None
        if not name:
            continue
        for session in schedule.sessions:
            for log in session.logs:
                if log.progress_rate is not None:
                    achievements[name] = round(float(log.progress_rate))
                    break
    return achievements


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
            exercise_name = prescription_exercise.exercise.exercise_name if prescription_exercise.exercise else None
            if not exercise_name:
                continue
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


def _save_prescription_from_report(
    db: Session,
    report: LlmReport,
    body: ReportApproveRequest,
) -> Optional[Prescription]:
    # 리포트 승인 시 body의 운동 목록으로 신규 처방을 생성, 활성화 운동이 없으면 None 반환
    enabled_exercises = [exercise for exercise in body.exercises if exercise.enabled]
    if not enabled_exercises:
        return None

    reusable_schedules, completed_schedules = _collect_active_schedule_maps(db, report.patient_id)

    db.query(Prescription).filter(
        Prescription.patient_id == report.patient_id,
        Prescription.status == "적용중",
    ).update({"status": "종료"})

    prescription = Prescription(
        patient_id=report.patient_id,
        doctor_id=report.doctor_id,
        prescription_date=body.prescription_date or report.report_date or date.today(),
        rehab_phase=body.rehab_phase or report.patient.current_rehab_phase or "초기",
        status="적용중",
    )
    db.add(prescription)
    db.flush()

    base_schedule_date = report.report_date or date.today()

    for order, item in enumerate(enabled_exercises, start=1):
        exercise = db.query(Exercise).filter(Exercise.exercise_name == item.name).first()
        if not exercise:
            exercise = Exercise(
                exercise_name=item.name,
                reference_motion={},
                estimated_duration=item.sets * item.reps * 3,
            )
            db.add(exercise)
            db.flush()

        prescription_exercise = PrescriptionExercise(
            prescription_id=prescription.prescription_id,
            exercise_id=exercise.exercise_id,
            target_sets=item.sets,
            target_reps=item.reps,
            exercise_order=order,
        )
        db.add(prescription_exercise)
        db.flush()

        for key, enabled in body.schedule.items():
            if not enabled:
                continue
            name, _, date_text = key.partition("|")
            if name != item.name or not date_text:
                continue
            schedule_date = date.fromisoformat(date_text)
            if schedule_date < base_schedule_date:
                continue
            if completed_schedules.get((item.name, schedule_date)):
                continue
            existing_schedule = _pop_reusable_schedule(reusable_schedules, item.name, schedule_date)
            if existing_schedule:
                existing_schedule.prescription_exercise_id = prescription_exercise.prescription_exercise_id
            else:
                db.add(
                    ExerciseSchedule(
                        prescription_exercise_id=prescription_exercise.prescription_exercise_id,
                        exercise_date=schedule_date,
                    )
                )

    return prescription


def _notify_patient_report_approved(db: Session, report: LlmReport, prescription: Optional[Prescription]) -> None:
    message = "담당 의사가 재활 리포트를 승인했습니다."
    if prescription:
        message = "담당 의사가 재활 리포트와 운동 처방을 등록했습니다."

    db.add(
        PatientNotification(
            patient_id=report.patient_id,
            notification_type="처방등록",
            notification_content=message,
            is_read=False,
        )
    )


def _report_summary(report: LlmReport) -> dict:
    return {
        "report_id": report.report_id,
        "patient_id": report.patient_id,
        "patient_name": report.patient.name if report.patient else None,
        "doctor_id": report.doctor_id,
        "doctor_name": report.doctor.name if report.doctor else None,
        "report_date": report.report_date.isoformat() if report.report_date else None,
        "approval_status": report.approval_status,
        "exercise_blocked": report.exercise_blocked,
        "approved_at": report.approved_at.isoformat() if report.approved_at else None,
        "created_at": report.created_at.isoformat() if report.created_at else None,
    }


def _report_detail(report: LlmReport, db: Session, include_draft: bool = True) -> dict:
    # 리포트 요약 정보에 처방 운동 목록·달성률을 합산하고, include_draft 플래그로 초안 포함 여부를 제어
    content = report.draft_content
    prescription = _latest_active_prescription(db, report.patient_id)
    exercises = _prescription_exercises_to_dict(prescription)
    achievements = _get_date_achievements(db, report.patient_id, report.report_date)
    for ex in exercises:
        ex["achievement"] = achievements.get(ex["name"])
    data = {
        **_report_summary(report),
        "content": content,
        "edited_content": report.edited_content,
        "guardian_sent_status": report.guardian_sent_status,
        "exercises": exercises,
    }
    if include_draft:
        data["draft_content"] = report.draft_content
    return data


def _patient_report_detail(report: LlmReport, db: Session) -> dict:
    if not report.edited_content:
        raise HTTPException(status_code=404, detail="Report not found")
    data = _report_detail(report, db, include_draft=False)
    data["content"] = report.edited_content
    data["edited_content"] = report.edited_content
    data["approval_status"] = "승인"
    return data


@router.post("/reports/llm", status_code=201)
def create_llm_report(
    body: LlmReportCreateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "doctor")
    doctor_id = int(payload["sub"])
    patient = patient_crud.get_patient_by_id(db, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail="Cannot access this patient")

    report_date = body.report_date or date.today()
    draft_content = generate_daily_report_content(db, patient, report_date, body.exercise_blocked)
    report = report_crud.create_or_update_report(
        db,
        patient_id=patient.patient_id,
        doctor_id=doctor_id,
        report_date=report_date,
        draft_content=draft_content,
        exercise_blocked=body.exercise_blocked,
    )
    return _report_detail(report, db)


@router.get("/doctor/me/reports")
def get_my_doctor_reports(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> list[dict]:
    _require_role(payload, "doctor")
    reports = report_crud.get_doctor_reports(db, int(payload["sub"]))
    return [_report_summary(report) for report in reports]


@router.get("/doctor/me/reports/{report_id}")
def get_my_doctor_report_detail(
    report_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "doctor")
    report = report_crud.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    _require_doctor_report_access(report, int(payload["sub"]))
    return _report_detail(report, db)


@router.patch("/doctor/me/reports/{report_id}")
def update_my_doctor_report(
    report_id: int,
    body: ReportUpdateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "doctor")
    report = report_crud.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    _require_doctor_report_access(report, int(payload["sub"]))
    return _report_detail(report_crud.update_report_content(db, report, body.edited_content), db)


@router.patch("/doctor/me/reports/{report_id}/approve")
def approve_my_doctor_report(
    report_id: int,
    body: ReportApproveRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    # 이미 승인된 리포트는 처방 재생성 없이 내용만 갱신, 첫 승인 시 처방 저장 및 환자 알림 발송
    _require_role(payload, "doctor")
    report = report_crud.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    _require_doctor_report_access(report, int(payload["sub"]))

    was_approved = report.approval_status == "승인"
    prescription = None if was_approved else _save_prescription_from_report(db, report, body)
    report = report_crud.approve_report(db, report, body.edited_content)

    if not was_approved:
        _notify_patient_report_approved(db, report, prescription)
        db.commit()
        db.refresh(report)

    return _report_detail(report, db)


@router.get("/patients/me/reports")
def get_my_patient_reports(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> list[dict]:
    _require_role(payload, "patient")
    reports = report_crud.get_patient_approved_reports(db, int(payload["sub"]))
    return [{**_report_summary(report), "approval_status": "승인"} for report in reports]


@router.get("/patients/me/reports/{report_id}")
def get_my_patient_report_detail(
    report_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])
    report = report_crud.get_report_by_id(db, report_id)
    if not report or report.patient_id != patient_id or not report.edited_content:
        raise HTTPException(status_code=404, detail="Report not found")
    return _patient_report_detail(report, db)
