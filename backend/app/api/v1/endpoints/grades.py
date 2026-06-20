"""Endpoints for grade management: enrollments and grade components.

Bulk ingestion is intentionally outside the current API scope.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.access_control import (
    can_access_section,
    can_access_student,
    get_teacher_for_user,
    is_admin,
    require_department_scope,
)
from app.crud import teaching as crud
from app.dependencies import CurrentUser, DBSession, PaginationDep, require_write_access
from app.models.academic import Course, Program
from app.models.people import Student, UserRole
from app.models.teaching import Enrollment, GradeComponent, GradeComponentType, Section
from app.reports.scheduler import (
    END_SEMESTER_FREQUENCY,
    FINAL_TRIGGER,
    grade_component_schedule_frequency,
    grade_component_schedule_trigger,
    run_grade_update_schedules,
)
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
    current_user: CurrentUser,
    section_id: int | None = None,
    student_id: int | None = None,
) -> list[Enrollment]:
    """Return enrollments filtered by section or student."""
    if section_id is not None and not await can_access_section(db, current_user, section_id):
        return []
    if student_id is not None and not await can_access_student(db, current_user, student_id):
        return []
    if not is_admin(current_user):
        q = select(Enrollment).join(Section, Section.id == Enrollment.section_id)
        if section_id is not None:
            q = q.where(Enrollment.section_id == section_id)
        if student_id is not None:
            q = q.where(Enrollment.student_id == student_id)
        if current_user.role == UserRole.lecturer:
            teacher = await get_teacher_for_user(db, current_user)
            if teacher is None:
                return []
            q = q.where(Section.teacher_id == teacher.id)
        else:
            department_ids = await require_department_scope(db, current_user)
            q = (
                q.join(Student, Student.id == Enrollment.student_id)
                .join(Program, Program.id == Student.program_id)
                .join(Course, Course.id == Section.course_id)
                .where((Program.department_id.in_(department_ids)) | (Course.department_id.in_(department_ids)))
            )
        q = q.offset(pagination.skip).limit(pagination.limit)
        return list((await db.execute(q)).scalars().all())
    return await crud.list_enrollments(db, pagination.skip, pagination.limit, section_id, student_id)


@router.post(
    "/enrollments",
    response_model=EnrollmentResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_enrollment(payload: EnrollmentCreate, db: DBSession) -> Enrollment:
    """Enroll a student in a section."""
    section = await db.get(Section, payload.section_id)
    if section is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Section not found")
    course = await db.get(Course, section.course_id)
    data = payload.model_dump()
    data["registered_credits"] = course.credits if course is not None else None
    return await crud.create_enrollment(db, data)


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
    updated = await crud.update_enrollment(
        db,
        obj,
        {
            "final_grade": payload.final_grade,
            "grade_letter": grade_letter,
            "grade_4": grade_4,
            "is_passed": payload.final_grade >= 5.0,
            "completed_at": datetime.now(UTC),
        },
    )
    await run_grade_update_schedules(
        db,
        enrollment_id=enrollment_id,
        schedule_frequency=END_SEMESTER_FREQUENCY,
        trigger=FINAL_TRIGGER,
    )
    return updated


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
    component_type = await db.get(GradeComponentType, payload.component_type_id)
    component_name = component_type.name if component_type else None
    schedule_frequency = grade_component_schedule_frequency(component_name)
    schedule_trigger = grade_component_schedule_trigger(component_name)
    data = payload.model_dump(exclude_unset=True)
    if payload.score is not None or payload.is_absent:
        recorded_at = datetime.now(UTC)
        if data.get("assessed_at") is None:
            data["assessed_at"] = recorded_at
        data["recorded_at"] = recorded_at
    if obj is None:
        created = await crud.create_grade_component(db, data)
        await run_grade_update_schedules(
            db,
            enrollment_id=payload.enrollment_id,
            schedule_frequency=schedule_frequency,
            trigger=schedule_trigger,
        )
        return created
    updated = await crud.update_grade_component(db, obj, data)
    await run_grade_update_schedules(
        db,
        enrollment_id=payload.enrollment_id,
        schedule_frequency=schedule_frequency,
        trigger=schedule_trigger,
    )
    return updated
