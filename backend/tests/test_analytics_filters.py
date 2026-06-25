"""Tests for analytics dashboard filter parsing."""

from datetime import UTC, datetime

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.analytics import _dashboard_filter_sql


def test_dashboard_filter_sql_parses_browser_iso_datetime() -> None:
    where_sql, params = _dashboard_filter_sql(
        date_from="2022-06-22T17:00:00.000Z",
        date_to="2026-06-02T16:59:59.999Z",
    )

    assert "f.updated_at >= CAST(:date_from AS timestamptz)" in where_sql
    assert params["date_from"] == datetime(2022, 6, 22, 17, 0, tzinfo=UTC)
    assert params["date_to"] == datetime(2026, 6, 2, 16, 59, 59, 999000, tzinfo=UTC)


def test_dashboard_filter_sql_rejects_invalid_datetime() -> None:
    with pytest.raises(HTTPException) as exc_info:
        _dashboard_filter_sql(date_from="not-a-date")

    assert exc_info.value.status_code == 400
    assert "Invalid date_from" in exc_info.value.detail
