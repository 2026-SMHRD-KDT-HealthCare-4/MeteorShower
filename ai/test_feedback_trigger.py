"""feedback_trigger.py 검증 스크립트 (실제 세션/시간 흐름 없이 mock 시각으로 검증)."""
from feedback_trigger import FeedbackTracker, reduce_to_finger_signals

FINGER_TIP_IDX = {"thumb": 4, "index": 8, "middle": 12, "ring": 16, "pinky": 20}


def _joint_signals(finger_levels: dict) -> dict:
    """{"index": "yellow"} 같은 축약 표현 → 21개 랜드마크 키 dict로 확장 (테스트용 헬퍼)."""
    groups = {
        "thumb":  [1, 2, 3, 4],
        "index":  [5, 6, 7, 8],
        "middle": [9, 10, 11, 12],
        "ring":   [13, 14, 15, 16],
        "pinky":  [17, 18, 19, 20],
    }
    signals = {0: "green"}
    for finger, indices in groups.items():
        level = finger_levels.get(finger, "green")
        for idx in indices:
            signals[idx] = level
    return signals


def test_reduce_to_finger_signals_basic():
    js = _joint_signals({"index": "yellow", "ring": "red"})
    reduced = reduce_to_finger_signals(js)
    assert reduced == {"thumb": "green", "index": "yellow", "middle": "green", "ring": "red", "pinky": "green"}
    print("[PASS] reduce_to_finger_signals (기본 케이스)")


def test_reduce_to_finger_signals_string_keys():
    js = {str(k): v for k, v in _joint_signals({"middle": "red"}).items()}
    reduced = reduce_to_finger_signals(js)
    assert reduced["middle"] == "red"
    assert reduced["thumb"] == "green"
    print("[PASS] reduce_to_finger_signals (문자열 키 / JSON 직렬화 케이스)")


def test_reduce_to_finger_signals_none():
    reduced = reduce_to_finger_signals(None)
    assert all(v == "green" for v in reduced.values())
    print("[PASS] reduce_to_finger_signals (None 입력 케이스)")


def test_yellow_fires_after_duration_threshold():
    tracker = FeedbackTracker()
    js = _joint_signals({"index": "yellow"})

    msgs = tracker.update(js, now=0.0)
    assert msgs == []
    msgs = tracker.update(js, now=2.9)
    assert msgs == [], "3초 미만이면 아직 발생하면 안 됨"
    msgs = tracker.update(js, now=3.0)
    assert len(msgs) == 1
    assert msgs[0]["finger"] == "index" and msgs[0]["level"] == "yellow"
    assert msgs[0]["message"] == "검지 동작을 조금 더 정확하게 해보세요"
    print("[PASS] yellow 3초 지속 → 1회 발생")


def test_yellow_cooldown_blocks_repeat():
    tracker = FeedbackTracker()
    js = _joint_signals({"index": "yellow"})

    tracker.update(js, now=0.0)
    msgs = tracker.update(js, now=3.0)
    assert len(msgs) == 1

    msgs = tracker.update(js, now=3.0 + 4.9)
    assert msgs == [], "cooldown(5초) 이내에는 재발생하면 안 됨"

    msgs = tracker.update(js, now=3.0 + 5.0)
    assert len(msgs) == 1, "cooldown 경과 후에는 다시 발생해야 함"
    print("[PASS] yellow cooldown(5초) 적용")


def test_red_fires_after_shorter_duration_with_shorter_cooldown():
    tracker = FeedbackTracker()
    js = _joint_signals({"ring": "red"})

    msgs = tracker.update(js, now=0.0)
    assert msgs == []
    msgs = tracker.update(js, now=1.4)
    assert msgs == []
    msgs = tracker.update(js, now=1.5)
    assert len(msgs) == 1
    assert msgs[0]["finger"] == "ring" and msgs[0]["level"] == "red"
    assert msgs[0]["message"] == "약지에 무리가 가고 있어요, 속도를 늦춰주세요"

    msgs = tracker.update(js, now=1.5 + 2.9)
    assert msgs == [], "cooldown(3초) 이내에는 재발생하면 안 됨"
    msgs = tracker.update(js, now=1.5 + 3.0)
    assert len(msgs) == 1
    print("[PASS] red 1.5초 지속 → 발생, cooldown(3초) 적용")


