"""add patient rom setting

Revision ID: b3e7d1a5c8f1
Revises: 9b0f1f7c9a42
Create Date: 2026-06-20 11:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b3e7d1a5c8f1"
down_revision: Union[str, Sequence[str], None] = "9b0f1f7c9a42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "patient_rom_setting",
        sa.Column("patient_rom_setting_id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("patient_id", sa.Integer(), nullable=False),
        sa.Column("finger_type", sa.String(length=10), nullable=False),
        sa.Column("joint_type", sa.String(length=10), nullable=False),
        sa.Column("target_rom", sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["patient_id"], ["patient.patient_id"]),
        sa.PrimaryKeyConstraint("patient_rom_setting_id"),
        sa.UniqueConstraint("patient_id", "finger_type", "joint_type"),
    )


def downgrade() -> None:
    op.drop_table("patient_rom_setting")
