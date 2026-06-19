from sqlalchemy import (
    Column, Integer, String, Date, Text, Boolean, TIMESTAMP, ForeignKey,
    CheckConstraint, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base


class LlmReport(Base):
    __tablename__ = "llm_report"

    report_id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patient.patient_id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctor.doctor_id"), nullable=False)  # ✏️ 신규 추가
    report_date = Column(Date, nullable=False)
    draft_content = Column(Text, nullable=False)
    edited_content = Column(Text)
    approval_status = Column(String(20), nullable=False, default="대기")
    approved_at = Column(TIMESTAMP)
    guardian_sent_status = Column(String(20), nullable=False, default="대기")
    exercise_blocked = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "approval_status IN ('대기', '수정', '승인')", name="ck_llm_report_approval"
        ),
        CheckConstraint(
            "guardian_sent_status IN ('대기', '완료')", name="ck_llm_report_guardian"
        ),
        UniqueConstraint("patient_id", "report_date"),
    )

    patient = relationship("Patient", back_populates="llm_reports")
    doctor = relationship("Doctor", back_populates="llm_reports")