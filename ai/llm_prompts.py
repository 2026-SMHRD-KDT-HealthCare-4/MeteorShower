"""LLM(OpenAI) 호출용 system/user 프롬프트를 조립하는 함수 모음."""
from typing import Tuple


def build_daily_report_prompt(data: dict) -> Tuple[str, str]:
    """세션 데이터(data) → (system_prompt, user_prompt).

    data["is_blocked"]가 True이면 [AI 분석 결과] 섹션을 user_prompt에서 제외한다.
    """
    system_prompt = """당신은 재활의학과 전문의를 보조하는 AI 임상 분석 시스템입니다.
환자의 손 재활 운동 세션 데이터를 분석하여 주치의가 빠르게 임상 판단을 내릴 수 있도록
간결하고 전문적인 소견을 작성합니다.
다음 규칙을 반드시 따르십시오:
- 임상적 전문 용어 사용
- 각 항목은 bullet point로 작성
- 전체 4개 항목 이내
- 운동이 차단된 경우 차단 사실과 사유를 첫 번째 항목에 반드시 명시
- 불필요한 인사말, 맺음말 없이 소견만 작성"""

    is_blocked = data.get("is_blocked", False)

    patient_section = f"""[환자 정보]
- 이름: {data['patient_name']}
- 성별: {data['gender']}
- 생년월일: {data['birth_date']}
- 수술명: {data['surgery_name']}
- 수술일: {data['surgery_date']}
- 재활 시작일: {data['rehab_start_date']}
- 현재 재활 단계: {data['rehab_stage']}"""

    session_lines = [
        "[세션 정보]",
        f"- 세션 일자: {data['session_date']}",
        f"- 세션 상태: {data['session_status']} (정상종료 / 과부하종료 / 문진차단)",
        f"- 운동 차단 여부: {is_blocked}",
    ]
    if is_blocked:
        session_lines.append(f"- 운동 차단 사유: {data.get('block_reason', '')}")
    session_lines.append(f"- 운동 시간: {data['exercise_duration']}분 (차단 시 0)")
    session_lines.append(f"- 수행 운동: {data['exercise_list']} (차단 시 없음)")
    session_section = "\n".join(session_lines)

    questionnaire_section = f"""[사전 문진 결과]
- {data['questionnaire_result']}"""

    overload_section = f"""[과부하 발생 여부]
- {data['overload_occurred']} (발생 시 해당 운동명 및 시점 포함)"""

    instruction = """위 데이터를 바탕으로 주치의를 위한 임상 소견을 작성하십시오.
운동이 차단된 경우 차단 사실과 사유를 첫 번째 항목에 명시하고,
기준치 대비 낮은 손가락 일치율, ROM 이상, 통증 패턴,
세션 전환 권고 여부, 향후 관리 방향을 포함하십시오."""

    sections = [patient_section, session_section]
    if not is_blocked:
        sections.append(f"""[AI 분석 결과]
- 전체 일치율(Overall Compliance): {data['overall_compliance']}%
- 정확도 평균(Accuracy Average): {data['accuracy_average']}%
- 손가락별 일치율:
  · 엄지(Thumb): {data['thumb_score']}%
  · 검지(Index): {data['index_score']}%
  · 중지(Middle): {data['middle_score']}%
  · 약지(Ring): {data['ring_score']}%
  · 소지(Pinky): {data['pinky_score']}%
- 손가락별 ROM:
  · 엄지 MCP: {data['thumb_mcp']}° / IP: {data['thumb_ip']}°
  · 검지 MCP: {data['index_mcp']}° / PIP: {data['index_pip']}° / DIP: {data['index_dip']}°
  · 중지 MCP: {data['middle_mcp']}° / PIP: {data['middle_pip']}° / DIP: {data['middle_dip']}°
  · 약지 MCP: {data['ring_mcp']}° / PIP: {data['ring_pip']}° / DIP: {data['ring_dip']}°
  · 소지 MCP: {data['pinky_mcp']}° / PIP: {data['pinky_pip']}° / DIP: {data['pinky_dip']}°""")
    sections.append(questionnaire_section)
    sections.append(overload_section)
    sections.append(instruction)

    user_prompt = "\n\n".join(sections)
    return system_prompt, user_prompt


