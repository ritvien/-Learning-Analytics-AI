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
    GradeComponentDetailResponse,
    GradeImportRequest,
    GradeImportResult,
    GradeComponentResponse,
    GradeComponentUpsert,
)

router = APIRouter()
GRADE_WRITE_ROLES = {UserRole.superadmin, UserRole.admin, UserRole.manager, UserRole.lecturer}


async def require_grade_write_access(current_user: CurrentUser) -> CurrentUser:
    """Allow academic staff to submit grades, still scoped per enrollment/section."""
    if current_user.role not in GRADE_WRITE_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
    return current_user


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


async def _update_final_grade(db: DBSession, enrollment: Enrollment, final_grade: float) -> Enrollment:
    grade_letter, grade_4 = _grade_letter_and_4(final_grade)
    updated = await crud.update_enrollment(
        db,
        enrollment,
        {
            "final_grade": final_grade,
            "grade_letter": grade_letter,
            "grade_4": grade_4,
            "is_passed": final_grade >= 5.0,
            "completed_at": datetime.now(UTC),
        },
    )
    await run_grade_update_schedules(
        db,
        enrollment_id=enrollment.id,
        schedule_frequency=END_SEMESTER_FREQUENCY,
        trigger=FINAL_TRIGGER,
    )
    return updated


async def _upsert_component_score(
    db: DBSession,
    enrollment: Enrollment,
    component_name: str,
    score: float,
    notes: str | None = None,
) -> GradeComponent:
    section = await db.get(Section, enrollment.section_id)
    if section is None:
        raise ValueError("Section not found")
    result = await db.execute(
        select(GradeComponentType).where(
            GradeComponentType.section_id == section.id,
            GradeComponentType.name == component_name,
        )
    )
    component_type = result.scalar_one_or_none()
    if component_type is None:
        component_type = GradeComponentType(
            section_id=section.id,
            name=component_name,
            weight=1.0,
            max_score=10.0,
            is_required=True,
            sort_order=0,
        )
        db.add(component_type)
        await db.flush()

    recorded_at = datetime.now(UTC)
    existing = await crud.get_grade_component(db, enrollment.id, component_type.id)
    data = {
        "enrollment_id": enrollment.id,
        "component_type_id": component_type.id,
        "score": score,
        "max_score": component_type.max_score,
        "is_absent": False,
        "assessed_at": recorded_at,
        "recorded_at": recorded_at,
        "notes": notes,
    }
    if existing is None:
        component = await crud.create_grade_component(db, data)
    else:
        component = await crud.update_grade_component(db, existing, data)

    await run_grade_update_schedules(
        db,
        enrollment_id=enrollment.id,
        schedule_frequency=grade_component_schedule_frequency(component_name),
        trigger=grade_component_schedule_trigger(component_name),
    )
    return component


