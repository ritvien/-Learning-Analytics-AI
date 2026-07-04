#!/bin/sh
# EduInsight backend entrypoint
# Runs Alembic migrations then starts the FastAPI server.
set -e

echo "[entrypoint] Running database migrations..."
alembic upgrade head

if [ "${APP_ENV:-development}" = "production" ]; then
    DEFAULT_STARTUP_DATA_JOBS="false"
else
    DEFAULT_STARTUP_DATA_JOBS="true"
fi

if [ "${SEED_ON_EMPTY:-$DEFAULT_STARTUP_DATA_JOBS}" != "false" ]; then
    echo "[entrypoint] Seeding database when empty..."
    python scripts/seed_database.py
else
    echo "[entrypoint] Skipping database seed"
fi

if [ "${IMPORT_V59_STUDENTS:-$DEFAULT_STARTUP_DATA_JOBS}" != "false" ]; then
    echo "[entrypoint] Ensuring V59 student coverage is present..."
    python scripts/import_v59_students.py \
        --source "/app/db/v59-synthetic-students.json" \
        --source "/app/db/v59-empty-program-students.json" \
        --skip-if-complete
else
    echo "[entrypoint] Skipping V59 student import"
fi

if [ "${BACKFILL_STUDENT_EMAILS_ON_STARTUP:-$DEFAULT_STARTUP_DATA_JOBS}" != "false" ]; then
    echo "[entrypoint] Backfilling student emails..."
    python scripts/seed_student_emails.py
else
    echo "[entrypoint] Skipping student email backfill"
fi

if [ "${RUN_ANALYTICS_REFRESH_ON_STARTUP:-$DEFAULT_STARTUP_DATA_JOBS}" != "false" ] && [ -n "${DATABASE_URL:-}" ] && printf '%s' "$DATABASE_URL" | grep -qi 'postgresql'; then
    echo "[entrypoint] Refreshing analytics warehouse..."
    python -m app.analytics.etl
    echo "[entrypoint] Refreshing CLO achievement materialization..."
    python -m app.analytics.clo
elif [ "${RUN_ANALYTICS_REFRESH_ON_STARTUP:-$DEFAULT_STARTUP_DATA_JOBS}" = "false" ]; then
    echo "[entrypoint] Skipping analytics warehouse refresh"
else
    echo "[entrypoint] Skipping analytics warehouse refresh for non-PostgreSQL database"
fi

echo "[entrypoint] Starting EduInsight API on port ${PORT:-8000}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WORKERS:-1}"
