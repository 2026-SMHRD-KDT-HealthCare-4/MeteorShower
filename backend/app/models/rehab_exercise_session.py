from sqlalchemy import Column, Integer, TIMESTAMP, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


class RehabExerciseSession(Base):
    __tablename__ = "rehab_exercise_session"

    rehab_session_id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(Integer, ForeignKey("exercise_schedule.schedule_id"), nullable=False)
    start_time = Column(TIMESTAMP, nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    schedule = relationship("ExerciseSchedule", back_populates="sessions")
    logs = relationship("RehabExerciseLog", back_populates="session")
    captures = relationship("RehabExerciseCapture", back_populates="session")