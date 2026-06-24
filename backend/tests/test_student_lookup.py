"""Tests for student_code lookup API and agent tool."""

from unittest.mock import MagicMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.tools import lookup_student_by_code
from app.dependencies import create_access_token
from app.models.academic import Department, Program, University
from app.models.people import Cohort, Student, UserRole
from tests.test_guardrails_rbac import _create_catalog, _create_scoped_user


async def _seed_student(db_session: AsyncSession, *, code: str, program_id: int) -> Student:
    cohort = Cohort(code="K21", year_start=2021)
    db_session.add(cohort)
    await db_session.flush()
    student = Student(
        program_id=program_id,
        cohort_id=cohort.id,
        student_code=code,
        full_name="Lookup Test Student",
    )
    db_session.add(student)
    await db_session.flush()
    return student


async def test_get_student_by_code_returns_internal_id(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    university = University(code="EPU-LU", name="EPU Lookup")
    db_session.add(university)
    await db_session.flush()
    department = Department(university_id=university.id, code="CNTT-LU", name="CNTT")
    db_session.add(department)
    await db_session.flush()
    program = Program(department_id=department.id, code="IT-LU", name="IT")
    db_session.add(program)
    await db_session.flush()
    student = await _seed_student(db_session, code="21810310019", program_id=program.id)

    response = await client.get("/api/v1/students/by-code/21810310019")

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == student.id
    assert body["student_code"] == "21810310019"


async def test_get_student_by_code_not_found(client: AsyncClient) -> None:
    response = await client.get("/api/v1/students/by-code/missing-code")

    assert response.status_code == 404


async def test_get_student_by_code_respects_rbac(
    client: AsyncClient,
    db_session: AsyncSession,
) -> None:
    allowed_department, _, denied_program, _ = await _create_catalog(db_session)
    student = await _seed_student(db_session, code="DROP-IDOR-LU", program_id=denied_program.id)
    manager = await _create_scoped_user(db_session, role=UserRole.manager, department_id=allowed_department.id)
    client.headers["Authorization"] = f"Bearer {create_access_token(manager.id, manager.role)}"

    response = await client.get(f"/api/v1/students/by-code/{student.student_code}")

    assert response.status_code == 404


@patch("app.agent.tools.psycopg2.connect")
def test_lookup_student_tool_maps_code_to_id(mock_connect: MagicMock) -> None:
    cursor = MagicMock()
    cursor.fetchone.return_value = (110, "21810310019", "DINH TAN HOANG", "expelled", 1, 2, 4.39)
    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = connection

    result = lookup_student_by_code.invoke({"student_code": "21810310019"})

    assert '"student_id": 110' in result
    assert "21810310019" in result


@patch("app.agent.tools.psycopg2.connect")
def test_lookup_student_tool_not_found(mock_connect: MagicMock) -> None:
    cursor = MagicMock()
    cursor.fetchone.return_value = None
    connection = MagicMock()
    connection.cursor.return_value.__enter__.return_value = cursor
    mock_connect.return_value = connection

    result = lookup_student_by_code.invoke({"student_code": "missing"})

    assert result.startswith("ERROR:")
    assert "Không tìm thấy sinh viên" in result
