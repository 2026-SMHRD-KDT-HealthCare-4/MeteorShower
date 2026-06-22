from sqlalchemy import (
    CheckConstraint,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    TIMESTAMP,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import relationship

from database import Base


class PrescriptionFingerSetting(Base):
    __tablename__ = "prescription_finger_setting"

    finger_setting_id = Column(Integer, primary_key=True, autoincrement=True)
    prescription_exercise_id = Column(
        Integer, ForeignKey("prescription_exercise.prescription_exercise_id"), nullable=False
    )
    hand_type = Column(String(10), nullable=False)
    finger_type = Column(String(10), nullable=False)
    joint_type = Column(String(10), nullable=False)
    target_rom = Column(Numeric(6, 2), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint("hand_type IN ('왼손', '오른손')", name="ck_finger_setting_hand"),
        CheckConstraint(
            "finger_type IN ('엄지', '검지', '중지', '약지', '소지')",
            name="ck_finger_setting_finger",
        ),
        CheckConstraint(
            "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
            name="ck_finger_setting_joint",
        ),
        UniqueConstraint("prescription_exercise_id", "hand_type", "finger_type", "joint_type"),
    )

    prescription_exercise = relationship("PrescriptionExercise", back_populates="finger_settings")
