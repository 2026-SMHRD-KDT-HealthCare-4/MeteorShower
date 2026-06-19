from sqlalchemy import Column, Integer, String, TIMESTAMP, func
from sqlalchemy.orm import relationship
from database import Base


class Doctor(Base):
    __tablename__ = "doctor"

    doctor_id = Column(Integer, primary_key=True, autoincrement=True)
    login_id = Column(String(50), nullable=False, unique=True)
    password = Column(String(255), nullable=False)
    name = Column(String(50), nullable=False)
    phone = Column(String(20), nullable=False)
    email = Column(String(100), nullable=False, unique=True)
    hospital_name = Column(String(100), nullable=False)
    license_number = Column(String(50), nullable=False, unique=True)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    patients = relationship("Patient", back_populates="doctor")
    prescriptions = relationship("Prescription", back_populates="doctor")
    llm_reports = relationship("LlmReport", back_populates="doctor")
    notifications = relationship("DoctorNotification", back_populates="doctor")