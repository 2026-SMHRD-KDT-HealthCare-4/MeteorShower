from sqlalchemy import (
    CheckConstraint, Column, Integer, String, TIMESTAMP, ForeignKey, UniqueConstraint, func
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
    set_first_gif_url = Column(String(500), nullable=False)
    set_last_gif_url = Column(String(500))
    overload_before_gif_url = Column(String(500))
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        UniqueConstraint("rehab_session_id", "set_number"),
        CheckConstraint(
            "NOT (set_last_gif_url IS NOT NULL AND overload_before_gif_url IS NOT NULL)",
            name="ck_rehab_exercise_capture_gif_case",
        ),
    )

    session = relationship("RehabExerciseSession", back_populates="captures")
