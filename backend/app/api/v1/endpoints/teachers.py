"""CRUD endpoints for Teacher (Giảng viên)."""

from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.access_control import is_admin, require_department_scope
from app.crud import people as crud
from app.dependencies import CurrentUser, DBSession, PaginationDep, hash_password, require_write_access
from app.models.people import Teacher, User, UserRole
from app.schemas.people import TeacherAccountProvision, TeacherAccountResponse, TeacherCreate, TeacherResponse, TeacherUpdate

router = APIRouter()


async def _ensure_teacher_department_scope(db: DBSession, current_user: CurrentUser, department_id: int) -> None:
    if is_admin(current_user):
        return
    department_ids = await require_department_scope(db, current_user)
    if department_id not in department_ids:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher scope is outside your permissions")


async def _provision_teacher_account(
    db: DBSession,
    teacher: Teacher,
    email: str | None,
    password: str,
) -> User:
    account_email = (email or teacher.email or "").strip().lower()
    if not account_email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Teacher email is required to create login account")

    linked_user = await db.get(User, teacher.user_id) if teacher.user_id else None
    existing_result = await db.execute(select(User).where(User.email == account_email))
    existing_user = existing_result.scalar_one_or_none()

    if existing_user is not None and linked_user is not None and existing_user.id != linked_user.id:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already belongs to another user")
    if existing_user is not None and linked_user is None:
        if existing_user.role != UserRole.lecturer:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already belongs to another non-lecturer user")
        linked_user = existing_user

    if linked_user is None:
        linked_user = User(
            id=str(uuid4()),
            email=account_email,
            hashed_password=hash_password(password),
            full_name=teacher.full_name,
            role=UserRole.lecturer,
            department_id=teacher.department_id,
            is_active=True,
        )
        db.add(linked_user)
        await db.flush()
    else:
        linked_user.email = account_email
        linked_user.hashed_password = hash_password(password)
        linked_user.full_name = teacher.full_name
        linked_user.role = UserRole.lecturer
        linked_user.department_id = teacher.department_id
        linked_user.is_active = True

    teacher.user_id = linked_user.id
    teacher.email = account_email
    await db.flush()
    await db.refresh(teacher)
    await db.refresh(linked_user)
    return linked_user


@router.get("", response_model=list[TeacherResponse])
async def list_teachers(
    db: DBSession,
    pagination: PaginationDep,
    current_user: CurrentUser,
    department_id: int | None = None,
) -> list[Teacher]:
    """Return teachers, optionally filtered by department."""
    if not is_admin(current_user):
        department_ids = await require_department_scope(db, current_user)
        if department_id is not None:
            department_ids = department_ids.intersection({department_id})
        if not department_ids:
            return []
        result = await db.execute(
            select(Teacher)
            .where(Teacher.is_active == True, Teacher.department_id.in_(department_ids))  # noqa: E712
            .offset(pagination.skip)
            .limit(pagination.limit)
        )
        return list(result.scalars().all())
    return await crud.list_teachers(db, pagination.skip, pagination.limit, department_id)


@router.get("/{teacher_id}", response_model=TeacherResponse)
async def get_teacher(teacher_id: int, db: DBSession, current_user: CurrentUser) -> Teacher:
    """Retrieve a teacher by ID."""
    obj = await crud.get_teacher(db, teacher_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    if not is_admin(current_user):
        department_ids = await require_department_scope(db, current_user)
        if obj.department_id not in department_ids:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    return obj


@router.post(
    "",
    response_model=TeacherResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_teacher(payload: TeacherCreate, db: DBSession, current_user: CurrentUser) -> Teacher:
    """Create a new teacher."""
    await _ensure_teacher_department_scope(db, current_user, payload.department_id)
    teacher = await crud.create_teacher(db, payload.model_dump(exclude={"create_account", "login_password"}))
    if payload.create_account:
        if not payload.login_password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password is required to create login account")
        await _provision_teacher_account(db, teacher, teacher.email, payload.login_password)
    return teacher


@router.post(
    "/{teacher_id}/account",
    response_model=TeacherAccountResponse,
    dependencies=[Depends(require_write_access)],
)
async def provision_teacher_account(
    teacher_id: int,
    payload: TeacherAccountProvision,
    db: DBSession,
    current_user: CurrentUser,
) -> TeacherAccountResponse:
    """Create or reset the lecturer login account linked to a teacher."""
    teacher = await crud.get_teacher(db, teacher_id)
    if teacher is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    await _ensure_teacher_department_scope(db, current_user, teacher.department_id)
    user = await _provision_teacher_account(db, teacher, str(payload.email) if payload.email else None, payload.password)
    return TeacherAccountResponse(teacher_id=teacher.id, user_id=user.id, email=user.email)


@router.patch("/{teacher_id}", response_model=TeacherResponse, dependencies=[Depends(require_write_access)])
async def update_teacher(teacher_id: int, payload: TeacherUpdate, db: DBSession, current_user: CurrentUser) -> Teacher:
    """Apply a partial update to a teacher."""
    obj = await crud.get_teacher(db, teacher_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    await _ensure_teacher_department_scope(db, current_user, obj.department_id)
    updates = payload.model_dump(exclude_unset=True)
    if "department_id" in updates and updates["department_id"] is not None:
        await _ensure_teacher_department_scope(db, current_user, updates["department_id"])
    return await crud.update_teacher(db, obj, updates)


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_teacher(teacher_id: int, db: DBSession, current_user: CurrentUser) -> None:
    """Soft-delete a teacher."""
    obj = await crud.get_teacher(db, teacher_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    await _ensure_teacher_department_scope(db, current_user, obj.department_id)
    await crud.delete_teacher(db, obj)