async def _find_enrollment_for_import(
    db: DBSession,
    enrollment_id: int | None,
    student_code: str | None,
    section_code: str | None,
    course_code: str | None,
) -> Enrollment | None:
    if enrollment_id is not None:
        return await crud.get_enrollment(db, enrollment_id)
    if not student_code or not section_code:
        return None
    query = (
        select(Enrollment)
        .join(Student, Student.id == Enrollment.student_id)
        .join(Section, Section.id == Enrollment.section_id)
        .where(Student.student_code == student_code.strip())
        .where(Section.section_code == section_code.strip())
    )
    if course_code:
        query = query.join(Course, Course.id == Section.course_id).where(Course.code == course_code.strip())
    result = await db.execute(query)
    return result.scalar_one_or_none()


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
    dependencies=[Depends(require_grade_write_access)],
)
async def submit_final_grade(
    enrollment_id: int,
    payload: EnrollmentGradeUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> Enrollment:
    """Submit or update the final grade for an enrollment."""
    obj = await crud.get_enrollment(db, enrollment_id)
    if obj is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    if not await can_access_section(db, current_user, obj.section_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    return await _update_final_grade(db, obj, payload.final_grade)


# ========================================================= Grade Components
@router.put(
    "/components",
    response_model=GradeComponentResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_grade_write_access)],
)
async def upsert_grade_component(payload: GradeComponentUpsert, db: DBSession, current_user: CurrentUser) -> GradeComponent:
    """Create or update a student's score for one grade component."""
    enrollment = await crud.get_enrollment(db, payload.enrollment_id)
    if enrollment is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    if not await can_access_section(db, current_user, enrollment.section_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
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


@router.get("/components", response_model=list[GradeComponentDetailResponse])
async def list_grade_components(
    db: DBSession,
    pagination: PaginationDep,
    current_user: CurrentUser,
    enrollment_id: int | None = None,
    section_id: int | None = None,
) -> list[dict]:
    """Return grade components visible to the current actor."""
    query = (
        select(GradeComponent, GradeComponentType.name)
        .join(GradeComponentType, GradeComponentType.id == GradeComponent.component_type_id)
        .join(Enrollment, Enrollment.id == GradeComponent.enrollment_id)
        .join(Section, Section.id == Enrollment.section_id)
    )
    if enrollment_id is not None:
        query = query.where(GradeComponent.enrollment_id == enrollment_id)
    if section_id is not None:
        query = query.where(Enrollment.section_id == section_id)

    if not is_admin(current_user):
        if current_user.role == UserRole.lecturer:
            teacher = await get_teacher_for_user(db, current_user)
            if teacher is None:
                return []
            query = query.where(Section.teacher_id == teacher.id)
        else:
            department_ids = await require_department_scope(db, current_user)
            query = (
                query.join(Student, Student.id == Enrollment.student_id)
                .join(Program, Program.id == Student.program_id)
                .join(Course, Course.id == Section.course_id)
                .where((Program.department_id.in_(department_ids)) | (Course.department_id.in_(department_ids)))
            )

    result = await db.execute(query.offset(pagination.skip).limit(pagination.limit))
    return [
        {
            "id": component.id,
            "enrollment_id": component.enrollment_id,
            "component_type_id": component.component_type_id,
            "component_name": component_name,
            "score": component.score,
            "max_score": component.max_score,
            "is_absent": component.is_absent,
            "assessed_at": component.assessed_at,
            "recorded_at": component.recorded_at,
            "updated_at": component.updated_at,
        }
        for component, component_name in result.all()
    ]


@router.post(
    "/import",
    response_model=GradeImportResult,
    dependencies=[Depends(require_grade_write_access)],
)
async def import_grades(payload: GradeImportRequest, db: DBSession, current_user: CurrentUser) -> GradeImportResult:
    """Import final grades and/or component grades parsed from an Excel file."""
    errors: list[str] = []
    updated_rows = 0

    for index, row in enumerate(payload.rows, start=1):
        row_no = row.row_number or index
        try:
            enrollment = await _find_enrollment_for_import(
                db,
                row.enrollment_id,
                row.student_code,
                row.section_code,
                row.course_code,
            )
            if enrollment is None:
                errors.append(f"Row {row_no}: enrollment not found")
                continue
            if not await can_access_section(db, current_user, enrollment.section_id):
                errors.append(f"Row {row_no}: enrollment not found")
                continue

            did_update = False
            if row.final_grade is not None:
                await _update_final_grade(db, enrollment, row.final_grade)
                did_update = True
            if row.component_name and row.component_score is not None:
                await _upsert_component_score(db, enrollment, row.component_name.strip(), row.component_score, row.notes)
                did_update = True
            if not did_update:
                errors.append(f"Row {row_no}: no grade value provided")
                continue
            updated_rows += 1
        except Exception as exc:
            errors.append(f"Row {row_no}: {exc}")

    return GradeImportResult(
        total_rows=len(payload.rows),
        updated_rows=updated_rows,
        skipped_rows=len(payload.rows) - updated_rows,
        errors=errors[:50],
    )
