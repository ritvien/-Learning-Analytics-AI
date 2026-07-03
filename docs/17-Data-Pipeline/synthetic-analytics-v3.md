# Synthetic Analytics v3

Deterministic demo/staging data used to bring every sparse program to at least 30 active students with analytics evidence. This pipeline does not generate ML probabilities and is blocked when `APP_ENV=production` or `APP_ENV=test`.

## Pipeline

```powershell
cd backend

# 1. Read-only coverage/catalog snapshot
python scripts/audit_synthetic_analytics_v3.py --output db/synthetic-v3-catalog.json

# 2. Pure deterministic generation; no database writes
python scripts/generate_synthetic_analytics_v3.py `
  --catalog db/synthetic-v3-catalog.json `
  --output db/synthetic-analytics-v3.json `
  --seed 20260702

# 3. Apply the new migration, then idempotently import in demo/staging
alembic upgrade head
$env:APP_ENV="demo"
python scripts/import_synthetic_analytics_v3.py --source db/synthetic-analytics-v3.json

# 4. Derive analytics and predictions from imported academic evidence
python -m app.analytics.etl
python -m app.analytics.clo
python scripts/audit_clo_achievement_lineage.py
# Run the approved dropout/course-risk scoring commands for the deployed model run.
```

The artifact contains synthetic students, section natural keys, enrollments, deterministic grades and grade components. Every imported entity is registered in `synthetic_data_lineage` with source `synthetic_analytics_v3`, seed, derivation and `official=false`.

## Validation

- Every program below 30 active students with enrollments is filled to 30.
- Generation requires at least five courses, four semesters, a cohort and an in-department teacher.
- Each synthetic student receives 4–6 semesters and 5–8 courses per semester.
- Missing final grades are deterministic at approximately 4%; no prediction is synthesized.
- Re-running the same artifact upserts by academic natural keys and does not duplicate rows.

## Rollback

```powershell
$env:APP_ENV="demo"
python scripts/import_synthetic_analytics_v3.py --rollback
python -m app.analytics.etl
```

Rollback deletes only entities registered under `synthetic_analytics_v3`, in dependency order. It never deletes real data or edits an applied migration.

## Boundaries

- CTĐT RAG upload/OCR/embedding/ingest is owned by another workstream and is not touched here.
- CLO achievement generated from synthetic grades remains unofficial and must keep its source warning.
- Production rejects the importer even when an artifact is supplied.
