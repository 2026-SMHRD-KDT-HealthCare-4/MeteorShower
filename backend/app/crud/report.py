from datetime import date, datetime
from typing import Optional

from sqlalchemy.orm import Session

from models.llm_report import LlmReport


def get_report_by_id(db: Session, report_id: int) -> Optional[LlmReport]:
    return db.query(LlmReport).filter(LlmReport.report_id == report_id).first()


def get_report_by_patient_and_date(db: Session, patient_id: int, report_date: date) -> Optional[LlmReport]:
    return (
        db.query(LlmReport)
        .filter(LlmReport.patient_id == patient_id, LlmReport.report_date == report_date)
        .first()
    )


def get_doctor_reports(db: Session, doctor_id: int) -> list[LlmReport]:
    return (
        db.query(LlmReport)
        .filter(LlmReport.doctor_id == doctor_id)
        .order_by(LlmReport.report_date.desc(), LlmReport.created_at.desc())
        .all()
    )


def get_patient_approved_reports(db: Session, patient_id: int) -> list[LlmReport]:
    return (
        db.query(LlmReport)
        .filter(LlmReport.patient_id == patient_id, LlmReport.edited_content.isnot(None))
        .order_by(LlmReport.report_date.desc(), LlmReport.created_at.desc())
        .all()
    )


def create_or_update_report(
    db: Session,
    patient_id: int,
    doctor_id: int,
    report_date: date,
    draft_content: str,
    exercise_blocked: bool = False,
) -> LlmReport:
    report = get_report_by_patient_and_date(db, patient_id, report_date)
    if report:
        report.doctor_id = doctor_id
        report.draft_content = draft_content
        report.approval_status = "대기"
        report.guardian_sent_status = "대기"
        report.exercise_blocked = exercise_blocked
    else:
        report = LlmReport(
            patient_id=patient_id,
            doctor_id=doctor_id,
            report_date=report_date,
            draft_content=draft_content,
            approval_status="대기",
            guardian_sent_status="대기",
            exercise_blocked=exercise_blocked,
        )
        db.add(report)

    db.commit()
    db.refresh(report)
    return report


def update_report_content(db: Session, report: LlmReport, edited_content: str) -> LlmReport:
    report.draft_content = edited_content
    report.approval_status = "대기"
    db.commit()
    db.refresh(report)
    return report


def approve_report(db: Session, report: LlmReport, approved_content: str | None = None) -> LlmReport:
    report.edited_content = approved_content or report.draft_content
    report.approval_status = "승인"
    report.approved_at = datetime.now()
    db.commit()
    db.refresh(report)
    return report
