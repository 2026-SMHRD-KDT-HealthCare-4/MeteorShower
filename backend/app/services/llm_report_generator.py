from __future__ import annotations

import sys
import os
from datetime import date
from pathlib import Path
from statistics import mean
from typing import Any

from dotenv import load_dotenv
from sqlalchemy.orm import Session

def _resolve_project_root() -> Path:
    env_root = os.getenv("PROJECT_ROOT")
    if env_root:
        return Path(env_root).resolve()

    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "backend").exists() and (parent / "ai").exists():
            return parent

    return current.parent


PROJECT_ROOT = _resolve_project_root()
AI_DIR = PROJECT_ROOT / "ai"

load_dotenv(PROJECT_ROOT / "backend" / ".env")
load_dotenv(AI_DIR / ".env")

if AI_DIR.exists() and str(AI_DIR) not in sys.path:
    sys.path.insert(0, str(AI_DIR))

from models.exercise_schedule import ExerciseSchedule
from models.patient import Patient
from models.prescription import Prescription
from models.prescription_exercise import PrescriptionExercise


FINGER_KEY_BY_LABEL = {
    "엄지": "thumb",
    "검지": "index",
    "중지": "middle",
    "약지": "ring",
    "소지": "pinky",
}

FINGER_LABEL_BY_KEY = {value: key for key, value in FINGER_KEY_BY_LABEL.items()}


def _date_text(value: Any) -> str:
    # date/datetime 객체면 ISO 포맷으로, 없으면 "미입력"으로 변환
    if not value:
        return "미입력"
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _average(values: list[float]) -> float:
    return round(mean(values), 1) if values else 0


def _fallback_report_text(data: dict, error: str | None = None) -> str:
    # LLM 호출 실패 시 수집된 운동 데이터로 텍스트 리포트를 대체 생성
    blocked_text = (
        f"운동 차단 사유: {data.get('block_reason') or '사전 문진에서 운동 차단으로 기록되었습니다.'}"
        if data.get("is_blocked")
        else "운동 차단 여부: 없음"
    )
    error_text = f"LLM 리포트 생성 실패: {error}" if error else "LLM 리포트 생성 실패"
    return "\n".join(
        [
            f"{data['session_date']} 재활 리포트 초안입니다.",
            f"환자명: {data['patient_name']}",
            f"재활 단계: {data['rehab_stage']}",
            f"수행 운동: {data['exercise_list']}",
            f"전체 수행률: {data['overall_compliance']}%",
            f"평균 일치율: {data['accuracy_average']}%",
            blocked_text,
            error_text,
            "담당 의사는 저장된 운동 결과와 상세 평가를 확인한 뒤 내용을 수정하고 승인해 주세요.",
        ]
    )


def build_daily_report_data(
    db: Session,
    patient: Patient,
    report_date: date,
    exercise_blocked: bool = False,
) -> dict:
    # 해당 날짜의 운동 스케줄을 조회해 수행률·정확도·ROM 값을 집계하여 LLM 입력용 데이터 딕셔너리로 반환
    schedules = (
        db.query(ExerciseSchedule)
        .join(
            PrescriptionExercise,
            PrescriptionExercise.prescription_exercise_id
            == ExerciseSchedule.prescription_exercise_id,
        )
        .join(Prescription, Prescription.prescription_id == PrescriptionExercise.prescription_id)
        .filter(
            Prescription.patient_id == patient.patient_id,
            ExerciseSchedule.exercise_date == report_date,
        )
        .order_by(ExerciseSchedule.schedule_id)
        .all()
    )

    exercise_names: list[str] = []
    progress_values: list[float] = []
    match_values: list[float] = []
    finger_scores: dict[str, list[float]] = {key: [] for key in FINGER_LABEL_BY_KEY}
    rom_values: dict[str, list[float]] = {
        "thumb_mcp": [],
        "thumb_ip": [],
        "index_mcp": [],
        "index_pip": [],
        "index_dip": [],
        "middle_mcp": [],
        "middle_pip": [],
        "middle_dip": [],
        "ring_mcp": [],
        "ring_pip": [],
        "ring_dip": [],
        "pinky_mcp": [],
        "pinky_pip": [],
        "pinky_dip": [],
    }
    recorded_count = 0
    duration_minutes = 0
    overload_notes: list[str] = []

    for schedule in schedules:
        pe = schedule.prescription_exercise
        exercise_name = pe.exercise.exercise_name if pe and pe.exercise else "운동명 미입력"
        exercise_names.append(exercise_name)

        session = schedule.sessions[0] if schedule.sessions else None
        log = session.logs[0] if session and session.logs else None
        if not log:
            continue

        recorded_count += 1
        if log.progress_rate is not None:
            progress_values.append(float(log.progress_rate))
        else:
            progress_values.append(0)
        if session.start_time and log.end_time:
            duration_minutes += max(0, round((log.end_time - session.start_time).total_seconds() / 60))
        if log.end_type and log.end_type != "완료":
            overload_notes.append(f"{exercise_name}: {log.end_type}")

        for accuracy in log.finger_accuracies:
            finger_key = FINGER_KEY_BY_LABEL.get(accuracy.finger_type)
            joint_key = accuracy.joint_type.lower() if accuracy.joint_type else ""
            if not finger_key:
                continue
            if accuracy.avg_match_rate is not None:
                value = float(accuracy.avg_match_rate)
                match_values.append(value)
                finger_scores[finger_key].append(value)
            if accuracy.max_angle is not None:
                if finger_key == "thumb" and joint_key == "ip":
                    rom_values["thumb_ip"].append(float(accuracy.max_angle))
                else:
                    key = f"{finger_key}_{joint_key}"
                    if key in rom_values:
                        rom_values[key].append(float(accuracy.max_angle))

    total_count = len(schedules)
    overall_compliance = round(sum(progress_values) / total_count) if total_count else 0
    accuracy_average = _average(match_values) or _average(progress_values)
    exercise_list = ", ".join(dict.fromkeys(exercise_names)) if exercise_names else "저장된 운동 없음"

    data = {
        "patient_name": patient.name,
        "gender": patient.gender or "미입력",
        "birth_date": _date_text(patient.birth_date),
        "surgery_name": patient.surgery_name or "미입력",
        "surgery_date": _date_text(patient.surgery_date),
        "rehab_start_date": _date_text(patient.rehab_start_date),
        "rehab_stage": patient.current_rehab_phase or "미지정",
        "session_date": report_date.isoformat(),
        "session_status": "운동차단" if exercise_blocked else ("운동기록 있음" if recorded_count else "운동기록 없음"),
        "is_blocked": exercise_blocked,
        "block_reason": "사전 문진에서 운동 차단으로 기록되었습니다." if exercise_blocked else "",
        "exercise_duration": duration_minutes,
        "exercise_list": exercise_list,
        "overall_compliance": overall_compliance,
        "accuracy_average": accuracy_average,
        "questionnaire_result": "사전 문진 특이사항 없음",
        "overload_occurred": ", ".join(overload_notes) if overload_notes else "없음",
    }

    for finger_key in FINGER_LABEL_BY_KEY:
        data[f"{finger_key}_score"] = _average(finger_scores[finger_key])

    for key, values in rom_values.items():
        data[key] = round(max(values), 1) if values else 0

    return data


