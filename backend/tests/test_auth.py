"""Authentication and role-based authorization tests."""

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import create_access_token, hash_password
from app.models.academic import University
from app.models.people import User, UserRole


async def test_login_returns_token_and_me(client: AsyncClient) -> None:
    """A valid email/password pair receives a token usable for /auth/me."""
    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin@example.com", "password": "password123"},
    )

    assert login_response.status_code == 200
    token = login_response.json()["access_token"]

    me_response = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_response.status_code == 200
    assert me_response.json()["role"] == "admin"


async def test_login_normalizes_email_case_and_whitespace(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/auth/login",
        data={"username": "  ADMIN@EXAMPLE.COM  ", "password": "password123"},
    )

    assert response.status_code == 200
    assert response.json()["access_token"]


async def test_lecturer_can_read_but_cannot_write(client: AsyncClient, db_session: AsyncSession) -> None:
    """Lecturer role is view-only for CRUD resources."""
    lecturer = User(
        id="test-lecturer",
        email="lecturer@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test Lecturer",
        role=UserRole.lecturer,
    )
    university = University(code="EPU", name="Electric Power University")
    db_session.add_all([lecturer, university])
    await db_session.flush()

    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "lecturer@example.com", "password": "password123"},
    )
    token = login_response.json()["access_token"]
    lecturer_headers = {"Authorization": f"Bearer {token}"}

    read_response = await client.get("/api/v1/departments", headers=lecturer_headers)
    assert read_response.status_code == 200

    write_response = await client.post(
        "/api/v1/departments",
        json={"university_id": university.id, "code": "IT", "name": "Information Technology"},
        headers=lecturer_headers,
    )
    assert write_response.status_code == 403


async def test_user_management_requires_admin_role(client: AsyncClient, db_session: AsyncSession) -> None:
    """Managers can CRUD academic data, but cannot manage accounts."""
    manager = User(
        id="test-manager",
        email="manager@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test Manager",
        role=UserRole.manager,
    )
    db_session.add(manager)
    await db_session.flush()

    login_response = await client.post(
        "/api/v1/auth/login",
        data={"username": "manager@example.com", "password": "password123"},
    )
    manager_headers = {"Authorization": f"Bearer {login_response.json()['access_token']}"}

    list_response = await client.get("/api/v1/auth/users", headers=manager_headers)
    assert list_response.status_code == 403

    admin_list_response = await client.get("/api/v1/auth/users")
    assert admin_list_response.status_code == 200


async def test_admin_can_create_user_with_eight_character_password(client: AsyncClient) -> None:
    """Account creation accepts a password meeting the security requirement."""
    response = await client.post(
        "/api/v1/auth/users",
        json={
            "email": "viewer@example.com",
            "password": "password123",
            "full_name": "Test Viewer",
            "role": "viewer",
        },
    )

    assert response.status_code == 201
    assert response.json()["email"] == "viewer@example.com"


async def test_create_user_rejects_password_shorter_than_eight_characters(client: AsyncClient) -> None:
    """Password validation rejects the six-character demo password for new accounts."""
    response = await client.post(
        "/api/v1/auth/users",
        json={
            "email": "viewer@example.com",
            "password": "123456",
            "full_name": "Test Viewer",
            "role": "viewer",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"][0]["ctx"]["min_length"] == 8


async def test_admin_cannot_create_or_manage_superadmin(client: AsyncClient, db_session: AsyncSession) -> None:
    """An admin account must not be able to cross the superadmin trust boundary."""
    create_response = await client.post(
        "/api/v1/auth/users",
        json={
            "email": "elevated@example.com",
            "password": "password123",
            "full_name": "Elevated User",
            "role": "superadmin",
        },
    )
    assert create_response.status_code == 403

    superadmin = User(
        id="protected-superadmin",
        email="protected.superadmin@example.com",
        hashed_password=hash_password("password123"),
        full_name="Protected Superadmin",
        role=UserRole.superadmin,
    )
    db_session.add(superadmin)
    await db_session.flush()

    update_response = await client.patch(
        f"/api/v1/auth/users/{superadmin.id}",
        json={"is_active": False},
    )
    assert update_response.status_code == 403


async def test_superadmin_can_create_superadmin(client: AsyncClient, db_session: AsyncSession) -> None:
    """The superadmin boundary remains operable by an existing superadmin."""
    actor = User(
        id="actor-superadmin",
        email="actor.superadmin@example.com",
        hashed_password=hash_password("password123"),
        full_name="Actor Superadmin",
        role=UserRole.superadmin,
    )
    db_session.add(actor)
    await db_session.flush()
    headers = {"Authorization": f"Bearer {create_access_token(actor.id, actor.role)}"}

    response = await client.post(
        "/api/v1/auth/users",
        headers=headers,
        json={
            "email": "second.superadmin@example.com",
            "password": "password123",
            "full_name": "Second Superadmin",
            "role": "superadmin",
        },
    )
    assert response.status_code == 201
