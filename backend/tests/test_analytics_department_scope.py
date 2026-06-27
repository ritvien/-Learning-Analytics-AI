"""Department analytics must respect row-level management scope."""

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.endpoints.analytics import _scoped_department_filter
from app.dependencies import hash_password
from app.models.academic import Department, University
from app.models.people import User, UserRole


async def _manager_with_two_departments(db: AsyncSession) -> tuple[User, Department, Department]:
    university = University(code="AN-SCOPE-U", name="Analytics Scope University")
    db.add(university)
    await db.flush()
    allowed = Department(university_id=university.id, code="AN-ALLOW", name="Allowed Analytics")
    denied = Department(university_id=university.id, code="AN-DENY", name="Denied Analytics")
    db.add_all([allowed, denied])
    await db.flush()
    manager = User(
        id="analytics-scoped-manager",
        email="analytics.manager@example.com",
        hashed_password=hash_password("password123"),
        full_name="Analytics Manager",
        role=UserRole.manager,
        department_id=allowed.id,
    )
    db.add(manager)
    await db.flush()
    return manager, allowed, denied


async def test_scoped_analytics_defaults_to_manager_department(db_session: AsyncSession) -> None:
    manager, allowed, _ = await _manager_with_two_departments(db_session)

    department_id = await _scoped_department_filter(db_session, manager, None)

    assert department_id == allowed.id


async def test_scoped_analytics_rejects_other_department(db_session: AsyncSession) -> None:
    manager, _, denied = await _manager_with_two_departments(db_session)

    with pytest.raises(HTTPException) as exc_info:
        await _scoped_department_filter(db_session, manager, denied.id)

    assert exc_info.value.status_code == 403
