import time

# 추후 조정 가능하도록 상수로 분리
YELLOW_DURATION_THRESHOLD = 3.0   # 초 — yellow 신호가 이 시간 이상 지속되면 피드백 후보
YELLOW_COOLDOWN           = 5.0   # 초 — 동일 손가락/yellow 피드백 재발생 최소 간격
RED_DURATION_THRESHOLD    = 1.5
RED_COOLDOWN              = 3.0

# hand_tracking.FINGER_LANDMARK_GROUPS와 동일한 그룹 → 그룹당 대표(tip) 인덱스 1개만 사용
FINGER_TIP_NAMES = {4: "thumb", 8: "index", 12: "middle", 16: "ring", 20: "pinky"}
FINGER_LABELS_KO = {"thumb": "엄지", "index": "검지", "middle": "중지", "ring": "약지", "pinky": "소지"}

MESSAGE_TEMPLATES = {
    "yellow": "{finger} 동작을 조금 더 정확하게 해보세요",
    "red":    "{finger}에 무리가 가고 있어요, 속도를 늦춰주세요",
}


def reduce_to_finger_signals(joint_signals: dict) -> dict:
    """hand_tracking.joint_signals(21개 랜드마크 인덱스 키) → 5개 손가락 이름 키 dict.

    한 손가락 그룹(예: 엄지 1~4번)의 4개 인덱스는 항상 같은 값이므로 tip 인덱스
    (4/8/12/16/20) 1개만 대표로 읽는다. joint_signals가 None이거나 키가 없으면
    해당 손가락은 기본값 "green". 정수 키(런타임)와 문자열 키(JSON 직렬화 후) 모두 지원.
    """
    result = {}
    for tip_idx, name in FINGER_TIP_NAMES.items():
        if not joint_signals:
            result[name] = "green"
            continue
        result[name] = joint_signals.get(tip_idx, joint_signals.get(str(tip_idx), "green"))
    return result


class FeedbackTracker:
    """손가락별 yellow/red 신호 지속시간을 추적해 실시간 피드백 메시지를 생성한다.

    update()를 매 프레임(또는 매 신호 업데이트 시점) 호출하면, 그 호출에서 새로
    발생한 피드백 메시지 리스트를 반환한다 (없으면 빈 리스트). 세션(환자)별로
    인스턴스를 하나씩 만들어 사용한다.
    """

    def __init__(self):
        self._level_started_at = {}   # finger_name -> 현재 레벨(yellow/red) 진입 시각
        self._current_level    = {}   # finger_name -> 마지막으로 본 레벨
        self._last_feedback_at = {}   # (finger_name, level) -> 마지막 피드백 발생 시각

    def update(self, joint_signals: dict, now: float = None) -> list:
        now = now if now is not None else time.time()
        finger_signals = reduce_to_finger_signals(joint_signals)
        messages = []

        for finger, level in finger_signals.items():
            prev_level = self._current_level.get(finger, "green")

            if level == "green":
                self._level_started_at.pop(finger, None)
                self._current_level[finger] = "green"
                continue

            if level not in ("yellow", "red"):
                continue   # 알 수 없는 레벨은 무시 (방어적 처리)

            if prev_level != level:
                self._level_started_at[finger] = now   # 새 레벨 진입 → 지속 시간 새로 시작
            self._current_level[finger] = level

            duration = now - self._level_started_at.get(finger, now)
            duration_threshold = (
                YELLOW_DURATION_THRESHOLD if level == "yellow" else RED_DURATION_THRESHOLD
            )
            if duration < duration_threshold:
                continue

            cooldown = YELLOW_COOLDOWN if level == "yellow" else RED_COOLDOWN
            last_fb = self._last_feedback_at.get((finger, level))
            if last_fb is not None and (now - last_fb) < cooldown:
                continue

            self._last_feedback_at[(finger, level)] = now
            messages.append({
                "finger":  finger,
                "level":   level,
                "message": MESSAGE_TEMPLATES[level].format(finger=FINGER_LABELS_KO[finger]),
            })

        return messages
