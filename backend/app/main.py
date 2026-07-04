"""EduInsight FastAPI application entry point."""

import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.config import get_settings
from app.observability import observability_middleware

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

    try:
        from app.api.v1.endpoints.analytics import prewarm_dashboard_cache
        await prewarm_dashboard_cache()
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Failed to prewarm dashboard cache on startup: {e}")

    from app.reports.scheduler import report_schedule_worker

    schedule_worker_stop = asyncio.Event()
    schedule_worker_task: asyncio.Task[None] | None = None
    if settings.app_env not in {"test", "testing"}:
        schedule_worker_task = asyncio.create_task(
            report_schedule_worker(stop_event=schedule_worker_stop),
        )
        app.state.report_schedule_worker_task = schedule_worker_task

    try:
        yield
    finally:
        if schedule_worker_task is not None:
            schedule_worker_stop.set()
            schedule_worker_task.cancel()
            try:
                await schedule_worker_task
            except asyncio.CancelledError:
                pass

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

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_origin_regex=r"https://.*\.ngrok-free\.(dev|app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.middleware("http")(observability_middleware)

app.include_router(api_router, prefix="/api/v1")


@app.api_route("/health", methods=["GET", "HEAD"], tags=["system"])
async def health_check() -> dict[str, str]:
    """Return basic service health status."""
    return {"status": "ok", "service": "eduinsight-backend", "version": settings.app_version}
