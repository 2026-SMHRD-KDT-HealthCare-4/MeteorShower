from sqlalchemy import Column, Integer, TIMESTAMP, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from database import Base


class PrescriptionExercise(Base):
    __tablename__ = "prescription_exercise"

    prescription_exercise_id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_id = Column(Integer, ForeignKey("prescription.prescription_id"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercise.exercise_id"), nullable=False)
    target_reps = Column(Integer, nullable=False)
    target_sets = Column(Integer, nullable=False)
    exercise_order = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("prescription_id", "exercise_order"),
    )

    prescription = relationship("Prescription", back_populates="prescription_exercises")
    exercise = relationship("Exercise", back_populates="prescription_exercises")
    finger_settings = relationship("PrescriptionFingerSetting", back_populates="prescription_exercise")
    schedules = relationship("ExerciseSchedule", back_populates="prescription_exercise")