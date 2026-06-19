from sqlalchemy import Column, Integer, String, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base


class Exercise(Base):
    __tablename__ = "exercise"

    exercise_id = Column(Integer, primary_key=True, autoincrement=True)
    exercise_name = Column(String(50), nullable=False, unique=True)
    exercise_video_url = Column(String(500))
    reference_motion = Column(JSONB, nullable=False)
    estimated_duration = Column(Integer)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    prescription_exercises = relationship("PrescriptionExercise", back_populates="exercise")