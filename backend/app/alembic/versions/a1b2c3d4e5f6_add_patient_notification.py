"""add patient_notification

Revision ID: a1b2c3d4e5f6
Revises: f578c369e907
Create Date: 2026-06-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'f578c369e907'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'patient_notification',
        sa.Column('notification_id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('patient_id', sa.Integer(), nullable=False),
        sa.Column('notification_type', sa.String(length=30), nullable=False),
        sa.Column('notification_content', sa.Text(), nullable=False),
        sa.Column('is_read', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.CheckConstraint("notification_type IN ('처방등록')", name='ck_patient_notification_type'),
        sa.ForeignKeyConstraint(['patient_id'], ['patient.patient_id'], ),
        sa.PrimaryKeyConstraint('notification_id'),
    )


def downgrade() -> None:
    op.drop_table('patient_notification')
