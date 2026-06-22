from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel


class PatientUpdateRequest(BaseModel):
    phone: Optional[str] = None
    guardian_email: Optional[str] = None
    report_consent: Optional[bool] = None


class PatientAssignRequest(BaseModel):
    surgery_area: Optional[str] = None
    surgery_name: Optional[str] = None
    surgery_date: Optional[date] = None
    rehab_start_date: Optional[date] = None
    current_rehab_phase: Optional[str] = None
    appointment_date: Optional[date] = None


class PatientMedicalUpdateRequest(BaseModel):
    surgery_name: Optional[str] = None
    surgery_area: Optional[str] = None
    surgery_date: Optional[date] = None
    rehab_start_date: Optional[date] = None
    current_rehab_phase: Optional[str] = None
    appointment_date: Optional[date] = None


class PatientRomUpdateRequest(BaseModel):
    exercise_type: str = 'grip'
    rom: Dict[str, float] = {}


class FingerAccuracyRequest(BaseModel):
    hand_type: str
    finger_type: str
    accuracy: float
    rom: float


class ExerciseSessionCreateRequest(BaseModel):
    schedule_id: int
    performed_reps: Optional[int] = None
    performed_sets: Optional[int] = None
    progress_rate: Optional[float] = None
    end_type: str = "완료"
    finger_accuracy: List[FingerAccuracyRequest] = []


class PrescriptionExerciseItem(BaseModel):
    exercise_id: int
    target_reps: int
    target_sets: int
    exercise_order: int


class SavePrescriptionRequest(BaseModel):
    rehab_phase: str
    exercises: List[PrescriptionExerciseItem]


class PatientResponse(BaseModel):
    patient_id: int
    doctor_id: Optional[int] = None
    login_id: str
    name: str
    birth_date: date
    gender: str
    phone: str
    patient_code: str
    hospital_name: Optional[str] = None
    surgery_name: Optional[str] = None
    surgery_area: Optional[str] = None
    surgery_date: Optional[date] = None
    rehab_start_date: Optional[date] = None
    current_rehab_phase: Optional[str] = None
    guardian_email: Optional[str] = None
    report_consent: bool
    ai_difficulty_enabled: bool
    appointment_date: Optional[date] = None
