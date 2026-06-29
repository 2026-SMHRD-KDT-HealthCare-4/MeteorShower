"""update rehab exercise capture gif columns

Revision ID: k6f7g8h9i0j1
Revises: j5e6f7g8h9i0
Create Date: 2026-06-29 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "k6f7g8h9i0j1"
down_revision: Union[str, Sequence[str], None] = "j5e6f7g8h9i0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("TRUNCATE TABLE rehab_exercise_capture RESTART IDENTITY")
    op.drop_column("rehab_exercise_capture", "set_first_photo_url")
    op.drop_column("rehab_exercise_capture", "set_last_photo_url")
    op.drop_column("rehab_exercise_capture", "overload_before_photo_url")
    op.add_column(
        "rehab_exercise_capture",
        sa.Column("set_first_gif_url", sa.String(length=500), nullable=False),
    )
    op.add_column(
        "rehab_exercise_capture",
        sa.Column("set_last_gif_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "rehab_exercise_capture",
        sa.Column("overload_before_gif_url", sa.String(length=500), nullable=True),
    )
    op.create_check_constraint(
        "ck_rehab_exercise_capture_gif_case",
        "rehab_exercise_capture",
        "NOT (set_last_gif_url IS NOT NULL AND overload_before_gif_url IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_rehab_exercise_capture_gif_case",
        "rehab_exercise_capture",
        type_="check",
    )
    op.drop_column("rehab_exercise_capture", "overload_before_gif_url")
    op.drop_column("rehab_exercise_capture", "set_last_gif_url")
    op.drop_column("rehab_exercise_capture", "set_first_gif_url")
    op.add_column(
        "rehab_exercise_capture",
        sa.Column("overload_before_photo_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "rehab_exercise_capture",
        sa.Column("set_last_photo_url", sa.String(length=500), nullable=True),
    )
    op.add_column(
        "rehab_exercise_capture",
        sa.Column("set_first_photo_url", sa.String(length=500), nullable=True),
    )
