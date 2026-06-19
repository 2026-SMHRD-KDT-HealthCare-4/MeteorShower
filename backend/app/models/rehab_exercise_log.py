from sqlalchemy import (
    Column, Integer, String, Numeric, TIMESTAMP, ForeignKey,
    CheckConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base


class RehabExerciseLog(Base):
    __tablename__ = "rehab_exercise_log"

    rehab_exercise_log_id = Column(Integer, primary_key=True, autoincrement=True)
    rehab_session_id = Column(
        Integer, ForeignKey("rehab_exercise_session.rehab_session_id"), nullable=False
    )
    performed_reps = Column(Integer)
    performed_sets = Column(Integer)
    progress_rate = Column(Numeric(5, 2))
    end_time = Column(TIMESTAMP)
    end_type = Column(String(20))
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "end_type IN ('완료', '목표조정', '안전종료', '운동차단')",
            name="ck_rehab_log_end_type",
        ),
    )

    session = relationship("RehabExerciseSession", back_populates="logs")
    finger_accuracies = relationship("FingerAccuracy", back_populates="log")