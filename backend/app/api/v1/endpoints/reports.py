"""Report generation, history, schedules, and feedback endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.access_control import can_create_report_scope, can_view_report
from app.dependencies import CurrentUser, DBSession, require_write_access
from app.models.report import Report, ReportFeedback, ReportSchedule, ReportScheduleRun
from app.reports.scheduler import next_run_after, run_schedule
from app.reports.service import generate_report
from app.schemas.reports import (
    ReportFeedbackCreate,
    ReportFeedbackResponse,
    ReportGenerateRequest,
    ReportResponse,
    ReportScheduleCreate,
    ReportScheduleResponse,
    ReportScheduleRunRequest,
    ReportScheduleRunResponse,
    ReportScheduleUpdate,
)

router = APIRouter()


async def _get_report_or_404(report_id: str, db: DBSession, current_user: CurrentUser) -> Report:
    result = await db.execute(
        select(Report).options(selectinload(Report.feedback_items)).where(Report.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None or not await can_view_report(db, current_user, report):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


async def _get_schedule_or_404(schedule_id: int, db: DBSession, current_user: CurrentUser) -> ReportSchedule:
    result = await db.execute(select(ReportSchedule).where(ReportSchedule.id == schedule_id))
    schedule = result.scalar_one_or_none()
    if schedule is None or not await can_view_report(db, current_user, schedule):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report schedule not found")
    return schedule


@router.get("", response_model=list[ReportResponse])
async def list_reports(db: DBSession, current_user: CurrentUser, limit: int = 50) -> list[Report]:
    """Return recent generated reports."""
    query = select(Report).options(selectinload(Report.feedback_items)).order_by(Report.created_at.desc()).limit(200)
    result = await db.execute(query)
    reports = list(result.scalars().all())
    visible_reports = [report for report in reports if await can_view_report(db, current_user, report)]
    return visible_reports[: min(limit, 200)]


@router.get("/schedules", response_model=list[ReportScheduleResponse])
async def list_report_schedules(
    db: DBSession,
    current_user: CurrentUser,
    active_only: bool = False,
    limit: int = 100,
) -> list[ReportSchedule]:
    """Return report schedules visible to the current actor."""
    query = select(ReportSchedule).order_by(ReportSchedule.created_at.desc()).limit(200)
    if active_only:
        query = query.where(ReportSchedule.is_active == True)  # noqa: E712
    result = await db.execute(query)
    schedules = list(result.scalars().all())
    visible_schedules = [schedule for schedule in schedules if await can_view_report(db, current_user, schedule)]
    return visible_schedules[: min(limit, 200)]


@router.post(
    "/schedules",
    response_model=ReportScheduleResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_report_schedule(
    payload: ReportScheduleCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> ReportSchedule:
    """Create a recurring report schedule."""
    allowed = await can_create_report_scope(db, current_user, payload.report_type, payload.scope_type, payload.scope_id)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Report scope is outside your permissions")
    schedule = ReportSchedule(
        **payload.model_dump(exclude={"next_run_at"}),
        next_run_at=payload.next_run_at or next_run_after(payload.frequency),
        created_by=current_user.id,
    )
    db.add(schedule)
    await db.flush()
    await db.refresh(schedule)
    return schedule


@router.patch(
    "/schedules/{schedule_id}",
    response_model=ReportScheduleResponse,
    dependencies=[Depends(require_write_access)],
)
async def update_report_schedule(
    schedule_id: int,
    payload: ReportScheduleUpdate,
    db: DBSession,
    current_user: CurrentUser,
) -> ReportSchedule:
    """Update a recurring report schedule."""
    schedule = await _get_schedule_or_404(schedule_id, db, current_user)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(schedule, key, value)
    if "frequency" in updates and "next_run_at" not in updates:
        schedule.next_run_at = next_run_after(schedule.frequency)
    await db.flush()
    await db.refresh(schedule)
    return schedule


@router.get("/schedules/{schedule_id}/runs", response_model=list[ReportScheduleRunResponse])
async def list_report_schedule_runs(
    schedule_id: int,
    db: DBSession,
    current_user: CurrentUser,
    limit: int = 50,
) -> list[ReportScheduleRun]:
    """Return execution logs for one report schedule."""
    await _get_schedule_or_404(schedule_id, db, current_user)
    result = await db.execute(
        select(ReportScheduleRun)
        .where(ReportScheduleRun.schedule_id == schedule_id)
        .order_by(ReportScheduleRun.created_at.desc())
        .limit(min(limit, 200))
    )
    return list(result.scalars().all())


@router.post(
    "/schedules/{schedule_id}/run",
    response_model=ReportScheduleRunResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def run_report_schedule(
    schedule_id: int,
    payload: ReportScheduleRunRequest,
    db: DBSession,
    current_user: CurrentUser,
) -> ReportScheduleRun:
    """Run a schedule now; cron/grade-update workers call this same contract."""
    schedule = await _get_schedule_or_404(schedule_id, db, current_user)
    run = await run_schedule(db, schedule, trigger=payload.trigger)
    if run.status == "failed":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=run.message or "Report schedule failed")
    return run


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(report_id: str, db: DBSession, current_user: CurrentUser) -> Report:
    """Return one generated report."""
    return await _get_report_or_404(report_id, db, current_user)


@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_report(payload: ReportGenerateRequest, db: DBSession, current_user: CurrentUser) -> Report:
    """Generate and persist a deterministic report."""
    allowed = await can_create_report_scope(db, current_user, payload.report_type, payload.scope_type, payload.scope_id)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Report scope is outside your permissions")
    try:
        report = await generate_report(
            db,
            report_type=payload.report_type,
            actor_role=payload.actor_role,
            generated_by=current_user.id,
            scope_type=payload.scope_type,
            scope_id=payload.scope_id,
            semester_id=payload.semester_id,
        )
        return await _get_report_or_404(report.id, db, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{report_id}/feedback", response_model=ReportFeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_report_feedback(
    report_id: str,
    payload: ReportFeedbackCreate,
    db: DBSession,
    current_user: CurrentUser,
) -> ReportFeedback:
    """Attach user feedback to a report."""
    await _get_report_or_404(report_id, db, current_user)
    feedback = ReportFeedback(report_id=report_id, user_id=current_user.id, **payload.model_dump())
    db.add(feedback)
    await db.flush()
    await db.refresh(feedback)
    return feedback
