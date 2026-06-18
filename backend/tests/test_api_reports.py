"""Integration tests for reports endpoints."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from unittest.mock import patch

from app.models.people import User, UserRole


@pytest.mark.asyncio
async def test_report_requires_admin_or_manager(client: AsyncClient, db_session: AsyncSession):
    """Report creation requires write access (admin or manager)."""
    # Create lecturer (read-only)
    from app.dependencies import hash_password
    lecturer = User(
        id="test-lecturer-report",
        email="lecturer2@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test Lecturer 2",
        role=UserRole.lecturer,
    )
    db_session.add(lecturer)
    await db_session.flush()

    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "lecturer2@example.com", "password": "password123"},
    )
    lecturer_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    # Attempt to create report
    response = await client.post(
        "/api/v1/reports",
        json={
            "report_type": "program_health",
            "actor_role": "manager",
            "scope_type": "program",
            "scope_id": "1"
        },
        headers=lecturer_headers
    )
    assert response.status_code == 403


@pytest.mark.asyncio
@patch("app.api.v1.endpoints.reports.generate_report")
async def test_generate_report_success(mock_generate_report, client: AsyncClient):
    """Successful report creation."""
    from app.models.report import Report
    from unittest.mock import patch, MagicMock
    from datetime import datetime, timezone
    import uuid
    
    mock_report = Report(
        id="test-report-1",
        title="Performance Report",
        status="completed",
        report_type="program_health",
        actor_role="admin",
        summary="Test summary",
        content_markdown="mock data",
        metrics_json={},
        created_at=datetime.now(timezone.utc)
    )
    mock_generate_report.return_value = mock_report

    # Need to patch the inner DB retrieval as well since generate_report mock just returns a report
    # but the endpoint fetches it again
    with patch("app.api.v1.endpoints.reports._get_report_or_404", return_value=mock_report):
        response = await client.post(
            "/api/v1/reports",
            json={
                "report_type": "program_health",
                "actor_role": "manager",
                "scope_type": "program",
                "scope_id": "1"
            }
        )
    
        assert response.status_code == 201
        assert response.json()["report_type"] == "program_health"
