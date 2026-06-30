"""
중복 처방 정리 스크립트
- 각 환자별로 '적용중' 처방을 1개만 남기고 나머지를 '종료'로 변경
- 실행: python cleanup_prescriptions.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'app'))

from database import SessionLocal
from models.prescription import Prescription
from sqlalchemy import func

db = SessionLocal()

try:
    # 환자별 처방 현황 출력
    from sqlalchemy import text
    result = db.execute(text("""
        SELECT patient_id, status, COUNT(*) as cnt
        FROM prescription
        GROUP BY patient_id, status
        ORDER BY patient_id, status
    """)).fetchall()

    print("=== 현재 처방 현황 ===")
    for row in result:
        print(f"  환자 {row[0]} | {row[1]} | {row[2]}개")

    # 환자 ID 목록
    patient_ids = db.execute(text(
        "SELECT DISTINCT patient_id FROM prescription"
    )).scalars().fetchall()

    fixed = 0
    for patient_id in patient_ids:
        active = (
            db.query(Prescription)
            .filter(
                Prescription.patient_id == patient_id,
                Prescription.status == "적용중",
            )
            .order_by(Prescription.created_at.desc())
            .all()
        )

        if len(active) > 1:
            # 가장 최근 1개만 남기고 나머지 종료
            keep = active[0]
            for dup in active[1:]:
                dup.status = "종료"
                fixed += 1
                print(f"  환자 {patient_id}: prescription_id={dup.prescription_id} → 종료 처리")

    db.commit()

    # 결과 재출력
    result2 = db.execute(text("""
        SELECT patient_id, status, COUNT(*) as cnt
        FROM prescription
        GROUP BY patient_id, status
        ORDER BY patient_id, status
    """)).fetchall()

    print(f"\n=== 정리 완료 ({fixed}개 중복 처방 종료 처리) ===")
    for row in result2:
        print(f"  환자 {row[0]} | {row[1]} | {row[2]}개")

except Exception as e:
    db.rollback()
    print(f"오류 발생: {e}")
    raise
finally:
    db.close()
