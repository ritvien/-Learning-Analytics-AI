"""CRUD endpoints for Section (Lớp học phần)."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, text

from app.access_control import can_access_section, get_teacher_for_user, is_admin, require_department_scope
from app.crud import teaching as crud
from app.dependencies import CurrentUser, DBSession, PaginationDep, require_write_access
from app.models.academic import Course
from app.models.people import UserRole
from app.models.teaching import Section
from app.schemas.teaching import SectionCreate, SectionResponse, SectionUpdate

router = APIRouter()


@router.get("", response_model=list[SectionResponse])
async def list_sections(
    db: DBSession,
    pagination: PaginationDep,
    current_user: CurrentUser,
    course_id: int | None = None,
    semester_id: int | None = None,
    teacher_id: int | None = None,
) -> list[Section]:
    """Return sections with optional filters."""
    if not is_admin(current_user):
        q = select(Section).where(Section.is_active == True)  # noqa: E712
        if course_id is not None:
            q = q.where(Section.course_id == course_id)
        if semester_id is not None:
            q = q.where(Section.semester_id == semester_id)
        if current_user.role == UserRole.lecturer:
            teacher = await get_teacher_for_user(db, current_user)
            if teacher is None:
                return []
            q = q.where(Section.teacher_id == teacher.id)
            if teacher_id is not None and teacher_id != teacher.id:
                return []
        else:
            department_ids = await require_department_scope(db, current_user)
            q = q.join(Course, Course.id == Section.course_id).where(Course.department_id.in_(department_ids))
            if teacher_id is not None:
                q = q.where(Section.teacher_id == teacher_id)
        q = q.offset(pagination.skip).limit(pagination.limit)
        return list((await db.execute(q)).scalars().all())
    return await crud.list_sections(db, pagination.skip, pagination.limit, course_id, semester_id, teacher_id)


@router.get("/{section_id}", response_model=SectionResponse)
async def get_section(section_id: int, db: DBSession, current_user: CurrentUser) -> Section:
    """Retrieve a section by ID."""
    obj = await crud.get_section(db, section_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    if not await can_access_section(db, current_user, section_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return obj


@router.post(
    "",
    response_model=SectionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_section(
    payload: SectionCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> Section:
    """Create a new section."""
    if not is_admin(current_user):
        department_ids = await require_department_scope(db, current_user)
        # Kiểm tra môn học có thuộc khoa quản lý hay không
        course_result = await db.execute(select(Course).where(Course.id == payload.course_id))
        course = course_result.scalar_one_or_none()
        if course is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Course not found")
        if course.department_id not in department_ids:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create section for a course outside your department",
            )
        
        # Kiểm tra giảng viên có thuộc khoa quản lý hay không
        if payload.teacher_id is not None:
            from app.models.people import Teacher
            teacher_result = await db.execute(select(Teacher).where(Teacher.id == payload.teacher_id))
            teacher = teacher_result.scalar_one_or_none()
            if teacher is None:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Teacher not found")
            if teacher.department_id not in department_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign teacher from another department",
                )
    created = await crud.create_section(db, payload.model_dump())
    await _sync_section_to_dwh_if_available(db, created.id)
    _invalidate_section_analytics_cache()
    return created


@router.patch("/{section_id}", response_model=SectionResponse, dependencies=[Depends(require_write_access)])
async def update_section(
    section_id: int,
    payload: SectionUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> Section:
    """Apply a partial update to a section."""
    obj = await crud.get_section(db, section_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    
    if not await can_access_section(db, current_user, section_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access this section",
        )
        
    if payload.teacher_id is not None:
        from app.models.people import Teacher
        result = await db.execute(select(Teacher).where(Teacher.id == payload.teacher_id))
        teacher = result.scalar_one_or_none()
        if teacher is None:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Teacher not found")
        if not is_admin(current_user):
            department_ids = await require_department_scope(db, current_user)
            if teacher.department_id not in department_ids:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot assign teacher from another department",
                )
                
    updated = await crud.update_section(db, obj, payload.model_dump(exclude_unset=True))
    await _sync_section_to_dwh_if_available(db, updated.id)
    _invalidate_section_analytics_cache()
    return updated


@router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_section(
    section_id: int,
    db: DBSession,
    current_user: CurrentUser,
) -> None:
    """Soft-delete a section."""
    obj = await crud.get_section(db, section_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    if not await can_access_section(db, current_user, section_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to access this section",
        )
    await crud.delete_section(db, obj)
    _invalidate_section_analytics_cache()


async def _sync_section_to_dwh_if_available(db: DBSession, section_id: int) -> None:
    """Keep DWH section ownership current after CRUD writes without a full ETL run."""
    bind = db.get_bind()
    if bind.dialect.name != "postgresql":
        return
    has_dim_section = await db.scalar(text("SELECT to_regclass('dwh.dim_section') IS NOT NULL"))
    if not has_dim_section:
        return
    await db.execute(
        text(
            """
            INSERT INTO dwh.dim_section (section_id, section_code, course_id, semester_id, teacher_id, updated_at)
            SELECT id, section_code, course_id, semester_id, teacher_id, NOW()
            FROM public.sections
            WHERE id = :section_id
            ON CONFLICT (section_id) DO UPDATE SET
                section_code = EXCLUDED.section_code,
                course_id = EXCLUDED.course_id,
                semester_id = EXCLUDED.semester_id,
                teacher_id = EXCLUDED.teacher_id,
                updated_at = NOW()
            """
        ),
        {"section_id": section_id},
    )


def _invalidate_section_analytics_cache() -> None:
    from app.api.v1.endpoints.analytics import _dashboard_cache_clear
    from app.api.v1.endpoints.tree import invalidate_tree_cache

    _dashboard_cache_clear()
    invalidate_tree_cache()
