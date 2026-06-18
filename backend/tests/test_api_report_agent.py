"""Integration tests for the report-agent endpoints."""

from datetime import UTC, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.report import Report


@pytest.fixture
async def sample_report(db_session: AsyncSession) -> Report:
    report = Report(
        id="report-agent-test",
        report_type="program_health",
        actor_role="manager",
        scope_type="program",
        scope_id="1",
        title="Program health test",
        summary="Pass rate needs review",
        status="generated",
        metrics_json={
            "pass_rate": 68.5,
            "completed_enrollments": 200,
            "passed_enrollments": 137,
            "issues": ["Pass rate below safe threshold"],
            "risks": ["Mức rủi ro: Cao"],
            "actions": ["Review bottleneck courses"],
        },
        content_markdown="# Program health test",
        generated_by="test-admin",
        created_at=datetime.now(UTC),
    )
    db_session.add(report)
    await db_session.flush()
    return report


@pytest.mark.asyncio
async def test_report_agent_tools(client: AsyncClient):
    response = await client.get("/api/v1/report-agent/tools")
    assert response.status_code == 200
    names = {item["name"] for item in response.json()}
    assert "get_report_snapshot" in names
    assert "create_task_from_report_action" in names


@pytest.mark.asyncio
async def test_report_agent_ask_explains_metric(client: AsyncClient, sample_report: Report):
    response = await client.post(
        "/api/v1/report-agent/ask",
        json={
            "report_id": sample_report.id,
            "message": "Giải thích chỉ số pass_rate tính như thế nào?",
            "mode": "explain",
            "context": {"metric_key": "pass_rate"},
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["session_id"]
    assert data["prompt_version"]
    assert "pass_rate" in str(data["tool_calls"])
    assert "Cách tính" in data["response"]


@pytest.mark.asyncio
async def test_report_agent_pending_action_confirmation(client: AsyncClient, sample_report: Report):
    ask_response = await client.post(
        "/api/v1/report-agent/ask",
        json={
            "report_id": sample_report.id,
            "message": "Tạo task xử lý vấn đề này",
            "mode": "action_planning",
        },
    )
    assert ask_response.status_code == 200
    pending = ask_response.json()["pending_actions"]
    assert pending

    confirm_response = await client.post(
        f"/api/v1/report-agent/tools/confirm/{pending[0]['id']}",
        json={"action": "confirm"},
    )
    assert confirm_response.status_code == 200
    assert confirm_response.json()["status"] == "confirmed"
