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
from schemas.report import MockReportCreateRequest, ReportApproveRequest, ReportUpdateRequest

router = APIRouter(tags=["reports"])


def _require_role(payload: dict, role: str):
    if payload["role"] != role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{role} role required",
        )


def _require_doctor_report_access(report: LlmReport, doctor_id: int):
    if report.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail="Cannot access this report")


def _make_mock_report_content(patient, report_date: date, exercise_blocked: bool) -> str:
    phase = patient.current_rehab_phase or "미지정"
    surgery = patient.surgery_name or "수술 정보 미입력"
    blocked_text = (
        "사전 문진에서 증상 호소가 있어 운동이 차단되었습니다."
        if exercise_blocked
        else "사전 문진에서 특이 증상 호소는 없었습니다."
    )
    return "\n".join(
        [
            f"{report_date.isoformat()} 재활 리포트 초안입니다.",
            f"환자명: {patient.name}",
            f"재활 단계: {phase}",
            f"수술 정보: {surgery}",
            blocked_text,
            "운동 수행 데이터는 아직 실제 운동 기능과 연결되지 않아 mock data 기준으로 작성되었습니다.",
            "손가락 관절 가동 범위와 통증 변화는 다음 진료 시 추가 확인이 필요합니다.",
            "담당 의사는 내용을 검토한 뒤 필요한 문장을 수정하고 승인해 주세요.",
        ]
    )


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


def _save_prescription_from_report(
    db: Session,
    report: LlmReport,
    body: ReportApproveRequest,
) -> Optional[Prescription]:
    enabled_exercises = [exercise for exercise in body.exercises if exercise.enabled]
    if not enabled_exercises:
        return None

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
            db.add(
                ExerciseSchedule(
                    prescription_exercise_id=prescription_exercise.prescription_exercise_id,
                    exercise_date=date.fromisoformat(date_text),
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
    content = report.edited_content or report.draft_content
    prescription = _latest_active_prescription(db, report.patient_id)
    data = {
        **_report_summary(report),
        "content": content,
        "edited_content": report.edited_content,
        "guardian_sent_status": report.guardian_sent_status,
        "exercises": _prescription_exercises_to_dict(prescription),
    }
    if include_draft:
        data["draft_content"] = report.draft_content
    return data


@router.post("/reports/mock", status_code=201)
def create_mock_report(
    body: MockReportCreateRequest,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "doctor")
    doctor_id = int(payload["sub"])
    patient = patient_crud.get_patient_by_id(db, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    if patient.doctor_id != doctor_id:
        raise HTTPException(status_code=403, detail="Cannot access this patient")

    report_date = body.report_date or date.today()
    draft_content = _make_mock_report_content(patient, report_date, body.exercise_blocked)
    report = report_crud.create_or_update_mock_report(
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
):
    _require_role(payload, "doctor")
    reports = report_crud.get_doctor_reports(db, int(payload["sub"]))
    return [_report_summary(report) for report in reports]


@router.get("/doctor/me/reports/{report_id}")
def get_my_doctor_report_detail(
    report_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
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
):
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
):
    _require_role(payload, "doctor")
    report = report_crud.get_report_by_id(db, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    _require_doctor_report_access(report, int(payload["sub"]))

    if body.edited_content:
        report.edited_content = body.edited_content

    was_approved = report.approval_status == "승인"
    prescription = _save_prescription_from_report(db, report, body)
    report = report_crud.approve_report(db, report)

    if not was_approved:
        _notify_patient_report_approved(db, report, prescription)
        db.commit()
        db.refresh(report)

    return _report_detail(report, db)


@router.get("/patients/me/reports")
def get_my_patient_reports(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "patient")
    reports = report_crud.get_patient_approved_reports(db, int(payload["sub"]))
    return [_report_summary(report) for report in reports]


@router.get("/patients/me/reports/{report_id}")
def get_my_patient_report_detail(
    report_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    _require_role(payload, "patient")
    patient_id = int(payload["sub"])
    report = report_crud.get_report_by_id(db, report_id)
    if not report or report.patient_id != patient_id or report.approval_status != "승인":
        raise HTTPException(status_code=404, detail="Report not found")
    return _report_detail(report, db, include_draft=False)
