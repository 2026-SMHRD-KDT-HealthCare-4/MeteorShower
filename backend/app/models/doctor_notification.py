from sqlalchemy import (
    Column, Integer, String, Text, Boolean, TIMESTAMP, ForeignKey,
    CheckConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base


class DoctorNotification(Base):
    __tablename__ = "doctor_notification"

    notification_id = Column(Integer, primary_key=True, autoincrement=True)
    doctor_id = Column(Integer, ForeignKey("doctor.doctor_id"), nullable=False)
    notification_type = Column(String(30), nullable=False)
    notification_content = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "notification_type IN ('운동미수행', '운동차단')",
            name="ck_doctor_notification_type",
        ),
    )

    doctor = relationship("Doctor", back_populates="notifications")