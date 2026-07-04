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

if [ "${IMPORT_V59_STUDENTS:-true}" != "false" ]; then
    echo "[entrypoint] Ensuring V59 student coverage is present..."
    python scripts/import_v59_students.py \
        --source "/app/db/v59-synthetic-students.json" \
        --source "/app/db/v59-empty-program-students.json" \
        --skip-if-complete
fi

echo "[entrypoint] Backfilling student emails..."
python scripts/seed_student_emails.py

if [ -n "${DATABASE_URL:-}" ] && printf '%s' "$DATABASE_URL" | grep -qi 'postgresql'; then
    echo "[entrypoint] Refreshing analytics warehouse..."
    python -m app.analytics.etl
    echo "[entrypoint] Refreshing CLO achievement materialization..."
    python -m app.analytics.clo
else
    echo "[entrypoint] Skipping analytics warehouse refresh for non-PostgreSQL database"
fi

echo "[entrypoint] Starting EduInsight API on port ${PORT:-8000}..."
exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port "${PORT:-8000}" \
    --workers "${WORKERS:-1}"
