"""add patient approval status and notification nudge

Revision ID: j5e6f7g8h9i0
Revises: i4d5e6f7g8h9
Create Date: 2026-06-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "j5e6f7g8h9i0"
down_revision: Union[str, Sequence[str], None] = "i4d5e6f7g8h9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _drop_constraint_if_exists(table_name: str, constraint_name: str) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = '{table_name}'
                  AND c.conname = '{constraint_name}'
            ) THEN
                ALTER TABLE {table_name} DROP CONSTRAINT {constraint_name};
            END IF;
        END $$;
        """
    )


def _add_check_constraint_if_not_exists(
    table_name: str,
    constraint_name: str,
    expression: str,
) -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = '{table_name}'
                  AND c.conname = '{constraint_name}'
            ) THEN
                ALTER TABLE {table_name}
                ADD CONSTRAINT {constraint_name}
                CHECK ({expression});
            END IF;
        END $$;
        """
    )


def upgrade() -> None:
    op.execute("ALTER TABLE patient ADD COLUMN IF NOT EXISTS approval_status VARCHAR(10)")
    op.execute("UPDATE patient SET approval_status = '승인' WHERE approval_status IS NULL")
    op.execute("ALTER TABLE patient ALTER COLUMN approval_status SET DEFAULT '승인'")
    op.execute("ALTER TABLE patient ALTER COLUMN approval_status SET NOT NULL")
    _add_check_constraint_if_not_exists(
        "patient",
        "ck_patient_approval_status",
        "approval_status IN ('대기', '승인')",
    )

    _drop_constraint_if_exists("patient_notification", "ck_patient_notification_type")
    op.execute(
        """
        ALTER TABLE patient_notification
        ADD CONSTRAINT ck_patient_notification_type
        CHECK (notification_type IN ('처방등록', '운동미수행'));
        """
    )
    op.execute("ALTER TABLE patient_notification ADD COLUMN IF NOT EXISTS nudge_step INTEGER")


def downgrade() -> None:
    op.execute("ALTER TABLE patient_notification DROP COLUMN IF EXISTS nudge_step")
    _drop_constraint_if_exists("patient_notification", "ck_patient_notification_type")
    op.execute(
        """
        ALTER TABLE patient_notification
        ADD CONSTRAINT ck_patient_notification_type
        CHECK (notification_type IN ('처방등록'));
        """
    )

    _drop_constraint_if_exists("patient", "ck_patient_approval_status")
    op.execute("ALTER TABLE patient DROP COLUMN IF EXISTS approval_status")
