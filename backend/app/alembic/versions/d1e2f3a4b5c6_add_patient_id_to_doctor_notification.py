"""add patient_id to doctor_notification

Revision ID: d1e2f3a4b5c6
Revises: c9d8e7f6a5b4
Create Date: 2026-06-20 00:02:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, Sequence[str], None] = 'c9d8e7f6a5b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'doctor_notification',
        sa.Column('patient_id', sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        'fk_doctor_notif_patient',
        'doctor_notification', 'patient',
        ['patient_id'], ['patient_id'],
    )


def downgrade() -> None:
    op.drop_constraint('fk_doctor_notif_patient', 'doctor_notification', type_='foreignkey')
    op.drop_column('doctor_notification', 'patient_id')
