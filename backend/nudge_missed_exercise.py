"""
운동 미수행 리마인더(nudge) 배치 스크립트
- '적용중' 처방을 가진 환자 중, 대상 날짜에 운동이 지정됐는데 하나도 수행하지 않은
  환자에게 단계별(1~7 순환) 넛지 메시지를 patient_notification에 쌓는다.
- 하루 한 번 실행 가정. 같은 날 이미 보낸 환자는 스킵해서 중복 INSERT를 막는다.
- 실행: python nudge_missed_exercise.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from datetime import date

from sqlalchemy import func

from database import SessionLocal
from models.patient import Patient
from models.prescription import Prescription
from models.prescription_exercise import PrescriptionExercise
from models.exercise_schedule import ExerciseSchedule
from models.rehab_exercise_session import RehabExerciseSession
from models.patient_notification import PatientNotification


# 회차(nudge_step)별 메시지. {name}/{josa}가 있는 메시지는 환자 이름 + 호격조사로 치환한다.
NUDGE_MESSAGES = {
    1: "많이 바쁘신가요?",
    2: "오늘 운동을 수행하지 않았어요.",
    3: "{name}{josa} {name}{josa} 뭐하니?",
    4: "지금이라도 늦지 않았어요.",
    5: "손 재활을 포기하신 건 아니죠?",
    6: "옆집 어르신은 이미 끝났대요~",
    7: "이제 포기할게요.",
}


def get_vocative_particle(name: str) -> str:
    """한글 이름의 호격조사(아/야)를 마지막 글자 받침 유무로 판별.

    한글 음절(가~힣) 범위면 (코드 - 0xAC00) % 28 로 받침 유무를 보고,
    한글 음절이 아니면(영문 등) 기본값 "아"를 쓴다.
    """
    if not name:
        return "아"
    code = ord(name[-1])
    if 0xAC00 <= code <= 0xD7A3:
        has_final_consonant = (code - 0xAC00) % 28 != 0
        return "아" if has_final_consonant else "야"
    return "아"


def build_nudge_message(step: int, patient_name: str) -> str:
    template = NUDGE_MESSAGES[step]
    if "{name}" in template:
        josa = get_vocative_particle(patient_name)
        return template.format(name=patient_name, josa=josa)
    return template


def find_missed_patients(db, target_date: date) -> list[int]:
    """target_date에 운동이 지정됐지만 하나도 수행하지 않은 환자 id 목록.

    체인: prescription(적용중) → prescription_exercise → exercise_schedule.
    그날 지정된 schedule 전부에 rehab_exercise_session이 하나도 없을 때만 미수행으로
    판정한다(일부 schedule에라도 session이 있으면 그날은 운동한 것으로 봄).
    """
    rows = (
        db.query(Patient.patient_id, ExerciseSchedule.schedule_id)
        .join(Prescription, Prescription.patient_id == Patient.patient_id)
        .join(
            PrescriptionExercise,
            PrescriptionExercise.prescription_id == Prescription.prescription_id,
        )
        .join(
            ExerciseSchedule,
            ExerciseSchedule.prescription_exercise_id
            == PrescriptionExercise.prescription_exercise_id,
        )
        .filter(
            Prescription.status == "적용중",
            ExerciseSchedule.exercise_date == target_date,
        )
        .all()
    )

    schedule_ids_by_patient: dict[int, list[int]] = {}
    for patient_id, schedule_id in rows:
        schedule_ids_by_patient.setdefault(patient_id, []).append(schedule_id)

    missed_patient_ids = []
    for patient_id, schedule_ids in schedule_ids_by_patient.items():
        has_session = (
            db.query(RehabExerciseSession.rehab_session_id)
            .filter(RehabExerciseSession.schedule_id.in_(schedule_ids))
            .first()
            is not None
        )
        if not has_session:
            missed_patient_ids.append(patient_id)

    return missed_patient_ids


def compute_next_nudge_step(db, patient_id: int) -> int:
    """이 환자의 가장 최근 운동미수행 알림 nudge_step을 보고 다음 step(1~7 순환)을 계산."""
    last = (
        db.query(PatientNotification.nudge_step)
        .filter(
            PatientNotification.patient_id == patient_id,
            PatientNotification.notification_type == "운동미수행",
        )
        .order_by(PatientNotification.created_at.desc())
        .first()
    )
    prev_step = last[0] if last and last[0] is not None else 0
    return (prev_step % 7) + 1


def already_notified_today(db, patient_id: int, target_date: date) -> bool:
    """같은 날 중복 실행 방지 — 오늘 이미 운동미수행 알림을 보냈는지 확인."""
    existing = (
        db.query(PatientNotification.notification_id)
        .filter(
            PatientNotification.patient_id == patient_id,
            PatientNotification.notification_type == "운동미수행",
            func.date(PatientNotification.created_at) == target_date,
        )
        .first()
    )
    return existing is not None


def run(target_date: date = None, dry_run: bool = False):
    if target_date is None:
        target_date = date.today()

    db = SessionLocal()
    sent = 0
    skipped = 0
    try:
        missed_patient_ids = find_missed_patients(db, target_date)
        print(f"=== {target_date} 운동 미수행 환자: {len(missed_patient_ids)}명 ===")

        for patient_id in missed_patient_ids:
            if already_notified_today(db, patient_id, target_date):
                skipped += 1
                print(f"  환자 {patient_id}: 오늘 이미 발송됨 → 스킵")
                continue

            patient = db.query(Patient).filter(Patient.patient_id == patient_id).first()
            if patient is None:
                continue

            step = compute_next_nudge_step(db, patient_id)
            message = build_nudge_message(step, patient.name)

            if not dry_run:
                db.add(PatientNotification(
                    patient_id=patient_id,
                    notification_type="운동미수행",
                    notification_content=message,
                    nudge_step=step,
                    is_read=False,
                ))
            sent += 1
            prefix = "[DRY] " if dry_run else ""
            print(f"  {prefix}환자 {patient_id} ({patient.name}): {step}회차 → \"{message}\"")

        if dry_run:
            db.rollback()
            print(f"\n=== [드라이런] {sent}건 발송 예정, {skipped}건 스킵 (실제 INSERT 안 함) ===")
        else:
            db.commit()
            print(f"\n=== 완료: {sent}건 발송, {skipped}건 스킵 ===")

    except Exception as e:
        db.rollback()
        print(f"오류 발생: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import sys
    dry = "--dry-run" in sys.argv
    # 특정 날짜 테스트: python nudge_missed_exercise.py 2026-06-25
    target = None
    for arg in sys.argv[1:]:
        if arg != "--dry-run":
            from datetime import datetime
            target = datetime.strptime(arg, "%Y-%m-%d").date()
    run(target_date=target, dry_run=dry)
