from sqlalchemy import (
    Column, Integer, String, Numeric, TIMESTAMP, ForeignKey,
    CheckConstraint, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base


class FingerAccuracy(Base):
    __tablename__ = "finger_accuracy"

    finger_accuracy_id = Column(Integer, primary_key=True, autoincrement=True)
    rehab_exercise_log_id = Column(
        Integer, ForeignKey("rehab_exercise_log.rehab_exercise_log_id"), nullable=False
    )
    finger_type = Column(String(10), nullable=False)
    joint_type = Column(String(10), nullable=False)
    max_angle = Column(Numeric(6, 2))
    min_angle = Column(Numeric(6, 2))
    avg_match_rate = Column(Numeric(5, 2))
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "finger_type IN ('엄지', '검지', '중지', '약지', '소지')",
            name="ck_finger_accuracy_finger",
        ),
        CheckConstraint(
            "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
            name="ck_finger_accuracy_joint",
        ),
        UniqueConstraint("rehab_exercise_log_id", "finger_type", "joint_type"),
    )

    log = relationship("RehabExerciseLog", back_populates="finger_accuracies")
