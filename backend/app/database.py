"""Async SQLAlchemy engine, session factory, and declarative Base."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# Engine is created once at module load. SQL echo is very noisy, so only
# enable it explicitly with DEBUG=true.
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    # Pool settings — ignored for SQLite (no pool), relevant for PostgreSQL.
    pool_pre_ping=True,
    pool_recycle=3600,
)

AsyncSessionLocal: async_sessionmaker[AsyncSession] = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    autoflush=False,
)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields a database session per request."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
