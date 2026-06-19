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
    hand_type = Column(String(10), nullable=False)
    finger_type = Column(String(10), nullable=False)
    accuracy = Column(Numeric(5, 2), nullable=False)
    rom = Column(Numeric(6, 2), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("hand_type IN ('왼손', '오른손')", name="ck_finger_accuracy_hand"),
        CheckConstraint(
            "finger_type IN ('엄지', '검지', '중지', '약지', '소지')",
            name="ck_finger_accuracy_finger",
        ),
        UniqueConstraint("rehab_exercise_log_id", "hand_type", "finger_type"),
    )

    log = relationship("RehabExerciseLog", back_populates="finger_accuracies")