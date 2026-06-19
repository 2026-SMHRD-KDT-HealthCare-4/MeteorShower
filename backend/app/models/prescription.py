from sqlalchemy import (
    Column, Integer, String, Date, TIMESTAMP, ForeignKey,
    CheckConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base


class Prescription(Base):
    __tablename__ = "prescription"

    prescription_id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patient.patient_id"), nullable=False)
    doctor_id = Column(Integer, ForeignKey("doctor.doctor_id"), nullable=False)
    prescription_date = Column(Date, nullable=False)
    rehab_phase = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="대기")
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "rehab_phase IN ('초기', '중기', '후기')", name="ck_prescription_phase"
        ),
        CheckConstraint(
            "status IN ('대기', '적용중', '종료')", name="ck_prescription_status"
        ),
    )

    patient = relationship("Patient", back_populates="prescriptions")
    doctor = relationship("Doctor", back_populates="prescriptions")
    prescription_exercises = relationship("PrescriptionExercise", back_populates="prescription")