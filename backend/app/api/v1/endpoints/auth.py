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
from app.models.academic import Department
from app.models.people import Teacher, User, UserRole
from app.schemas.people import TokenResponse, UserCreate, UserResponse, UserUpdate

router = APIRouter()
OAuthForm = Annotated[OAuth2PasswordRequestForm, Depends()]
MANAGER_POSITIONS = {"dean", "vice_dean", "department_manager"}


async def _ensure_valid_user_scope(
    role: UserRole,
    department_id: int | None,
    position: str | None,
    db: DBSession,
) -> None:
    if role == UserRole.manager and department_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Manager accounts must be assigned to a department",
        )
    if role == UserRole.manager and position not in MANAGER_POSITIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Manager accounts must have a department position",
        )
    if department_id is None:
        return
    department = await db.get(Department, department_id)
    if department is None or not department.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Department not found")


@router.post("/login", response_model=TokenResponse)
async def login(
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
async def create_user(payload: UserCreate, db: DBSession, current_user: CurrentUser) -> User:
    """Create an application user. Restricted to write-capable roles."""
    if payload.role == UserRole.superadmin and current_user.role != UserRole.superadmin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can create superadmin accounts",
        )
    if payload.role == UserRole.lecturer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Create lecturer accounts from the teacher profile",
        )
    position = payload.position if payload.role == UserRole.manager else None
    await _ensure_valid_user_scope(payload.role, payload.department_id, position, db)
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already exists")
    user = User(
        id=str(uuid4()),
        email=str(payload.email),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=payload.role,
        position=position,
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
    if current_user.role != UserRole.superadmin and (
        user.role == UserRole.superadmin or data.get("role") == UserRole.superadmin
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can manage superadmin accounts",
        )
    if user.id == current_user.id and data.get("is_active") is False:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot deactivate your own account")
    linked_teacher = (await db.execute(select(Teacher).where(Teacher.user_id == user.id))).scalar_one_or_none()
    if (
        linked_teacher is not None
        and data.get("role") is not None
        and data["role"] not in {UserRole.lecturer, UserRole.manager}
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Teacher-linked accounts must keep lecturer or manager role",
        )
    if linked_teacher is None and data.get("role") == UserRole.lecturer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Assign lecturer role from the teacher profile",
        )
    next_role = data.get("role", user.role)
    next_department_id = data.get("department_id", user.department_id)
    next_position = data.get("position", user.position)
    if linked_teacher is not None and next_role == UserRole.manager and next_department_id != linked_teacher.department_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Manager teaching account must stay in the teacher department",
        )
    if next_role in {UserRole.superadmin, UserRole.admin}:
        next_department_id = None
        next_position = None
        data["department_id"] = None
        data["position"] = None
    if next_role != UserRole.manager:
        next_position = None
        data["position"] = None
    await _ensure_valid_user_scope(next_role, next_department_id, next_position, db)
    for field, value in data.items():
        setattr(user, field, value)
    await db.flush()
    await db.refresh(user)
    return user
