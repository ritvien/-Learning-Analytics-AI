"""FastAPI shared dependencies (auth, pagination, db session re-export)."""

from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db

settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Convenience type aliases for endpoint signatures.
DBSession = Annotated[AsyncSession, Depends(get_db)]
TokenStr = Annotated[str, Depends(oauth2_scheme)]


def decode_token(token: str) -> dict:
    """Decode and verify a JWT access token.

    Raises HTTPException 401 when the token is invalid or expired.
    """
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc
    return payload


class Pagination:
    """Query-string pagination helper: ?skip=0&limit=50."""

    def __init__(self, skip: int = 0, limit: int = 50) -> None:
        """Set skip/limit with safety clamping."""
        self.skip = max(0, skip)
        self.limit = min(200, max(1, limit))


PaginationDep = Annotated[Pagination, Depends(Pagination)]
