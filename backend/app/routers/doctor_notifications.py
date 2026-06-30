from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_token_payload
from models.doctor_notification import DoctorNotification

router = APIRouter(prefix="/doctor/me/notifications", tags=["doctor-notifications"])


def _notif_to_dict(n: DoctorNotification) -> dict:
    return {
        "id": n.notification_id,
        "type": n.notification_type,
        "patient": n.patient.name if n.patient else None,
        "patient_id": n.patient_id,
        "message": n.notification_content,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("")
def get_doctor_notifications(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> list[dict]:
    if payload["role"] != "doctor":
        raise HTTPException(status_code=403, detail="doctor role required")
    doctor_id = int(payload["sub"])
    notifs = (
        db.query(DoctorNotification)
        .filter(DoctorNotification.doctor_id == doctor_id)
        .order_by(DoctorNotification.created_at.desc())
        .all()
    )
    return [_notif_to_dict(n) for n in notifs]


@router.patch("/{notification_id}/read")
def mark_one_read(
    notification_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    if payload["role"] != "doctor":
        raise HTTPException(status_code=403, detail="doctor role required")
    doctor_id = int(payload["sub"])
    notif = db.query(DoctorNotification).filter(
        DoctorNotification.notification_id == notification_id,
        DoctorNotification.doctor_id == doctor_id,
    ).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return _notif_to_dict(notif)


@router.patch("/read-all")
def mark_all_read(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
) -> dict:
    # 해당 의사의 읽지 않은 알림 전체를 한 번의 쿼리로 일괄 읽음 처리
    if payload["role"] != "doctor":
        raise HTTPException(status_code=403, detail="doctor role required")
    doctor_id = int(payload["sub"])
    db.query(DoctorNotification).filter(
        DoctorNotification.doctor_id == doctor_id,
        DoctorNotification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "모든 알림을 읽음 처리했습니다."}
