from sqlalchemy import (
    Column, Integer, String, TIMESTAMP, ForeignKey, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base


class RehabExerciseCapture(Base):
    __tablename__ = "rehab_exercise_capture"

    capture_id = Column(Integer, primary_key=True, autoincrement=True)
    rehab_session_id = Column(
        Integer, ForeignKey("rehab_exercise_session.rehab_session_id"), nullable=False
    )
    set_number = Column(Integer, nullable=False)
    set_first_photo_url = Column(String(500))
    set_last_photo_url = Column(String(500))
    overload_before_photo_url = Column(String(500))
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("rehab_session_id", "set_number"),
    )

    session = relationship("RehabExerciseSession", back_populates="captures")