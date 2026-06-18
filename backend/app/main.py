"""EduInsight FastAPI application entry point."""

from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler — startup and shutdown logic."""
    # Startup: seed default users if they don't exist.
    import sys
    from pathlib import Path
    
    # Add root to sys.path if not there, to allow importing scripts
    root_dir = Path(__file__).parent.parent
    if str(root_dir) not in sys.path:
        sys.path.insert(0, str(root_dir))
        
    try:
        from scripts.seed_users import seed_default_users
        await seed_default_users()
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to seed users on startup: {e}")

    yield
    # Shutdown: dispose engine connections.
    from app.database import engine

    await engine.dispose()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.ngrok-free\.(dev|app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health_check() -> dict[str, str]:
    """Return basic service health status."""
    return {"status": "ok", "service": "eduinsight-backend", "version": settings.app_version}
