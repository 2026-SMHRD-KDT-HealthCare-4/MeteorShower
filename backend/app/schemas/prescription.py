from datetime import date
from typing import Dict, List, Optional

from pydantic import BaseModel


class PrescriptionExerciseRequest(BaseModel):
    name: str
    sets: int
    reps: int
    enabled: bool = True


class PrescriptionSaveRequest(BaseModel):
    rehab_phase: Optional[str] = None
    exercises: List[PrescriptionExerciseRequest]
    schedule: Dict[str, bool] = {}
    prescription_date: Optional[date] = None
