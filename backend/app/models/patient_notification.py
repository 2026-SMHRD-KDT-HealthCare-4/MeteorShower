from sqlalchemy import (
    Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey,
    CheckConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base


class PatientNotification(Base):
    __tablename__ = "patient_notification"

    notification_id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patient.patient_id"), nullable=False)
    notification_type = Column(String(30), nullable=False)
    notification_content = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "notification_type IN ('처방등록')",
            name="ck_patient_notification_type",
        ),
    )

    patient = relationship("Patient", back_populates="notifications")