def build_monthly_report_prompt(data: dict) -> Tuple[str, str]:
    """누적 재활 데이터(data) → (system_prompt, user_prompt).

    data["weekly_data"], data["exercise_data"], data["rom_data"]는 각각
    주차별 / 운동별 / 관절별 항목을 담은 dict의 리스트.
    """
    system_prompt = """당신은 재활의학과 전문의를 보조하는 AI 임상 분석 시스템입니다.
환자의 누적 재활 데이터를 분석하여 전반적인 재활 경과를 평가하고
주치의의 임상 판단을 지원하는 종합 소견을 작성합니다.
다음 규칙을 반드시 따르십시오:
- 임상적 전문 용어 사용
- 종합 평가 텍스트: 3~5문장 이내
- 핵심 키워드: 최대 3개, 명사형으로 작성
- 운동 차단 발생 일수가 있으면 반드시 언급
- 불필요한 인사말, 맺음말 없이 소견만 작성
- 반드시 JSON 형식으로 반환"""

    patient_section = f"""[환자 정보]
- 이름: {data['patient_name']}
- 수술명: {data['surgery_name']}
- 재활 기간: {data['rehab_duration']}주
- 수행 운동 종류: {data['exercise_count']}종"""

    weekly_lines = ["[주차별 누적 데이터]"]
    for w in data["weekly_data"]:
        weekly_lines.append(
            f"- {w['week']}주차: 달성률 {w['achievement']}%, 일치율 {w['compliance']}%, "
            f"운동 차단 {w['block_count']}일, 과부하 발생 {w['overload_count']}회"
        )
    weekly_section = "\n".join(weekly_lines)

    exercise_lines = ["[운동별 달성률 및 일치율]"]
    for e in data["exercise_data"]:
        exercise_lines.append(
            f"- {e['name']}: 달성률 {e['achievement']}%, 일치율 {e['compliance']}%"
        )
    exercise_section = "\n".join(exercise_lines)

    rom_lines = ["[관절 가동범위(ROM) 누적 데이터]"]
    for r in data["rom_data"]:
        rom_lines.append(
            f"- {r['finger']} {r['joint']}: 기준값 {r['target']}°, 최솟값 {r['min']}°, "
            f"최댓값 {r['max']}°, 달성률 {r['achievement']}%"
        )
    rom_section = "\n".join(rom_lines)

    instruction = """위 데이터를 바탕으로 아래 JSON 형식으로 반환하십시오:
{
  "summary": "종합 평가 텍스트 (3~5문장)",
  "keywords": ["키워드1", "키워드2", "키워드3"]
}"""

    user_prompt = "\n\n".join(
        [patient_section, weekly_section, exercise_section, rom_section, instruction]
    )
    return system_prompt, user_prompt


def build_prescription_prompt(data: dict) -> Tuple[str, str]:
    """현재 세션 + 누적 데이터(data) → (system_prompt, user_prompt)."""
    system_prompt = """당신은 재활의학과 전문의를 보조하는 AI 처방 보조 시스템입니다.
환자의 현재 세션 및 누적 재활 데이터를 분석하여
다음 재활 치료 처방을 생성합니다.
다음 규칙을 반드시 따르십시오:
- 처방 조정 범위: 현재 처방 대비 세트 수 ±1, 횟수 ±5 이내
- 과부하가 발생한 운동은 세트 수 또는 횟수를 반드시 줄일 것
- 일치율 80% 미만 손가락이 있으면 해당 운동 강도를 유지하거나 낮출 것
- 반드시 JSON 형식으로 반환"""

    user_prompt = f"""[현재 세션 데이터]
- 전체 일치율: {data['overall_compliance']}%
- 세션 상태: {data['session_status']}
- 과부하 발생 여부: {data['overload_occurred']}
- 손가락별 일치율: {data['finger_scores']}
- 손가락별 ROM: {data['finger_rom']}

[누적 데이터]
- 주차별 달성률 추이: {data['weekly_achievement']}
- 주차별 일치율 추이: {data['weekly_compliance']}
- 누적 과부하 발생 횟수: {data['total_overload_count']}

[현재 처방]
- 운동 목록: {data['current_exercises']}
- 세트 수: {data['current_sets']}
- 세트당 횟수: {data['current_reps']}
- 목표 ROM: {data['target_rom']}
- 목표 횟수: {data['target_count']}

위 데이터를 바탕으로 다음 처방을 아래 JSON 형식으로 반환하십시오:
{{
  "exercises": [
    {{
      "name": "운동명",
      "sets": 세트수,
      "reps": 횟수
    }}
  ],
  "reason": "처방 조정 근거 (1~2문장)"
}}"""

    return system_prompt, user_prompt
