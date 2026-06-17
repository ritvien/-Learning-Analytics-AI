<<<<<<< HEAD
"""Auth endpoint — login and JWT token generation.

POST /api/v1/auth/login
  Request:  OAuth2 form (username, password)
  Response: {"access_token": str, "token_type": "bearer"}
"""

import logging
import uuid
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.people import User
from app.schemas.people import TokenResponse

logger = logging.getLogger(__name__)
router = APIRouter()

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
=======
"""Authentication endpoints for JWT login and current-user lookup."""

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import select

from app.dependencies import (
    CurrentUser,
    DBSession,
    create_access_token,
    hash_password,
    require_admin_access,
    verify_password,
)
from app.models.people import User
from app.schemas.people import TokenResponse, UserCreate, UserResponse, UserUpdate

router = APIRouter()
OAuthForm = Annotated[OAuth2PasswordRequestForm, Depends()]
>>>>>>> b67b8dc79fdc6813865cd6e279082935abf6ce01


@router.post("/login", response_model=TokenResponse)
async def login(
<<<<<<< HEAD
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    """Authenticate user with email + password and return a JWT token.

    Accepts standard OAuth2 form data (username field = email).
    """
    # Look up user by email
    result = await db.execute(
        select(User).where(User.email == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email hoặc mật khẩu không chính xác",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản đã bị vô hiệu hóa",
        )

    # Create JWT with user info
    access_token = create_access_token(
        data={
            "sub": user.id,
            "email": user.email,
            "role": user.role,
            "full_name": user.full_name,
        }
    )

    logger.info("User %s (%s) logged in successfully", user.email, user.role)

    return TokenResponse(access_token=access_token, token_type="bearer")
=======
    db: DBSession,
    form_data: OAuthForm,
) -> TokenResponse:
    """Authenticate a user with email/password and return a bearer token."""
    result = await db.execute(select(User).where(User.email == form_data.username, User.is_active == True))  # noqa: E712
    user = result.scalar_one_or_none()
    if user is None or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return TokenResponse(access_token=create_access_token(user.id, user.role))


@router.get("/me", response_model=UserResponse)
async def read_current_user(current_user: CurrentUser) -> User:
    """Return the authenticated user's safe profile."""
    return current_user


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_admin_access)],
)
async def create_user(payload: UserCreate, db: DBSession) -> User:
    """Create an application user. Restricted to write-capable roles."""
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(
        id=str(uuid4()),
        email=str(payload.email),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        department_id=payload.department_id,
    )
    db.add(user)
    await db.flush()
    await db.refresh(user)
    return user


@router.get("/users", response_model=list[UserResponse], dependencies=[Depends(require_admin_access)])
async def list_users(db: DBSession, skip: int = 0, limit: int = 100) -> list[User]:
    """Return application users for account administration."""
    result = await db.execute(select(User).order_by(User.created_at.desc()).offset(skip).limit(min(limit, 500)))
    return list(result.scalars().all())


@router.patch("/users/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin_access)])
async def update_user(user_id: str, payload: UserUpdate, db: DBSession, current_user: CurrentUser) -> User:
    """Update user profile, role, or active status."""
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    data = payload.model_dump(exclude_unset=True)
    if user.id == current_user.id and data.get("is_active") is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own account")
    for field, value in data.items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return user
>>>>>>> b67b8dc79fdc6813865cd6e279082935abf6ce01
