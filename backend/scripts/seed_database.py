"""Seed a clean local PostgreSQL database from reviewed SQL seed files.

The script is intentionally idempotent: it only runs when the academic dataset
is empty unless FORCE_SEED=true is provided.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

import asyncpg

try:
    from scripts.import_academic_dataset import DEFAULT_EXPECTED_STUDENTS, apply_artifact, load_artifact
except ModuleNotFoundError:  # Direct execution: python scripts/seed_database.py
    from import_academic_dataset import DEFAULT_EXPECTED_STUDENTS, apply_artifact, load_artifact

SEED_FILES = (
    "init-data.sql",
    "supplement-academic-catalog.sql",
    "seed-outcomes.sql",
)


def _postgres_dsn() -> str:
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is required for database seeding")
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


def _seed_dir() -> Path:
    return Path(os.getenv("SEED_SQL_DIR", "/app/db"))


def _truthy_env(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in {"1", "true", "yes", "on"}


async def main() -> None:
    """Apply reviewed SQL seed files when the academic dataset is empty."""
    seed_dir = _seed_dir()
    if not seed_dir.exists():
        print(f"[seed] Seed directory not found: {seed_dir}; skipping")
        return

    connection = await asyncpg.connect(_postgres_dsn())
    try:
        student_count = await connection.fetchval("SELECT COUNT(*) FROM public.students")
        force_seed = _truthy_env("FORCE_SEED")
        if student_count and not force_seed:
            print(f"[seed] Academic data already present ({student_count} students); skipping")
            return

        for filename in SEED_FILES:
            path = seed_dir / filename
            if not path.exists():
                print(f"[seed] Missing {path}; skipping")
                continue
            print(f"[seed] Applying {filename}...")
            await connection.execute(path.read_text(encoding="utf-8"))

        academic_artifact = seed_dir / "seed-academic-v2.json.gz"
        if academic_artifact.exists():
            expected_students = int(os.getenv("H46_EXPECTED_STUDENTS", DEFAULT_EXPECTED_STUDENTS))
            print(f"[seed] Applying {academic_artifact.name} with natural-key upserts...")
            await apply_artifact(
                connection,
                load_artifact(academic_artifact),
                expected_students=expected_students,
            )
        else:
            print(f"[seed] Missing {academic_artifact}; clean DB remains on the legacy SQL dataset")

        counts = await connection.fetchrow(
            """
            SELECT
                (SELECT COUNT(*) FROM public.departments) AS departments,
                (SELECT COUNT(*) FROM public.programs) AS programs,
                (SELECT COUNT(*) FROM public.courses) AS courses,
                (SELECT COUNT(*) FROM public.students) AS students,
                (SELECT COUNT(*) FROM public.enrollments) AS enrollments,
                (SELECT COUNT(*) FROM public.clos) AS clos
            """
        )
        print("[seed] Completed:", dict(counts))
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
