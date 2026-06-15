"""Consistent not-found behavior for core academic APIs."""

import pytest
from httpx import AsyncClient


@pytest.mark.parametrize(
    ("path", "detail"),
    [
        ("/api/v1/programs/999", "Program not found"),
        ("/api/v1/courses/999", "Course not found"),
        ("/api/v1/students/999", "Student not found"),
        ("/api/v1/teachers/999", "Teacher not found"),
        ("/api/v1/sections/999", "Section not found"),
    ],
)
async def test_core_resource_get_returns_404(client: AsyncClient, path: str, detail: str) -> None:
    """Unknown core resource IDs return a stable 404 response."""
    response = await client.get(path)

    assert response.status_code == 404
    assert response.json()["detail"] == detail
