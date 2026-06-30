"""Backfill deterministic student emails for demo intervention campaigns."""

from __future__ import annotations

import asyncio
import os

import asyncpg


def _postgres_dsn() -> str:
    url = os.getenv("DATABASE_URL", "")
    if not url:
        raise RuntimeError("DATABASE_URL is required for student email seeding")
    return url.replace("postgresql+asyncpg://", "postgresql://", 1)


async def main() -> None:
    """Populate missing student emails while preserving manually-entered emails."""
    connection = await asyncpg.connect(_postgres_dsn())
    rows = await connection.fetch(
        """
        UPDATE public.students
        SET email = lower(student_code) || '@student.epu.edu.vn',
            updated_at = NOW()
        WHERE email IS NULL
        RETURNING id
        """
    )
    generic_count = len(rows)
    try:
        special_rows = await connection.fetch(
            """
            UPDATE public.students
            SET email = 'hungpham230204@gmail.com',
                updated_at = NOW()
            WHERE upper(full_name) = 'PHẠM TIẾN HƯNG'
            RETURNING id, student_code, full_name
            """
        )
        print(
            "[seed-email] Backfilled",
            int(generic_count or 0),
            "generic emails;",
            "special Phạm Tiến Hưng rows:",
            len(special_rows),
        )
    finally:
        await connection.close()


if __name__ == "__main__":
    asyncio.run(main())
