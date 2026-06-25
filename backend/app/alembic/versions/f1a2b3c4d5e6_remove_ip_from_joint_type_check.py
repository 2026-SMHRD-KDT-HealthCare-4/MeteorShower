"""remove IP from joint_type check constraints

Revision ID: f1a2b3c4d5e6
Revises: e8c2a6f4b9d1
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "f1a2b3c4d5e6"
down_revision: Union[str, Sequence[str], None] = "e8c2a6f4b9d1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _replace_joint_check(table_name: str, constraint_name: str, expression: str) -> None:
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
    op.execute(
        f"""
        ALTER TABLE {table_name}
        ADD CONSTRAINT {constraint_name}
        CHECK ({expression});
        """
    )


def upgrade() -> None:
    _replace_joint_check(
        "patient_rom_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP')",
    )
    _replace_joint_check(
        "prescription_finger_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP')",
    )


def downgrade() -> None:
    _replace_joint_check(
        "patient_rom_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
    )
    _replace_joint_check(
        "prescription_finger_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
    )
