"""sync patient rom setting constraints

Revision ID: e8c2a6f4b9d1
Revises: d1e2f3a4b5c6
Create Date: 2026-06-22 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "e8c2a6f4b9d1"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
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


def _add_check_constraint(table_name: str, constraint_name: str, expression: str) -> None:
    _drop_constraint_if_exists(table_name, constraint_name)
    op.execute(
        f"""
        ALTER TABLE {table_name}
        ADD CONSTRAINT {constraint_name}
        CHECK ({expression});
        """
    )


def upgrade() -> None:
    op.execute("ALTER TABLE patient_rom_setting ADD COLUMN IF NOT EXISTS exercise_type VARCHAR(20)")
    op.execute("UPDATE patient_rom_setting SET exercise_type = 'grip' WHERE exercise_type IS NULL")
    op.execute("ALTER TABLE patient_rom_setting ALTER COLUMN exercise_type SET NOT NULL")

    op.execute("ALTER TABLE patient_rom_setting ADD COLUMN IF NOT EXISTS hand_type VARCHAR(10)")
    op.execute("UPDATE patient_rom_setting SET hand_type = '오른손' WHERE hand_type IS NULL")
    op.execute("ALTER TABLE patient_rom_setting ALTER COLUMN hand_type SET NOT NULL")

    _add_check_constraint(
        "patient_rom_setting",
        "ck_finger_setting_hand",
        "hand_type IN ('왼손', '오른손')",
    )
    _add_check_constraint(
        "patient_rom_setting",
        "ck_finger_setting_finger",
        "finger_type IN ('엄지', '검지', '중지', '약지', '소지')",
    )
    _add_check_constraint(
        "patient_rom_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
    )

    _add_check_constraint(
        "prescription_finger_setting",
        "ck_finger_setting_hand",
        "hand_type IN ('왼손', '오른손')",
    )
    _add_check_constraint(
        "prescription_finger_setting",
        "ck_finger_setting_finger",
        "finger_type IN ('엄지', '검지', '중지', '약지', '소지')",
    )
    _add_check_constraint(
        "prescription_finger_setting",
        "ck_finger_setting_joint",
        "joint_type IN ('MCP', 'PIP', 'DIP', 'IP')",
    )

    op.execute(
        """
        DO $$
        DECLARE
            constraint_name text;
        BEGIN
            SELECT c.conname INTO constraint_name
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN unnest(c.conkey) WITH ORDINALITY AS cols(attnum, ord) ON true
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = cols.attnum
            WHERE t.relname = 'patient_rom_setting'
              AND c.contype = 'u'
            GROUP BY c.conname
            HAVING array_agg(a.attname::text ORDER BY cols.ord) = ARRAY['patient_id', 'finger_type', 'joint_type'];

            IF constraint_name IS NOT NULL THEN
                EXECUTE format(
                    'ALTER TABLE patient_rom_setting DROP CONSTRAINT %I',
                    constraint_name
                );
            END IF;
        END $$;
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_constraint c
                JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'patient_rom_setting'
                  AND c.conname = 'uq_patient_rom_setting_patient_exercise_hand_finger_joint'
            ) THEN
                ALTER TABLE patient_rom_setting
                ADD CONSTRAINT uq_patient_rom_setting_patient_exercise_hand_finger_joint
                UNIQUE (patient_id, exercise_type, hand_type, finger_type, joint_type);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    _drop_constraint_if_exists(
        "patient_rom_setting",
        "uq_patient_rom_setting_patient_exercise_hand_finger_joint",
    )
    _drop_constraint_if_exists("patient_rom_setting", "ck_finger_setting_joint")
    _drop_constraint_if_exists("patient_rom_setting", "ck_finger_setting_finger")
    _drop_constraint_if_exists("patient_rom_setting", "ck_finger_setting_hand")

    _drop_constraint_if_exists("prescription_finger_setting", "ck_finger_setting_joint")
    _drop_constraint_if_exists("prescription_finger_setting", "ck_finger_setting_finger")
    _drop_constraint_if_exists("prescription_finger_setting", "ck_finger_setting_hand")

    op.execute(
        """
        ALTER TABLE patient_rom_setting
        ADD CONSTRAINT patient_rom_setting_patient_id_finger_type_joint_type_key
        UNIQUE (patient_id, finger_type, joint_type);
        """
    )
    op.execute("ALTER TABLE patient_rom_setting DROP COLUMN IF EXISTS hand_type")
    op.execute("ALTER TABLE patient_rom_setting DROP COLUMN IF EXISTS exercise_type")
