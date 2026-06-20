#!/bin/sh
# EduInsight backend entrypoint
# Runs Alembic migrations then starts the FastAPI server.
set -e

echo "[entrypoint] Running database migrations..."
alembic upgrade head

if [ "${SEED_ON_EMPTY:-true}" != "false" ]; then
    echo "[entrypoint] Seeding database when empty..."
    python scripts/seed_database.py
fi

echo "[entrypoint] Refreshing CLO achievement materialization..."
python -m app.analytics.clo

echo "[entrypoint] Starting EduInsight API on port ${PORT:-8000}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WORKERS:-1}"
