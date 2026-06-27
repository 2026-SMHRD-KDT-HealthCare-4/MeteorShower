from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from security import decode_token


bearer_scheme = HTTPBearer()


def get_token_payload(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    # JWT 디코딩 후 sub(사용자 ID)와 role(역할)이 모두 있어야 유효한 토큰으로 처리
    payload = decode_token(credentials.credentials)
    if not payload.get("sub") or not payload.get("role"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return payload
