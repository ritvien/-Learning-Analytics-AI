"""Background execution helpers for report schedules."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.database import AsyncSessionLocal
from app.models.academic import Course, Program
from app.models.people import Student
from app.models.report import ReportSchedule, ReportScheduleRun
from app.models.teaching import Enrollment, Section
from app.reports.service import generate_report

logger = logging.getLogger(__name__)

SCHEDULER_INTERVAL_SECONDS = 60


def next_run_after(frequency: str, base: datetime | None = None) -> datetime | None:
    """Return the next automatic run timestamp for a schedule frequency."""
    now = base or datetime.now(UTC)
    if frequency == "weekly":
        return now + timedelta(days=7)
    if frequency == "monthly":
        return now + timedelta(days=30)
    if frequency in {"midterm", "end_semester", "after_grade_update"}:
        return None
    return None


async def run_schedule(
    db: AsyncSession,
    schedule: ReportSchedule,
    *,
    trigger: str,
) -> ReportScheduleRun:
    """Generate a report for one schedule and persist the execution log."""
    started_at = datetime.now(UTC)
    run = ReportScheduleRun(schedule_id=schedule.id, trigger=trigger, status="running", started_at=started_at)
    db.add(run)
    await db.flush()
    try:
        report = await generate_report(
            db,
            report_type=schedule.report_type,
            actor_role=schedule.actor_role,
            generated_by=schedule.created_by,
            scope_type=schedule.scope_type,
            scope_id=schedule.scope_id,
        )
    except Exception as exc:
        run.status = "failed"
        run.message = str(exc)
        run.finished_at = datetime.now(UTC)
        logger.exception("Report schedule %s failed", schedule.id)
        await db.flush()
        return run

    finished_at = datetime.now(UTC)
    run.status = "success"
    run.report_id = report.id
    run.message = f"Generated report {report.id}"
    run.finished_at = finished_at
    schedule.last_report_id = report.id
    schedule.last_run_at = finished_at
    schedule.next_run_at = next_run_after(schedule.frequency, finished_at)
    await db.flush()
    await db.refresh(run)
    return run


async def run_due_schedules(db: AsyncSession, *, now: datetime | None = None) -> int:
    """Run active weekly/monthly schedules whose next_run_at is due."""
    due_at = now or datetime.now(UTC)
    result = await db.execute(
        select(ReportSchedule)
        .where(ReportSchedule.is_active == True)  # noqa: E712
        .where(ReportSchedule.frequency.in_(["weekly", "monthly"]))
        .where(ReportSchedule.next_run_at.is_not(None))
        .where(ReportSchedule.next_run_at <= due_at)
        .order_by(ReportSchedule.next_run_at.asc(), ReportSchedule.id.asc())
        .limit(20)
    )
    schedules = list(result.scalars().all())
    for schedule in schedules:
        await run_schedule(db, schedule, trigger="scheduled")
    return len(schedules)


async def _grade_update_scope_ids(db: AsyncSession, enrollment_id: int) -> set[tuple[str, str]]:
    """Return schedule scopes affected by a changed enrollment grade."""
    result = await db.execute(
        select(Enrollment, Section, Course, Student, Program)
        .join(Section, Section.id == Enrollment.section_id)
        .join(Course, Course.id == Section.course_id)
        .join(Student, Student.id == Enrollment.student_id)
        .join(Program, Program.id == Student.program_id)
        .where(Enrollment.id == enrollment_id)
    )
    row = result.first()
    if row is None:
        return set()
    _enrollment, section, course, _student, program = row
    scopes: set[tuple[str, str]] = {
        ("section", str(section.id)),
        ("course", str(course.id)),
        ("program", str(program.id)),
        ("department", str(program.department_id)),
        ("department", str(course.department_id)),
    }
    return scopes


async def run_grade_update_schedules(db: AsyncSession, *, enrollment_id: int) -> int:
    """Run active after-grade-update schedules affected by one enrollment."""
    scopes = await _grade_update_scope_ids(db, enrollment_id)
    if not scopes:
        return 0

    result = await db.execute(
        select(ReportSchedule)
        .where(ReportSchedule.is_active == True)  # noqa: E712
        .where(ReportSchedule.frequency == "after_grade_update")
        .order_by(ReportSchedule.id.asc())
    )
    schedules = [
        schedule
        for schedule in result.scalars().all()
        if schedule.scope_type == "school" or (schedule.scope_type, str(schedule.scope_id)) in scopes
    ]
    for schedule in schedules:
        await run_schedule(db, schedule, trigger="grade_update")
    return len(schedules)


async def report_schedule_worker(
    session_factory: async_sessionmaker[AsyncSession] = AsyncSessionLocal,
    *,
    stop_event: asyncio.Event | None = None,
    interval_seconds: int = SCHEDULER_INTERVAL_SECONDS,
) -> None:
    """Poll and run due report schedules until cancelled or stopped."""
    logger.info("Report schedule worker started")
    while stop_event is None or not stop_event.is_set():
        try:
            async with session_factory() as db:
                ran = await run_due_schedules(db)
                await db.commit()
                if ran:
                    logger.info("Report schedule worker ran %s due schedule(s)", ran)
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Report schedule worker tick failed")

        try:
            if stop_event is None:
                await asyncio.sleep(interval_seconds)
            else:
                await asyncio.wait_for(stop_event.wait(), timeout=interval_seconds)
        except TimeoutError:
            continue
    logger.info("Report schedule worker stopped")


def relevant_schedules_count(schedules: Iterable[ReportSchedule]) -> int:
    """Small test helper for counting selected schedule rows."""
    return sum(1 for _ in schedules)
