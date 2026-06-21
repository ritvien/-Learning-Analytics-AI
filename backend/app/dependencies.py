"""FastAPI shared dependencies (auth, pagination, db session re-export)."""

from collections.abc import Awaitable, Callable
from datetime import UTC, datetime, timedelta
from time import monotonic
from typing import Annotated

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.people import User, UserRole

settings = get_settings()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

# Convenience type aliases for endpoint signatures.
DBSession = Annotated[AsyncSession, Depends(get_db)]
TokenStr = Annotated[str, Depends(oauth2_scheme)]

WRITE_ROLES = {UserRole.superadmin, UserRole.admin, UserRole.manager}
ADMIN_ROLES = {UserRole.superadmin, UserRole.admin}
USER_CACHE_TTL_SECONDS = 30
_CURRENT_USER_CACHE: dict[str, tuple[float, dict[str, object]]] = {}


def _user_from_cache_data(data: dict[str, object]) -> User:
    user = User()
    user.id = str(data["id"])
    user.email = str(data["email"])
    user.full_name = str(data["full_name"])
    user.role = UserRole(str(data["role"]))
    user.department_id = data["department_id"] if isinstance(data["department_id"], int) else None
    user.is_active = bool(data["is_active"])
    user.created_at = data["created_at"] if isinstance(data["created_at"], datetime) else datetime.now(UTC)
    return user


def _cache_current_user(token: str, user: User) -> None:
    _CURRENT_USER_CACHE[token] = (
        monotonic(),
        {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value,
            "department_id": user.department_id,
            "is_active": user.is_active,
            "created_at": user.created_at,
        },
    )


def _get_cached_current_user(token: str) -> User | None:
    cached = _CURRENT_USER_CACHE.get(token)
    if cached is None:
        return None
    created_at, data = cached
    if monotonic() - created_at > USER_CACHE_TTL_SECONDS:
        _CURRENT_USER_CACHE.pop(token, None)
        return None
    return _user_from_cache_data(data)


def hash_password(password: str) -> str:
    """Return a bcrypt hash for a plaintext password."""
    password_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(password_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed_password: str) -> bool:
    """Verify a plaintext password against a stored bcrypt hash."""
    password_bytes = password.encode("utf-8")[:72]
    return bcrypt.checkpw(password_bytes, hashed_password.encode("utf-8"))


def create_access_token(subject: str, role: UserRole, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token."""
    expire = datetime.now(UTC) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload = {"sub": subject, "role": role.value, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


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


async def get_current_user(db: DBSession, token: TokenStr) -> User:
    """Return the active user represented by the bearer token."""
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not isinstance(user_id, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    cached_user = _get_cached_current_user(token)
    if cached_user is not None and cached_user.id == user_id and cached_user.is_active:
        return cached_user
    result = await db.execute(select(User).where(User.id == user_id, User.is_active == True))  # noqa: E712
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    _cache_current_user(token, user)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]


def require_roles(*roles: UserRole) -> Callable[[CurrentUser], Awaitable[User]]:
    """Build a dependency that allows only the given roles."""

    async def _require_roles(current_user: CurrentUser) -> User:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return _require_roles


async def require_write_access(current_user: CurrentUser) -> User:
    """Allow only roles that can mutate CRUD resources."""
    if current_user.role not in WRITE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return current_user


async def require_admin_access(current_user: CurrentUser) -> User:
    """Allow only roles that can manage accounts and permissions."""
    if current_user.role not in ADMIN_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return current_user


class Pagination:
    """Query-string pagination helper: ?skip=0&limit=50."""

    def __init__(self, skip: int = 0, limit: int = 50) -> None:
        """Set skip/limit with safety clamping."""
        self.skip = max(0, skip)
        self.limit = min(50000, max(1, limit))


PaginationDep = Annotated[Pagination, Depends(Pagination)]
