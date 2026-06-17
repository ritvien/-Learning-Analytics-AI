"""Report generation, history, and feedback endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.dependencies import CurrentUser, DBSession, require_write_access
from app.models.report import Report, ReportFeedback
from app.reports.service import generate_report
from app.schemas.reports import ReportFeedbackCreate, ReportFeedbackResponse, ReportGenerateRequest, ReportResponse

router = APIRouter()


async def _get_report_or_404(report_id: str, db: DBSession) -> Report:
    result = await db.execute(
        select(Report).options(selectinload(Report.feedback_items)).where(Report.id == report_id)
    )
    report = result.scalar_one_or_none()
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    return report


@router.get("", response_model=list[ReportResponse])
async def list_reports(db: DBSession, current_user: CurrentUser, limit: int = 50) -> list[Report]:
    """Return recent generated reports."""
    result = await db.execute(
        select(Report)
        .options(selectinload(Report.feedback_items))
        .order_by(Report.created_at.desc())
        .limit(min(limit, 200))
    )
    return list(result.scalars().all())


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(report_id: str, db: DBSession, current_user: CurrentUser) -> Report:
    """Return one generated report."""
    return await _get_report_or_404(report_id, db)


@router.post(
    "",
    response_model=ReportResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_write_access)],
)
async def create_report(payload: ReportGenerateRequest, db: DBSession, current_user: CurrentUser) -> Report:
    """Generate and persist a deterministic report."""
    try:
        report = await generate_report(
            db,
            report_type=payload.report_type,
            actor_role=payload.actor_role,
            generated_by=current_user.id,
            scope_type=payload.scope_type,
            scope_id=payload.scope_id,
        )
        return await _get_report_or_404(report.id, db)
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
    report = await db.get(Report, report_id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
    feedback = ReportFeedback(report_id=report_id, user_id=current_user.id, **payload.model_dump())
    db.add(feedback)
    await db.flush()
    await db.refresh(feedback)
    return feedback
