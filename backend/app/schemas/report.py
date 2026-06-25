from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel

from schemas.prescription import PrescriptionExerciseRequest


class LlmReportCreateRequest(BaseModel):
    patient_id: int
    report_date: Optional[date] = None
    exercise_blocked: bool = False


MockReportCreateRequest = LlmReportCreateRequest


class ReportUpdateRequest(BaseModel):
    edited_content: str


class ReportApproveRequest(BaseModel):
    edited_content: Optional[str] = None
    rehab_phase: Optional[str] = None
    exercises: List[PrescriptionExerciseRequest] = []
    schedule: Dict[str, bool] = {}
    rom: Dict[str, float] = {}
    prescription_date: Optional[date] = None
