"""allow IP in joint_type constraints

Revision ID: h3c4d5e6f7g8
Revises: g2b3c4d5e6f7
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "h3c4d5e6f7g8"
down_revision: Union[str, Sequence[str], None] = "g2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _replace_check(table_name: str, constraint_name: str, expression: str) -> None:
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


def _migrate_thumb_pip_to_ip(table_name: str, id_column: str, unique_columns: list[str]) -> None:
    duplicate_match = " AND ".join([f"ip.{column} = pip.{column}" for column in unique_columns])
    op.execute(
        f"""
        DELETE FROM {table_name} pip
        USING {table_name} ip
        WHERE pip.{id_column} <> ip.{id_column}
          AND pip.finger_type = '엄지'
          AND pip.joint_type = 'PIP'
          AND ip.finger_type = '엄지'
          AND ip.joint_type = 'IP'
          AND {duplicate_match};
        """
    )
    op.execute(
        f"""
        UPDATE {table_name}
        SET joint_type = 'IP'
        WHERE finger_type = '엄지'
          AND joint_type = 'PIP';
        """
    )


def _migrate_thumb_ip_to_pip(table_name: str, id_column: str, unique_columns: list[str]) -> None:
    duplicate_match = " AND ".join([f"pip.{column} = ip.{column}" for column in unique_columns])
    op.execute(
        f"""
        DELETE FROM {table_name} ip
        USING {table_name} pip
        WHERE ip.{id_column} <> pip.{id_column}
          AND ip.finger_type = '엄지'
          AND ip.joint_type = 'IP'
          AND pip.finger_type = '엄지'
          AND pip.joint_type = 'PIP'
          AND {duplicate_match};
        """
    )
    op.execute(
        f"""
        UPDATE {table_name}
        SET joint_type = 'PIP'
        WHERE finger_type = '엄지'
          AND joint_type = 'IP';
        """
    )


def upgrade() -> None:
    _replace_check(
        "patient_rom_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
    )
    _replace_check(
        "prescription_finger_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
    )
    _replace_check(
        "finger_accuracy",
        "ck_finger_accuracy_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
    )
    _migrate_thumb_pip_to_ip(
        "patient_rom_setting",
        "patient_rom_setting_id",
        ["patient_id", "exercise_type", "hand_type"],
    )
    _migrate_thumb_pip_to_ip(
        "prescription_finger_setting",
        "finger_setting_id",
        ["prescription_exercise_id", "hand_type"],
    )
    _migrate_thumb_pip_to_ip(
        "finger_accuracy",
        "finger_accuracy_id",
        ["rehab_exercise_log_id"],
    )


def downgrade() -> None:
    _migrate_thumb_ip_to_pip(
        "patient_rom_setting",
        "patient_rom_setting_id",
        ["patient_id", "exercise_type", "hand_type"],
    )
    _migrate_thumb_ip_to_pip(
        "prescription_finger_setting",
        "finger_setting_id",
        ["prescription_exercise_id", "hand_type"],
    )
    _migrate_thumb_ip_to_pip(
        "finger_accuracy",
        "finger_accuracy_id",
        ["rehab_exercise_log_id"],
    )
    _replace_check(
        "patient_rom_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP')",
    )
    _replace_check(
        "prescription_finger_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP')",
    )
    _replace_check(
        "finger_accuracy",
        "ck_finger_accuracy_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP')",
    )
