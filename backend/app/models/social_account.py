from sqlalchemy import (
    Column, Integer, String, TIMESTAMP, ForeignKey,
    CheckConstraint, UniqueConstraint, func
)
from sqlalchemy.orm import relationship
from database import Base


class SocialAccount(Base):
    __tablename__ = "social_account"

    social_account_id = Column(Integer, primary_key=True, autoincrement=True)
    patient_id = Column(Integer, ForeignKey("patient.patient_id"), nullable=False)
    social_platform = Column(String(100), nullable=False)
    social_user_id = Column(String(100), nullable=False)
    created_at = Column(TIMESTAMP, nullable=False, server_default=func.now())
    updated_at = Column(TIMESTAMP, nullable=False, server_default=func.now())

    __table_args__ = (
        CheckConstraint(
            "social_platform IN ('google', 'kakao', 'naver')",
            name="ck_social_platform",
        ),
        UniqueConstraint("social_platform", "social_user_id"),
    )

    patient = relationship("Patient", back_populates="social_accounts")