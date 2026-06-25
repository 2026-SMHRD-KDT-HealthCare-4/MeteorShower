from sqlalchemy import (
    Column, Integer, String, Text, Date, Boolean, TIMESTAMP, ForeignKey,
    CheckConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base


class Patient(Base):
    __tablename__ = "patient"

    patient_id = Column(Integer, primary_key=True, autoincrement=True)
    doctor_id = Column(Integer, ForeignKey("doctor.doctor_id"), nullable=True)  # ✏️ nullable로 변경
    login_id = Column(String(50), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    name = Column(String(50), nullable=False)
    birth_date = Column(Date, nullable=False)
    gender = Column(String(10), nullable=False)
    phone = Column(String(20), nullable=False)
    patient_code = Column(String(20), nullable=False, unique=True)
    hospital_name = Column(String(100))  # ✏️ nullable로 변경
    surgery_name = Column(String(100))
    surgery_area = Column(String(50))
    surgery_date = Column(Date)
    rehab_start_date = Column(Date)
    current_rehab_phase = Column(String(20))
    guardian_email = Column(String(100))
    report_consent = Column(Boolean, nullable=False, default=False)
    ai_difficulty_enabled = Column(Boolean, nullable=False, default=False)
    appointment_date = Column(Date)  # ✏️ 신규 추가
    overall_evaluation = Column(Text)  # ✏️ 신규 추가: 누적 리포트 승인 후 전달되는 종합 소견
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("gender IN ('남', '여')", name="ck_patient_gender"),
        CheckConstraint(
            "current_rehab_phase IN ('초기', '중기', '후기')",
            name="ck_patient_phase",
        ),
    )

    doctor = relationship("Doctor", back_populates="patients")
    social_accounts = relationship("SocialAccount", back_populates="patient")
    prescriptions = relationship("Prescription", back_populates="patient")
    llm_reports = relationship("LlmReport", back_populates="patient")
    notifications = relationship("PatientNotification", back_populates="patient")