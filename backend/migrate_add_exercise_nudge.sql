-- 운동 미수행 리마인더(nudge) 기능을 위한 patient_notification 테이블 마이그레이션.
-- models/patient_notification.py 변경 사항을 실제 DB에 반영한다.
-- 실행: psql -d <db_name> -f migrate_add_exercise_nudge.sql

BEGIN;

-- 1. notification_type CHECK 제약에 '운동미수행' 추가
ALTER TABLE patient_notification DROP CONSTRAINT IF EXISTS ck_patient_notification_type;
ALTER TABLE patient_notification ADD CONSTRAINT ck_patient_notification_type
    CHECK (notification_type IN ('처방등록', '운동미수행'));

-- 2. nudge_step 컬럼 추가 (1~7, 운동미수행이 아닌 알림은 NULL)
ALTER TABLE patient_notification ADD COLUMN IF NOT EXISTS nudge_step INTEGER;

COMMIT;
