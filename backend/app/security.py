import os
from datetime import datetime, timedelta

import bcrypt
from fastapi import HTTPException, status
from jose import JWTError, jwt


SECRET_KEY = os.environ["SECRET_KEY"]
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def create_token(sub: str, role: str) -> str:
    # 사용자 ID(sub)와 역할(role)을 담아 24시간 유효한 JWT를 발급
    payload = {
        "sub": sub,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=TOKEN_EXPIRE_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def decode_token(token: str) -> dict:
    # 토큰 검증 실패 시 JWTError를 잡아 401 HTTP 예외로 변환
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
