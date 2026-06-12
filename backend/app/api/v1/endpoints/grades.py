"""Endpoints for grade management: enrollments and grade components.

Bulk ingestion is intentionally outside the current API scope.
"""

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.dependencies import DBSession, PaginationDep
from app.models.teaching import Enrollment, GradeComponent
from app.schemas.teaching import (
    EnrollmentCreate,
    EnrollmentGradeUpdate,
    EnrollmentResponse,
    GradeComponentResponse,
    GradeComponentUpsert,
)

router = APIRouter()


# ============================================================== Enrollments
@router.get("/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(
    db: DBSession,
    pagination: PaginationDep,
    section_id: int | None = None,
    student_id: int | None = None,
) -> list[Enrollment]:
    """Return enrollments filtered by section or student."""
    q = select(Enrollment)
    if section_id is not None:
        q = q.where(Enrollment.section_id == section_id)
    if student_id is not None:
        q = q.where(Enrollment.student_id == student_id)
    result = await db.execute(q.offset(pagination.skip).limit(pagination.limit))
    return list(result.scalars().all())


@router.post("/enrollments", response_model=EnrollmentResponse, status_code=status.HTTP_201_CREATED)
async def create_enrollment(payload: EnrollmentCreate, db: DBSession) -> Enrollment:
    """Enroll a student in a section."""
    obj = Enrollment(**payload.model_dump())
    db.add(obj)
    await db.flush()
    await db.refresh(obj)
    return obj


@router.patch("/enrollments/{enrollment_id}/grade", response_model=EnrollmentResponse)
async def submit_final_grade(
    enrollment_id: int,
    payload: EnrollmentGradeUpdate,
    db: DBSession,
) -> Enrollment:
    """Submit or update the final grade for an enrollment."""
    obj = await db.get(Enrollment, enrollment_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    obj.final_grade = payload.final_grade
    # Compute pass status inline (mirrors the DB trigger for non-PostgreSQL dev)
    obj.is_passed = payload.final_grade >= 5.0
    await db.flush()
    await db.refresh(obj)
    return obj


# ========================================================= Grade Components
@router.put("/components", response_model=GradeComponentResponse, status_code=status.HTTP_200_OK)
async def upsert_grade_component(payload: GradeComponentUpsert, db: DBSession) -> GradeComponent:
    """Create or update a student's score for one grade component."""
    result = await db.execute(
        select(GradeComponent).where(
            GradeComponent.enrollment_id == payload.enrollment_id,
            GradeComponent.component_type_id == payload.component_type_id,
        )
    )
    obj = result.scalar_one_or_none()
    if obj is None:
        obj = GradeComponent(**payload.model_dump())
        db.add(obj)
    else:
        for field, value in payload.model_dump(exclude_unset=True).items():
            setattr(obj, field, value)
    await db.flush()
    await db.refresh(obj)
    return obj