def test_green_resets_duration_timer():
    tracker = FeedbackTracker()
    yellow = _joint_signals({"index": "yellow"})
    green = _joint_signals({"index": "green"})

    tracker.update(yellow, now=0.0)
    msgs = tracker.update(yellow, now=2.5)
    assert msgs == []

    msgs = tracker.update(green, now=2.6)
    assert msgs == []

    # green을 거친 후 다시 yellow 시작 → 이 시점이 새로운 기준점이 되어야 함
    msgs = tracker.update(yellow, now=2.7)
    assert msgs == []

    # 누적되었다면(2.5+2.9=5.4 ≥ 3.0) 여기서 발생했겠지만, 리셋되었으므로 아직 발생 안 함
    msgs = tracker.update(yellow, now=2.7 + 2.9)
    assert msgs == [], "green을 거쳤으므로 누적되지 않고 다시 처음부터 세야 함"
    msgs = tracker.update(yellow, now=2.7 + 3.0)
    assert len(msgs) == 1
    print("[PASS] green 복귀 시 지속 시간 타이머 초기화")


def test_level_switch_restarts_duration_timer():
    tracker = FeedbackTracker()
    yellow = _joint_signals({"middle": "yellow"})
    red = _joint_signals({"middle": "red"})

    tracker.update(yellow, now=0.0)
    msgs = tracker.update(red, now=1.0)   # yellow 1초만에 red로 전환
    assert msgs == [], "red 전환 직후이므로 red의 1.5초 기준을 아직 못 채움"

    msgs = tracker.update(red, now=1.0 + 1.4)
    assert msgs == []
    msgs = tracker.update(red, now=1.0 + 1.5)
    assert len(msgs) == 1
    print("[PASS] yellow→red 전환 시 red 기준으로 타이머 재시작")


def test_reset_clears_duration_and_cooldown():
    tracker = FeedbackTracker()
    yellow = _joint_signals({"index": "yellow"})

    tracker.update(yellow, now=0.0)
    msgs = tracker.update(yellow, now=3.0)
    assert len(msgs) == 1, "리셋 전 정상적으로 1회 발생해야 함 (쿨다운은 8.0까지)"

    tracker.reset()

    # reset() 직후엔 지속시간이 0부터 다시 채워져야 함
    msgs = tracker.update(yellow, now=4.0)
    assert msgs == []
    msgs = tracker.update(yellow, now=6.9)
    assert msgs == [], "아직 3초 미달"

    # 7.0초 시점은 reset() 없었다면 쿨다운(3.0+5.0=8.0까지) 안에 걸려 막혔을 시점.
    # 여기서 발생한다는 것은 reset()이 쿨다운까지 지웠다는 뜻.
    msgs = tracker.update(yellow, now=7.0)
    assert len(msgs) == 1, "reset()으로 쿨다운까지 풀렸어야 함"
    print("[PASS] reset() 호출 시 지속시간·쿨다운 모두 초기화")


def test_multiple_fingers_independent():
    tracker = FeedbackTracker()
    js = _joint_signals({"index": "yellow", "pinky": "red"})

    msgs = tracker.update(js, now=0.0)
    assert msgs == []
    msgs = tracker.update(js, now=1.5)
    assert len(msgs) == 1 and msgs[0]["finger"] == "pinky"
    msgs = tracker.update(js, now=3.0)
    assert len(msgs) == 1 and msgs[0]["finger"] == "index"
    print("[PASS] 손가락별 독립 추적")


if __name__ == "__main__":
    test_reduce_to_finger_signals_basic()
    test_reduce_to_finger_signals_string_keys()
    test_reduce_to_finger_signals_none()
    test_yellow_fires_after_duration_threshold()
    test_yellow_cooldown_blocks_repeat()
    test_red_fires_after_shorter_duration_with_shorter_cooldown()
    test_green_resets_duration_timer()
    test_level_switch_restarts_duration_timer()
    test_reset_clears_duration_and_cooldown()
    test_multiple_fingers_independent()
    print("\nALL TESTS PASSED")
