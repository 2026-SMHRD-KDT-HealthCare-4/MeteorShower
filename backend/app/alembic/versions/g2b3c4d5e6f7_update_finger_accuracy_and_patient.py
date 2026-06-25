"""update finger_accuracy columns and add overall_evaluation to patient

Revision ID: g2b3c4d5e6f7
Revises: f1a2b3c4d5e6
Create Date: 2026-06-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "g2b3c4d5e6f7"
down_revision: Union[str, Sequence[str], None] = "f1a2b3c4d5e6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── patient 테이블: overall_evaluation 컬럼 추가 ──
    op.execute(
        "ALTER TABLE patient ADD COLUMN IF NOT EXISTS overall_evaluation TEXT"
    )

    # ── finger_accuracy 테이블 변경 ──

    # 1. 기존 UniqueConstraint 제거
    op.execute(
        """
        DO $$
        DECLARE constraint_name text;
        BEGIN
            SELECT c.conname INTO constraint_name
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            WHERE t.relname = 'finger_accuracy'
              AND c.contype = 'u';
            IF constraint_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE finger_accuracy DROP CONSTRAINT %I', constraint_name);
            END IF;
        END $$;
        """
    )

    # 2. 기존 CheckConstraint 제거
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'finger_accuracy' AND c.conname = 'ck_finger_accuracy_hand'
            ) THEN
                ALTER TABLE finger_accuracy DROP CONSTRAINT ck_finger_accuracy_hand;
            END IF;
        END $$;
        """
    )

    # 3. hand_type 컬럼 삭제
    op.execute(
        "ALTER TABLE finger_accuracy DROP COLUMN IF EXISTS hand_type"
    )

    # 4. accuracy 컬럼 삭제
    op.execute(
        "ALTER TABLE finger_accuracy DROP COLUMN IF EXISTS accuracy"
    )

    # 5. rom 컬럼 삭제
    op.execute(
        "ALTER TABLE finger_accuracy DROP COLUMN IF EXISTS rom"
    )

    # 6. 새 컬럼 추가
    op.execute(
        "ALTER TABLE finger_accuracy ADD COLUMN IF NOT EXISTS joint_type VARCHAR(10)"
    )
    op.execute(
        "UPDATE finger_accuracy SET joint_type = 'MCP' WHERE joint_type IS NULL"
    )
    op.execute(
        "ALTER TABLE finger_accuracy ALTER COLUMN joint_type SET NOT NULL"
    )
    op.execute(
        "ALTER TABLE finger_accuracy ADD COLUMN IF NOT EXISTS max_angle NUMERIC(6, 2)"
    )
    op.execute(
        "ALTER TABLE finger_accuracy ADD COLUMN IF NOT EXISTS min_angle NUMERIC(6, 2)"
    )
    op.execute(
        "ALTER TABLE finger_accuracy ADD COLUMN IF NOT EXISTS avg_match_rate NUMERIC(5, 2)"
    )

    # 7. joint_type CheckConstraint 추가
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'finger_accuracy' AND c.conname = 'ck_finger_accuracy_joint'
            ) THEN
                ALTER TABLE finger_accuracy
                ADD CONSTRAINT ck_finger_accuracy_joint
                CHECK (joint_type IN ('MCP', 'PIP', 'DIP'));
            END IF;
        END $$;
        """
    )

    # 8. 새 UniqueConstraint 추가
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'finger_accuracy' AND c.conname = 'uq_finger_accuracy_log_finger_joint'
            ) THEN
                ALTER TABLE finger_accuracy
                ADD CONSTRAINT uq_finger_accuracy_log_finger_joint
                UNIQUE (rehab_exercise_log_id, finger_type, joint_type);
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    # patient: overall_evaluation 컬럼 제거
    op.execute(
        "ALTER TABLE patient DROP COLUMN IF EXISTS overall_evaluation"
    )

    # finger_accuracy: 새 UniqueConstraint 제거
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'finger_accuracy' AND c.conname = 'uq_finger_accuracy_log_finger_joint'
            ) THEN
                ALTER TABLE finger_accuracy DROP CONSTRAINT uq_finger_accuracy_log_finger_joint;
            END IF;
        END $$;
        """
    )

    # finger_accuracy: joint_type CheckConstraint 제거
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
                WHERE t.relname = 'finger_accuracy' AND c.conname = 'ck_finger_accuracy_joint'
            ) THEN
                ALTER TABLE finger_accuracy DROP CONSTRAINT ck_finger_accuracy_joint;
            END IF;
        END $$;
        """
    )

    # finger_accuracy: 새 컬럼 제거
    op.execute("ALTER TABLE finger_accuracy DROP COLUMN IF EXISTS avg_match_rate")
    op.execute("ALTER TABLE finger_accuracy DROP COLUMN IF EXISTS min_angle")
    op.execute("ALTER TABLE finger_accuracy DROP COLUMN IF EXISTS max_angle")
    op.execute("ALTER TABLE finger_accuracy DROP COLUMN IF EXISTS joint_type")

    # finger_accuracy: 기존 컬럼 복원
    op.execute("ALTER TABLE finger_accuracy ADD COLUMN IF NOT EXISTS rom NUMERIC(6, 2)")
    op.execute("ALTER TABLE finger_accuracy ADD COLUMN IF NOT EXISTS accuracy NUMERIC(5, 2)")
    op.execute("ALTER TABLE finger_accuracy ADD COLUMN IF NOT EXISTS hand_type VARCHAR(10)")
    op.execute("UPDATE finger_accuracy SET hand_type = '오른손' WHERE hand_type IS NULL")
    op.execute("ALTER TABLE finger_accuracy ALTER COLUMN hand_type SET NOT NULL")

    # finger_accuracy: 기존 CheckConstraint 복원
    op.execute(
        """
        ALTER TABLE finger_accuracy
        ADD CONSTRAINT ck_finger_accuracy_hand
        CHECK (hand_type IN ('왼손', '오른손'));
        """
    )

    # finger_accuracy: 기존 UniqueConstraint 복원
    op.execute(
        """
        ALTER TABLE finger_accuracy
        ADD CONSTRAINT uq_finger_accuracy_log_hand_finger
        UNIQUE (rehab_exercise_log_id, hand_type, finger_type);
        """
    )
