"""Pytest fixtures shared across all tests.

Uses pure pytest-asyncio (asyncio_mode = "auto" in pyproject.toml).
No anyio markers needed — async def test_* is handled automatically.
"""

import os

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Tests must not depend on a developer's local .env values.
os.environ["DEBUG"] = "false"
os.environ["APP_ENV"] = "test"
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
# CI and local pytest must not call live LLMs (Test.md §8 — integration tests use mocks).
os.environ["LLM_API_KEY"] = ""
os.environ["OPENAI_API_KEY"] = ""
os.environ["GEMINI_API_KEY"] = ""
os.environ["GOOGLE_API_KEY"] = ""
os.environ["LANGSMITH_TRACING"] = "false"
os.environ["LANGSMITH_API_KEY"] = ""

_TEST_ENV_KEYS = (
    "APP_ENV",
    "DEBUG",
    "DATABASE_URL",
    "LLM_API_KEY",
    "OPENAI_API_KEY",
    "GEMINI_API_KEY",
    "GOOGLE_API_KEY",
    "LANGSMITH_TRACING",
    "LANGSMITH_API_KEY",
)

from app.database import Base, get_db
from app.dependencies import create_access_token, hash_password
from app.main import app
from app.models.people import User, UserRole

# In-memory SQLite — no external services needed in CI.
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(autouse=True)
def _clear_settings_cache() -> None:
    """Ensure each test sees APP_ENV=test settings without a stale cached .env."""
    from app.config import get_settings

    for key in _TEST_ENV_KEYS:
        if key in ("APP_ENV", "DEBUG", "DATABASE_URL"):
            continue
        os.environ[key] = ""
    os.environ["APP_ENV"] = "test"
    os.environ["DEBUG"] = "false"
    os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
    os.environ["LANGSMITH_TRACING"] = "false"
    get_settings.cache_clear()


@pytest.fixture(autouse=True)
def _clear_response_caches() -> None:
    """Dashboard/tree caches are shared across users; reset them per test."""
    from app.api.v1.endpoints import analytics, tree

    analytics._dashboard_cache_clear()
    tree.invalidate_tree_cache()


@pytest.fixture
async def test_engine():
    """Create a fresh async engine with schema for each test."""
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def db_session(test_engine) -> AsyncSession:
    """Yield a session that rolls back after each test."""
    factory = async_sessionmaker(test_engine, expire_on_commit=False)
    async with factory() as session:
        yield session
        await session.rollback()


@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncClient:
    """Async HTTP client with the test DB session injected."""
    admin = User(
        id="test-admin",
        email="admin@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test Admin",
        role=UserRole.admin,
    )
    db_session.add(admin)
    await db_session.flush()

    async def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        c.headers["Authorization"] = f"Bearer {create_access_token(admin.id, admin.role)}"
        yield c
    app.dependency_overrides.clear()


@pytest.hookimpl(trylast=True)
def pytest_sessionfinish(session, exitstatus) -> None:
    """Force process exit on GitHub Actions when native ML threads block shutdown.

    Pytest can print "118 passed" yet hang indefinitely on Linux runners while
    xgboost/sklearn worker threads remain alive. Tests already finished at this hook.
    """
    if os.environ.get("GITHUB_ACTIONS") == "true":
        code = int(exitstatus) if exitstatus is not None else 0
        os._exit(code)
