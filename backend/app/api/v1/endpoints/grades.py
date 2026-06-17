"""Endpoints for grade management: enrollments and grade components.

Bulk ingestion is intentionally outside the current API scope.
"""

from fastapi import APIRouter, Depends, HTTPException, status

from app.crud import teaching as crud
from app.dependencies import DBSession, PaginationDep, require_write_access
from app.models.teaching import Enrollment, GradeComponent
from app.schemas.teaching import (
    EnrollmentCreate,
    EnrollmentGradeUpdate,
    EnrollmentResponse,
    GradeComponentResponse,
    GradeComponentUpsert,
)

router = APIRouter()


def _grade_letter_and_4(final_grade: float) -> tuple[str, float]:
    """Return (letter, 4-point) for a Vietnamese 10-point final grade."""
    if final_grade >= 8.5:
        return "A", 4.0
    if final_grade >= 8.0:
        return "B+", 3.5
    if final_grade >= 7.0:
        return "B", 3.0
    if final_grade >= 6.5:
        return "C+", 2.5
    if final_grade >= 5.5:
        return "C", 2.0
    if final_grade >= 5.0:
        return "D+", 1.5
    if final_grade >= 4.0:
        return "D", 1.0
    return "F", 0.0


# ============================================================== Enrollments
@router.get("/enrollments", response_model=list[EnrollmentResponse])
async def list_enrollments(
    db: DBSession,
    pagination: PaginationDep,
    section_id: int | None = None,
    student_id: int | None = None,
) -> list[Enrollment]:
    """Return enrollments filtered by section or student."""
    return await crud.list_enrollments(db, pagination.skip, pagination.limit, section_id, student_id)


@router.post(
    "/enrollments",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_enrollment(payload: EnrollmentCreate, db: DBSession) -> Enrollment:
    """Enroll a student in a section."""
    return await crud.create_enrollment(db, payload.model_dump())


@router.patch(
    "/enrollments/{enrollment_id}/grade",
    response_model=EnrollmentResponse,
    dependencies=[Depends(require_write_access)],
)
async def submit_final_grade(
    enrollment_id: int,
    payload: EnrollmentGradeUpdate,
    db: DBSession,
) -> Enrollment:
    """Submit or update the final grade for an enrollment."""
    obj = await crud.get_enrollment(db, enrollment_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    grade_letter, grade_4 = _grade_letter_and_4(payload.final_grade)
    return await crud.update_enrollment(
        db,
        obj,
        {
            "final_grade": payload.final_grade,
            "grade_letter": grade_letter,
            "grade_4": grade_4,
            "is_passed": payload.final_grade >= 5.0,
        },
    )


# ========================================================= Grade Components
@router.put(
    "/components",
    response_model=GradeComponentResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_write_access)],
)
async def upsert_grade_component(payload: GradeComponentUpsert, db: DBSession) -> GradeComponent:
    """Create or update a student's score for one grade component."""
    obj = await crud.get_grade_component(db, payload.enrollment_id, payload.component_type_id)
    if obj is None:
        return await crud.create_grade_component(db, payload.model_dump())
    return await crud.update_grade_component(db, obj, payload.model_dump(exclude_unset=True))
