"""Outcome metric engine for materialized student CLO achievement rows."""

from __future__ import annotations

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncConnection, AsyncSession

from app.database import engine

UPSERT_STUDENT_CLO_ACHIEVEMENTS = text(
    """
    INSERT INTO public.student_clo_achievements (enrollment_id, clo_id, achievement_score, is_achieved)
    SELECT
        e.id AS enrollment_id,
        gccm.clo_id,
        ROUND(
            SUM(gc.score * gccm.weight * gct.weight) / NULLIF(SUM(gccm.weight * gct.weight), 0),
            2
        ) AS achievement_score,
        (
            SUM(gc.score * gccm.weight * gct.weight) / NULLIF(SUM(gccm.weight * gct.weight), 0)
        ) >= :threshold AS is_achieved
    FROM public.enrollments e
    JOIN public.grade_components gc ON gc.enrollment_id = e.id
    JOIN public.grade_component_types gct ON gct.id = gc.component_type_id
    JOIN public.grade_component_clo_mappings gccm ON gccm.component_type_id = gct.id
    WHERE gc.score IS NOT NULL
    GROUP BY e.id, gccm.clo_id
    ON CONFLICT (enrollment_id, clo_id) DO UPDATE SET
        achievement_score = EXCLUDED.achievement_score,
        is_achieved = EXCLUDED.is_achieved
    """
)

DELETE_STALE_STUDENT_CLO_ACHIEVEMENTS = text(
    """
    DELETE FROM public.student_clo_achievements sca
    WHERE NOT EXISTS (
        SELECT 1
        FROM public.enrollments e
        JOIN public.grade_components gc ON gc.enrollment_id = e.id
        JOIN public.grade_component_types gct ON gct.id = gc.component_type_id
        JOIN public.grade_component_clo_mappings gccm ON gccm.component_type_id = gct.id
        WHERE e.id = sca.enrollment_id
          AND gccm.clo_id = sca.clo_id
          AND gc.score IS NOT NULL
    )
    """
)


async def refresh_student_clo_achievements(executor: AsyncConnection | AsyncSession, threshold: float = 4.0) -> int:
    """Recompute student-level CLO achievement rows from grade components.

    Returns the materialized row count after the refresh. The operation is
    idempotent and removes stale rows whose source components/mappings vanished.
    """
    await executor.execute(UPSERT_STUDENT_CLO_ACHIEVEMENTS, {"threshold": threshold})
    await executor.execute(DELETE_STALE_STUDENT_CLO_ACHIEVEMENTS)
    result = await executor.execute(text("SELECT COUNT(*) FROM public.student_clo_achievements"))
    return int(result.scalar_one())


async def _main() -> None:
    async with engine.begin() as connection:
        rows = await refresh_student_clo_achievements(connection)
    print(f"Refreshed {rows} student CLO achievement rows")


if __name__ == "__main__":
    asyncio.run(_main())
