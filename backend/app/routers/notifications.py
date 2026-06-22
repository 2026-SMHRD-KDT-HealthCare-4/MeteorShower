from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_token_payload
from models.patient_notification import PatientNotification

router = APIRouter(prefix="/patients/me/notifications", tags=["notifications"])


def _notif_to_dict(n: PatientNotification) -> dict:
    return {
        "id": n.notification_id,
        "type": n.notification_type,
        "message": n.notification_content,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }


@router.get("")
def get_notifications(
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    if payload["role"] != "patient":
        raise HTTPException(status_code=403, detail="patient role required")
    patient_id = int(payload["sub"])
    notifs = (
        db.query(PatientNotification)
        .filter(PatientNotification.patient_id == patient_id)
        .order_by(PatientNotification.created_at.desc())
        .all()
    )
    return [_notif_to_dict(n) for n in notifs]


@router.patch("/{notification_id}/read")
def mark_one_read(
    notification_id: int,
    payload: dict = Depends(get_token_payload),
    db: Session = Depends(get_db),
):
    if payload["role"] != "patient":
        raise HTTPException(status_code=403, detail="patient role required")
    patient_id = int(payload["sub"])
    notif = db.query(PatientNotification).filter(
        PatientNotification.notification_id == notification_id,
        PatientNotification.patient_id == patient_id,
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
):
    if payload["role"] != "patient":
        raise HTTPException(status_code=403, detail="patient role required")
    patient_id = int(payload["sub"])
    db.query(PatientNotification).filter(
        PatientNotification.patient_id == patient_id,
        PatientNotification.is_read == False,
    ).update({"is_read": True})
    db.commit()
    return {"message": "모든 알림을 읽음 처리했습니다."}
