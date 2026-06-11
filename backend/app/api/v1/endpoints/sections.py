"""CRUD endpoints for Section (Lớp học phần)."""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DBSession, PaginationDep
from app.models.teaching import Section
from app.schemas.teaching import SectionCreate, SectionResponse, SectionUpdate

router = APIRouter()


@router.get("", response_model=list[SectionResponse])
async def list_sections(
    db: DBSession,
    pagination: PaginationDep,
    course_id: int | None = None,
    semester_id: int | None = None,
    teacher_id: int | None = None,
) -> list[Section]:
    """Return sections with optional filters."""
    q = select(Section).where(Section.is_active == True)  # noqa: E712
    if course_id is not None:
        q = q.where(Section.course_id == course_id)
    if semester_id is not None:
        q = q.where(Section.semester_id == semester_id)
    if teacher_id is not None:
        q = q.where(Section.teacher_id == teacher_id)
    result = await db.execute(q.offset(pagination.skip).limit(pagination.limit))
    return list(result.scalars().all())


@router.get("/{section_id}", response_model=SectionResponse)
async def get_section(section_id: int, db: DBSession) -> Section:
    """Retrieve a section by ID."""
    obj = await db.get(Section, section_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return obj


@router.post("", response_model=SectionResponse, status_code=status.HTTP_201_CREATED)
async def create_section(payload: SectionCreate, db: DBSession) -> Section:
    """Create a new section."""
    obj = Section(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/{section_id}", response_model=SectionResponse)
async def update_section(section_id: int, payload: SectionUpdate, db: DBSession) -> Section:
    """Apply a partial update to a section."""
    obj = await db.get(Section, section_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_section(section_id: int, db: DBSession) -> None:
    """Soft-delete a section."""
    obj = await db.get(Section, section_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    obj.is_active = False