def generate_daily_report_content(
    db: Session,
    patient: Patient,
    report_date: date,
    exercise_blocked: bool = False,
) -> str:
    # LLM 클라이언트 로드 실패 또는 생성 오류 시 폴백 텍스트로 대체
    data = build_daily_report_data(db, patient, report_date, exercise_blocked)

    try:
        from llm_client import generate_daily_report
    except Exception as exc:
        return _fallback_report_text(data, f"LLM 모듈 로드 실패: {exc}")

    result = generate_daily_report(data)
    if result.get("success") and result.get("report_text"):
        return result["report_text"]

    return _fallback_report_text(data, result.get("error"))


def generate_monthly_report_summary(patient: Patient, weeks: list[dict]) -> dict:
    # 주차별 운동 수행 데이터를 정리해 LLM으로 월간 요약(summary)과 키워드(keywords)를 생성
    weekly_data = [
        {
            "week": index + 1,
            "achievement": week.get("overallCompliance") or 0,
            "compliance": week.get("accuracyAvg") or 0,
            "block_count": 0,
            "overload_count": sum(
                1
                for exercise in week.get("exercises", [])
                if exercise.get("accuracy") is not None and exercise.get("accuracy") < 70
            ),
        }
        for index, week in enumerate(weeks)
    ]
    exercise_data = []
    exercise_names = sorted(
        {
            exercise.get("name")
            for week in weeks
            for exercise in week.get("exercises", [])
            if exercise.get("name")
        }
    )
    for name in exercise_names:
        compliances = [
            exercise.get("compliance")
            for week in weeks
            for exercise in week.get("exercises", [])
            if exercise.get("name") == name and exercise.get("compliance") is not None
        ]
        accuracies = [
            exercise.get("accuracy")
            for week in weeks
            for exercise in week.get("exercises", [])
            if exercise.get("name") == name and exercise.get("accuracy") is not None
        ]
        exercise_data.append(
            {
                "name": name,
                "achievement": _average([float(value) for value in compliances]),
                "compliance": _average([float(value) for value in accuracies]),
            }
        )

    rom_data = []
    for week in weeks:
        for exercise in week.get("rom", []):
            for finger in exercise.get("fingers", []):
                for joint in finger.get("joints", []):
                    rom_data.append(
                        {
                            "finger": finger.get("label") or finger.get("key") or "",
                            "joint": joint.get("name") or "",
                            "target": joint.get("ref") or 0,
                            "min": joint.get("min") or 0,
                            "max": joint.get("max") or 0,
                            "achievement": joint.get("achievement") or 0,
                        }
                    )

    data = {
        "patient_name": patient.name,
        "surgery_name": patient.surgery_name or "미입력",
        "rehab_duration": len(weeks),
        "exercise_count": len(exercise_names),
        "weekly_data": weekly_data,
        "exercise_data": exercise_data,
        "rom_data": rom_data,
    }

    try:
        from llm_client import generate_monthly_report
    except Exception:
        return {"summary": None, "keywords": []}

    result = generate_monthly_report(data)
    if result.get("success"):
        return {
            "summary": result.get("summary"),
            "keywords": result.get("keywords") or [],
        }

    return {"summary": None, "keywords": []}
