"""Integration tests for recurring report schedules."""

from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import ReportSchedule, ReportScheduleRun
from app.reports.scheduler import run_due_schedules


async def test_create_list_and_run_report_schedule(client: AsyncClient) -> None:
    create_response = await client.post(
        "/api/v1/reports/schedules",
        json={
            "name": "Weekly school health",
            "report_type": "school_overview",
            "actor_role": "manager",
            "scope_type": "school",
            "scope_id": None,
            "frequency": "weekly",
            "trigger_event": "scheduled_monday",
            "recipients_json": ["manager"],
            "formats_json": ["web", "pdf"],
            "detail_level": "standard",
            "include_ai_narrative": True,
            "include_appendix": True,
        },
    )

    assert create_response.status_code == 201
    schedule = create_response.json()
    assert schedule["id"]
    assert schedule["next_run_at"]

    list_response = await client.get("/api/v1/reports/schedules")
    assert list_response.status_code == 200
    assert any(item["id"] == schedule["id"] for item in list_response.json())

    run_response = await client.post(
        f"/api/v1/reports/schedules/{schedule['id']}/run",
        json={"trigger": "manual"},
    )
    assert run_response.status_code == 201
    run = run_response.json()
    assert run["status"] == "success"
    assert run["report_id"]

    runs_response = await client.get(f"/api/v1/reports/schedules/{schedule['id']}/runs")
    assert runs_response.status_code == 200
    assert runs_response.json()[0]["report_id"] == run["report_id"]


async def test_due_report_schedule_runs_from_worker(db_session: AsyncSession) -> None:
    schedule = ReportSchedule(
        name="Due monthly overview",
        report_type="school_overview",
        actor_role="manager",
        scope_type="school",
        scope_id=None,
        frequency="monthly",
        recipients_json=["manager"],
        formats_json=["web"],
        detail_level="standard",
        include_ai_narrative=True,
        include_appendix=True,
        is_active=True,
        next_run_at=datetime.now(UTC) - timedelta(minutes=5),
        created_by="test-admin",
    )
    db_session.add(schedule)
    await db_session.flush()

    ran = await run_due_schedules(db_session)

    assert ran == 1
    await db_session.refresh(schedule)
    assert schedule.last_report_id
    assert schedule.last_run_at
    assert schedule.next_run_at
    assert schedule.next_run_at.replace(tzinfo=UTC) > datetime.now(UTC)

    result = await db_session.execute(select(ReportScheduleRun).where(ReportScheduleRun.schedule_id == schedule.id))
    run = result.scalar_one()
    assert run.trigger == "scheduled"
    assert run.status == "success"
    assert run.report_id == schedule.last_report_id
