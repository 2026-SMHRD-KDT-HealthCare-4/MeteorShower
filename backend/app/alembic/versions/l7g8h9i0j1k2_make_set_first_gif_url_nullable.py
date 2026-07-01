"""make set_first_gif_url nullable

Revision ID: l7g8h9i0j1k2
Revises: k6f7g8h9i0j1
Create Date: 2026-07-01 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "l7g8h9i0j1k2"
down_revision: Union[str, Sequence[str], None] = "k6f7g8h9i0j1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "rehab_exercise_capture",
        "set_first_gif_url",
        existing_type=sa.String(length=500),
        nullable=True,
    )


def downgrade() -> None:
    op.execute(
        "UPDATE rehab_exercise_capture SET set_first_gif_url = '' WHERE set_first_gif_url IS NULL"
    )
    op.alter_column(
        "rehab_exercise_capture",
        "set_first_gif_url",
        existing_type=sa.String(length=500),
        nullable=False,
    )