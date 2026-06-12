"""Integration tests for department CRUD endpoints."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.academic import University


async def create_university(db_session: AsyncSession) -> University:
    """Create the parent record required by department tests."""
    university = University(code="EPU", name="Electric Power University")
    db_session.add(university)
    await db_session.flush()
    return university


async def test_department_create_list_and_soft_delete(client: AsyncClient, db_session: AsyncSession) -> None:
    """A department can be created, listed, and hidden after soft delete."""
    university = await create_university(db_session)

    create_response = await client.post(
        "/api/v1/departments",
        json={"university_id": university.id, "code": "IT", "name": "Information Technology"},
    )
    assert create_response.status_code == 201
    department_id = create_response.json()["id"]

    list_response = await client.get("/api/v1/departments")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [department_id]

    delete_response = await client.delete(f"/api/v1/departments/{department_id}")
    assert delete_response.status_code == 204

    list_after_delete = await client.get("/api/v1/departments")
    assert list_after_delete.status_code == 200
    assert list_after_delete.json() == []


async def test_department_get_returns_404_for_unknown_id(client: AsyncClient) -> None:
    """Unknown department IDs return a clear not-found response."""
    response = await client.get("/api/v1/departments/999")

    assert response.status_code == 404
    assert response.json()["detail"] == "Department not found"
