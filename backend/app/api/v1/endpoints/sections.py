"""CRUD endpoints for Section (Lớp học phần)."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.crud import teaching as crud
from app.dependencies import DBSession, PaginationDep, require_write_access
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
    return await crud.list_sections(db, pagination.skip, pagination.limit, course_id, semester_id, teacher_id)


@router.get("/{section_id}", response_model=SectionResponse)
async def get_section(section_id: int, db: DBSession) -> Section:
    """Retrieve a section by ID."""
    obj = await crud.get_section(db, section_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return obj


@router.post(
    "",
    response_model=SectionResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_section(payload: SectionCreate, db: DBSession) -> Section:
    """Create a new section."""
    return await crud.create_section(db, payload.model_dump())


@router.patch("/{section_id}", response_model=SectionResponse, dependencies=[Depends(require_write_access)])
async def update_section(section_id: int, payload: SectionUpdate, db: DBSession) -> Section:
    """Apply a partial update to a section."""
    obj = await crud.get_section(db, section_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    return await crud.update_section(db, obj, payload.model_dump(exclude_unset=True))


@router.delete("/{section_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_write_access)])
async def delete_section(section_id: int, db: DBSession) -> None:
    """Soft-delete a section."""
    obj = await crud.get_section(db, section_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Section not found")
    await crud.delete_section(db, obj)
