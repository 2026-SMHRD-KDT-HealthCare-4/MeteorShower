"""add patient_sent_status to llm_report

Revision ID: i4d5e6f7g8h9
Revises: h3c4d5e6f7g8
Create Date: 2026-06-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "i4d5e6f7g8h9"
down_revision: Union[str, Sequence[str], None] = "h3c4d5e6f7g8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "llm_report",
        sa.Column(
            "patient_sent_status",
            sa.String(20),
            nullable=False,
            server_default="대기",
        ),
    )
    op.create_check_constraint(
        "ck_llm_report_patient",
        "llm_report",
        "patient_sent_status IN ('대기', '완료')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_llm_report_patient", "llm_report", type_="check")
    op.drop_column("llm_report", "patient_sent_status")
