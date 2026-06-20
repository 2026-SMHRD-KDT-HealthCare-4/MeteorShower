"""add joint type to finger setting

Revision ID: 9b0f1f7c9a42
Revises: f578c369e907
Create Date: 2026-06-20 10:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "9b0f1f7c9a42"
down_revision: Union[str, Sequence[str], None] = "f578c369e907"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "prescription_finger_setting",
        sa.Column("joint_type", sa.String(length=10), nullable=True),
    )
    op.execute("UPDATE prescription_finger_setting SET joint_type = 'MCP' WHERE joint_type IS NULL")
    op.alter_column("prescription_finger_setting", "joint_type", nullable=False)
    op.execute(
        """
        DO $$
        DECLARE constraint_name text;
        BEGIN
            SELECT c.conname INTO constraint_name
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            WHERE t.relname = 'prescription_finger_setting'
              AND c.contype = 'u'
              AND (
                  SELECT array_agg(a.attname::text ORDER BY a.attnum)
                  FROM unnest(c.conkey) AS cols(attnum)
                  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
              ) = ARRAY['prescription_exercise_id', 'hand_type', 'finger_type'];

            IF constraint_name IS NOT NULL THEN
                EXECUTE format(
                    'ALTER TABLE prescription_finger_setting DROP CONSTRAINT %I',
                    constraint_name
                );
            END IF;
        END $$;
        """
    )
    op.create_check_constraint(
        "ck_finger_setting_joint",
        "prescription_finger_setting",
        "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
    )
    op.create_unique_constraint(
        "uq_finger_setting_exercise_hand_finger_joint",
        "prescription_finger_setting",
        ["prescription_exercise_id", "hand_type", "finger_type", "joint_type"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_finger_setting_exercise_hand_finger_joint",
        "prescription_finger_setting",
        type_="unique",
    )
    op.drop_constraint(
        "ck_finger_setting_joint",
        "prescription_finger_setting",
        type_="check",
    )
    op.create_unique_constraint(
        "uq_finger_setting_exercise_hand_finger",
        "prescription_finger_setting",
        ["prescription_exercise_id", "hand_type", "finger_type"],
    )
    op.drop_column("prescription_finger_setting", "joint_type")
