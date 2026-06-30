"""Audit CLO achievement coverage and lineage for Sprint 4 T55d."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from sqlalchemy import text

from app.analytics.clo import CLO_ACHIEVEMENT_LINEAGE, CLO_ACHIEVEMENT_SOURCE
from app.database import engine


async def audit_clo_achievement_lineage() -> dict[str, Any]:
    """Return deterministic coverage counts for synthetic CLO-from-grade rows."""
    async with engine.begin() as connection:
        summary = (
            await connection.execute(
                text(
                    """
                    WITH course_coverage AS (
                        SELECT
                            c.id,
                            c.code,
                            c.name,
                            COUNT(DISTINCT clo.id) AS clo_count,
                            COUNT(sca.id) AS achievement_rows
                        FROM public.courses c
                        LEFT JOIN public.clos clo ON clo.course_id = c.id
                        LEFT JOIN public.student_clo_achievements sca ON sca.clo_id = clo.id
                        WHERE c.is_active IS TRUE
                        GROUP BY c.id, c.code, c.name
                    )
                    SELECT
                        (SELECT COUNT(*) FROM public.student_clo_achievements)::INTEGER AS achievement_rows,
                        (SELECT COUNT(*) FROM public.courses WHERE is_active IS TRUE)::INTEGER AS active_courses,
                        COUNT(*) FILTER (WHERE clo_count = 0 OR achievement_rows = 0)::INTEGER AS courses_missing_evidence
                    FROM course_coverage
                    """
                )
            )
        ).mappings().one()
        missing_courses = [
            dict(row)
            for row in (
                await connection.execute(
                    text(
                        """
                        SELECT
                            c.id,
                            c.code,
                            c.name,
                            COUNT(DISTINCT clo.id)::INTEGER AS clo_count,
                            COUNT(sca.id)::INTEGER AS achievement_rows
                        FROM public.courses c
                        LEFT JOIN public.clos clo ON clo.course_id = c.id
                        LEFT JOIN public.student_clo_achievements sca ON sca.clo_id = clo.id
                        WHERE c.is_active IS TRUE
                        GROUP BY c.id, c.code, c.name
                        HAVING COUNT(DISTINCT clo.id) = 0 OR COUNT(sca.id) = 0
                        ORDER BY c.code
                        """
                    )
                )
            ).mappings().all()
        ]
        source_counts = {
            str(row["source"]): int(row["rows"])
            for row in (
                await connection.execute(
                    text(
                        """
                        SELECT source, COUNT(*)::INTEGER AS rows
                        FROM public.student_clo_achievements
                        GROUP BY source
                        ORDER BY source
                        """
                    )
                )
            ).mappings().all()
        }
    return {
        "source": CLO_ACHIEVEMENT_SOURCE,
        "lineage": CLO_ACHIEVEMENT_LINEAGE,
        "achievement_rows": int(summary["achievement_rows"]),
        "source_counts": source_counts,
        "active_courses": int(summary["active_courses"]),
        "courses_missing_evidence": int(summary["courses_missing_evidence"]),
        "missing_courses": missing_courses,
    }


async def _main() -> None:
    print(json.dumps(await audit_clo_achievement_lineage(), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(_main())
