"""Tests for analytics dashboard filter parsing."""

from datetime import UTC, datetime
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.api.v1.endpoints.analytics import (
    _dashboard_filter_sql,
    _section_data_status,
    _section_hierarchy_level,
    _validate_dashboard_date_range,
)


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


def test_dashboard_filter_rejects_inverted_range() -> None:
    with pytest.raises(HTTPException) as exc_info:
        _validate_dashboard_date_range("2026-07-03T00:00:00Z", "2026-07-02T00:00:00Z")

    assert exc_info.value.status_code == 422


def test_section_data_status_distinguishes_empty_partial_and_ready() -> None:
    assert _section_data_status({"total_sections": 0}) == ("empty", [])
    ready, warnings = _section_data_status({
        "total_sections": 1,
        "missing_grade_count": 0,
        "low_coverage_sections": 0,
        "small_sections": 0,
    })
    assert ready == "ready"
    assert warnings == []
    partial, warnings = _section_data_status({
        "total_sections": 1,
        "missing_grade_count": 2,
        "low_coverage_sections": 1,
        "small_sections": 1,
    })
    assert partial == "partial"
    assert len(warnings) == 3


@pytest.mark.parametrize(
    ("role", "department_id", "program_id", "expected"),
    [
        ("admin", None, None, "department"),
        ("admin", 1, None, "program"),
        ("admin", 1, 2, "course"),
        ("manager", 1, None, "program"),
        ("manager", 1, 2, "course"),
        ("lecturer", 1, None, "course"),
    ],
)
def test_section_hierarchy_adapts_to_role_and_scope(role: str, department_id: int | None, program_id: int | None, expected: str) -> None:
    user = SimpleNamespace(role=SimpleNamespace(value=role))
    assert _section_hierarchy_level(user, department_id, program_id) == expected
