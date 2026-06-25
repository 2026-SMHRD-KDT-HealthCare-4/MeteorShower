_BAD_WORDS = [
    # 심한 욕설
    "씨발", "씨팔", "시발", "시팔", "ㅅㅂ"
]

_NORMALIZED = [w.replace(" ", "").lower() for w in _BAD_WORDS]


def contains_profanity(text: str) -> bool:
    normalized = text.replace(" ", "").lower()
    return any(bad in normalized for bad in _NORMALIZED)
