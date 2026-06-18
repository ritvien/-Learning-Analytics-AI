"""Integration tests for analytics endpoints."""

import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock

class MockMappings:
    def __init__(self, data):
        self.data = data
    def one(self):
        return self.data[0] if self.data else {}
    def one_or_none(self):
        return self.data[0] if self.data else None
    def all(self):
        return self.data

class MockResult:
    def __init__(self, data):
        self.data = data
    def mappings(self):
        return MockMappings(self.data)
    def scalar_one_or_none(self):
        return self.data[0] if self.data else None

from sqlalchemy.ext.asyncio import AsyncSession

original_execute = AsyncSession.execute

@pytest.fixture(autouse=True)
def mock_db_execute():
    with patch("sqlalchemy.ext.asyncio.AsyncSession.execute", autospec=True) as mock_exec:
        async def side_effect(self, statement, *args, **kwargs):
            sql = str(statement).lower()
            if "overview" in sql or "fact_enrollment_outcome" in sql and "average_grade" in sql:
                return MockResult([{"enrollment_count": 0, "passed_count": 0, "failed_count": 0, "average_grade": 0.0}])
            elif "fail_rate_pct" in sql:
                return MockResult([{"semester_id": 1, "semester_code": "2026-1", "year": 2026, "term": 1, "total_enrollments": 10, "passed_count": 8, "failed_count": 2, "avg_grade": 7.5, "fail_rate_pct": 20.0}])
            elif "dwh.fact_enrollment_outcome" in sql or "analytics/brief" in sql:
                return MockResult([])
            
            # For auth or other queries, use original implementation
            return await original_execute(self, statement, *args, **kwargs)
            
        mock_exec.side_effect = side_effect
        yield mock_exec


@pytest.mark.asyncio
async def test_analytics_requires_auth():
    """Unauthenticated request to analytics returns 401."""
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        response = await c.get("/api/v1/analytics/overview")
        assert response.status_code == 401


@pytest.mark.asyncio
async def test_analytics_overview_empty_data(client: AsyncClient):
    """Analytics overview works even with empty data."""
    response = await client.get("/api/v1/analytics/overview")
    assert response.status_code == 200
    data = response.json()
    assert "enrollment_count" in data


@pytest.mark.asyncio
async def test_analytics_trends_returns_list(client: AsyncClient):
    """Analytics trends returns a list of dictionaries."""
    response = await client.get("/api/v1/analytics/trends")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_analytics_daily_brief(client: AsyncClient):
    """Daily brief endpoint returns items list."""
    response = await client.get("/api/v1/analytics/brief")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert isinstance(data["items"], list)
