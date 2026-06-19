from sqlalchemy import Column, Integer, Date, TIMESTAMP, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import relationship
from database import Base


class ExerciseSchedule(Base):
    __tablename__ = "exercise_schedule"

    schedule_id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_exercise_id = Column(
        Integer, ForeignKey("prescription_exercise.prescription_exercise_id"), nullable=False
    )
    exercise_date = Column(Date, nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("prescription_exercise_id", "exercise_date"),
    )

    prescription_exercise = relationship("PrescriptionExercise", back_populates="schedules")
    sessions = relationship("RehabExerciseSession", back_populates="schedule")