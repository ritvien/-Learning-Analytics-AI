"""Row-level access-control helpers for academic and report scopes."""

from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import exists, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import Course, Program
from app.models.people import Student, Teacher, User, UserRole
from app.models.report import Report, ReportSchedule
from app.models.teaching import Enrollment, Section


ADMIN_ROLES = {UserRole.superadmin, UserRole.admin}


def is_admin(user: User) -> bool:
    """Return True for full-access roles."""
    return user.role in ADMIN_ROLES


async def get_teacher_for_user(db: AsyncSession, user: User) -> Teacher | None:
    """Return the Teacher row linked to an application user, if any."""
    result = await db.execute(select(Teacher).where(Teacher.user_id == user.id, Teacher.is_active == True))  # noqa: E712
    return result.scalar_one_or_none()


async def user_department_ids(db: AsyncSession, user: User) -> set[int]:
    """Return departments visible to a non-admin user."""
    ids: set[int] = set()
    if user.department_id is not None:
        ids.add(user.department_id)
    teacher = await get_teacher_for_user(db, user)
    if teacher is not None:
        ids.add(teacher.department_id)
    return ids


async def require_department_scope(db: AsyncSession, user: User) -> set[int]:
    """Return visible departments or raise 403 when a scoped user has no scope."""
    if is_admin(user):
        return set()
    department_ids = await user_department_ids(db, user)
    if not department_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not assigned to a department or teacher scope",
        )
    return department_ids


async def can_access_program(db: AsyncSession, user: User, program_id: int) -> bool:
    if is_admin(user):
        return True
    department_ids = await user_department_ids(db, user)
    if not department_ids:
        return False
    result = await db.execute(
        select(exists().where(Program.id == program_id, Program.department_id.in_(department_ids)))
    )
    return bool(result.scalar())


async def can_access_course(db: AsyncSession, user: User, course_id: int) -> bool:
    if is_admin(user):
        return True
    department_ids = await user_department_ids(db, user)
    teacher = await get_teacher_for_user(db, user)
    conditions = []
    if department_ids:
        conditions.append(Course.department_id.in_(department_ids))
    if teacher is not None:
        conditions.append(exists().where(Section.course_id == Course.id, Section.teacher_id == teacher.id))
    if not conditions:
        return False
    query = select(exists().where(Course.id == course_id, or_(*conditions)))
    result = await db.execute(query)
    return bool(result.scalar())


async def can_access_section(db: AsyncSession, user: User, section_id: int) -> bool:
    if is_admin(user):
        return True
    teacher = await get_teacher_for_user(db, user)
    if user.role == UserRole.lecturer:
        if teacher is None:
            return False
        result = await db.execute(select(exists().where(Section.id == section_id, Section.teacher_id == teacher.id)))
        return bool(result.scalar())
    department_ids = await user_department_ids(db, user)
    if not department_ids:
        return False
    result = await db.execute(
        select(
            exists()
            .where(Section.id == section_id)
            .where(Section.course_id == Course.id)
            .where(Course.department_id.in_(department_ids))
        )
    )
    return bool(result.scalar())


async def can_access_student(db: AsyncSession, user: User, student_id: int) -> bool:
    if is_admin(user):
        return True
    teacher = await get_teacher_for_user(db, user)
    if user.role == UserRole.lecturer:
        if teacher is None:
            return False
        result = await db.execute(
            select(
                exists()
                .where(Enrollment.student_id == student_id)
                .where(Enrollment.section_id == Section.id)
                .where(Section.teacher_id == teacher.id)
            )
        )
        return bool(result.scalar())
    department_ids = await user_department_ids(db, user)
    if not department_ids:
        return False
    result = await db.execute(
        select(exists().where(Student.id == student_id, Student.program_id == Program.id, Program.department_id.in_(department_ids)))
    )
    return bool(result.scalar())


async def can_view_report_scope(db: AsyncSession, user: User, report_type: str, scope_type: str | None, scope_id: str | None) -> bool:
    """Check whether the user can read a report with the given scope."""
    if is_admin(user):
        return True
    if report_type == "school_overview" or scope_type == "school":
        return False
    if report_type == "program_health" or scope_type == "program":
        if scope_id is None:
            return False
        return await can_access_program(db, user, int(scope_id))
    if report_type == "section_intervention" or scope_type == "section":
        if scope_id is None:
            return False
        return await can_access_section(db, user, int(scope_id))
    return False


async def can_create_report_scope(db: AsyncSession, user: User, report_type: str, scope_type: str | None, scope_id: str | None) -> bool:
    """Check whether the user can generate a report for a scope."""
    if is_admin(user):
        return True
    if report_type == "school_overview" or scope_type == "school":
        return False
    if user.role == UserRole.manager:
        if report_type == "program_health" or scope_type == "program":
            return scope_id is not None and await can_access_program(db, user, int(scope_id))
        if report_type == "section_intervention" or scope_type == "section":
            return scope_id is not None and await can_access_section(db, user, int(scope_id))
    if user.role == UserRole.lecturer:
        return (
            (report_type == "section_intervention" or scope_type == "section")
            and scope_id is not None
            and await can_access_section(db, user, int(scope_id))
        )
    return False


async def can_view_report(db: AsyncSession, user: User, report: Report | ReportSchedule) -> bool:
    """Check read access to a persisted report or schedule."""
    return await can_view_report_scope(db, user, report.report_type, report.scope_type, report.scope_id)
