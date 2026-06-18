import asyncio
import logging
from typing import Dict, Any, Optional
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from cachetools import TTLCache

logger = logging.getLogger(__name__)

# OBE Weights
WEIGHT_GPA = 0.3
WEIGHT_PASS_RATE = 0.3
WEIGHT_CLO = 0.4

# Simple In-memory cache for CLO calculations: max 1000 items, 1 hour TTL
_CLO_CACHE = TTLCache(maxsize=1000, ttl=3600)

async def _calculate_clo_attainment(db: AsyncSession, level: str, node_id: int) -> float:
    """
    Calculate CLO Attainment Rate (% of enrollments scoring >= 4.0 on average CLO).
    level: 'course', 'program', 'department'
    """
    cache_key = f"{level}_{node_id}"
    if cache_key in _CLO_CACHE:
        return _CLO_CACHE[cache_key]
        
    query = ""
    if level == "course":
        query = """
            WITH clo_scores AS (
                SELECT 
                    e.id AS enrollment_id,
                    cl.id AS clo_id,
                    SUM(gc.score * gccm.weight * gct.weight) / NULLIF(SUM(gccm.weight * gct.weight), 0) as score
                FROM enrollments e
                JOIN sections sec ON e.section_id = sec.id
                JOIN grade_components gc ON gc.enrollment_id = e.id
                JOIN grade_component_types gct ON gc.component_type_id = gct.id
                JOIN grade_component_clo_mappings gccm ON gct.id = gccm.component_type_id
                JOIN clos cl ON gccm.clo_id = cl.id
                WHERE sec.course_id = :node_id AND e.status = 'completed'
                GROUP BY e.id, cl.id
            ),
            passed_clos AS (
                SELECT enrollment_id, 
                       COUNT(clo_id) as total_clos,
                       SUM(CASE WHEN score >= 4.0 THEN 1 ELSE 0 END) as passed_clos
                FROM clo_scores
                GROUP BY enrollment_id
            )
            SELECT 
                SUM(passed_clos)::float / NULLIF(SUM(total_clos), 0) as attainment_rate
            FROM passed_clos;
        """
    elif level == "program":
        query = """
            WITH clo_scores AS (
                SELECT 
                    e.id AS enrollment_id,
                    cl.id AS clo_id,
                    SUM(gc.score * gccm.weight * gct.weight) / NULLIF(SUM(gccm.weight * gct.weight), 0) as score
                FROM enrollments e
                JOIN sections sec ON e.section_id = sec.id
                JOIN program_courses pc ON pc.course_id = sec.course_id
                JOIN grade_components gc ON gc.enrollment_id = e.id
                JOIN grade_component_types gct ON gc.component_type_id = gct.id
                JOIN grade_component_clo_mappings gccm ON gct.id = gccm.component_type_id
                JOIN clos cl ON gccm.clo_id = cl.id
                WHERE pc.program_id = :node_id AND e.status = 'completed'
                GROUP BY e.id, cl.id
            ),
            passed_clos AS (
                SELECT enrollment_id, 
                       COUNT(clo_id) as total_clos,
                       SUM(CASE WHEN score >= 4.0 THEN 1 ELSE 0 END) as passed_clos
                FROM clo_scores
                GROUP BY enrollment_id
            )
            SELECT 
                SUM(passed_clos)::float / NULLIF(SUM(total_clos), 0) as attainment_rate
            FROM passed_clos;
        """
    elif level == "department":
        query = """
            WITH clo_scores AS (
                SELECT 
                    e.id AS enrollment_id,
                    cl.id AS clo_id,
                    SUM(gc.score * gccm.weight * gct.weight) / NULLIF(SUM(gccm.weight * gct.weight), 0) as score
                FROM enrollments e
                JOIN sections sec ON e.section_id = sec.id
                JOIN program_courses pc ON pc.course_id = sec.course_id
                JOIN programs p ON p.id = pc.program_id
                JOIN grade_components gc ON gc.enrollment_id = e.id
                JOIN grade_component_types gct ON gc.component_type_id = gct.id
                JOIN grade_component_clo_mappings gccm ON gct.id = gccm.component_type_id
                JOIN clos cl ON gccm.clo_id = cl.id
                WHERE p.department_id = :node_id AND e.status = 'completed'
                GROUP BY e.id, cl.id
            ),
            passed_clos AS (
                SELECT enrollment_id, 
                       COUNT(clo_id) as total_clos,
                       SUM(CASE WHEN score >= 4.0 THEN 1 ELSE 0 END) as passed_clos
                FROM clo_scores
                GROUP BY enrollment_id
            )
            SELECT 
                SUM(passed_clos)::float / NULLIF(SUM(total_clos), 0) as attainment_rate
            FROM passed_clos;
        """
        
    result = await db.execute(text(query), {"node_id": node_id})
    row = result.fetchone()
    val = row[0] if row and row[0] is not None else 0.0
    
    _CLO_CACHE[cache_key] = val
    return val

def _compute_final(gpa_avg: Any, fail_rate: Any, clo_rate: float, node_type: str, node_id: int) -> dict:
    gpa_avg_flt = float(gpa_avg) if gpa_avg else 0.0
    fail_rate_flt = float(fail_rate) if fail_rate else 0.0
    clo_rate_flt = float(clo_rate) if clo_rate else 0.0

    gpa_score = (gpa_avg_flt / 10.0) * 100.0
    pass_rate = 1.0 - fail_rate_flt
    pass_score = pass_rate * 100.0
    clo_score = clo_rate_flt * 100.0
    
    health = (gpa_score * WEIGHT_GPA) + (pass_score * WEIGHT_PASS_RATE) + (clo_score * WEIGHT_CLO)
    health = round(health, 2)
    
    if health >= 70:
        status = "Healthy"
    elif health >= 50:
        status = "Warning"
    else:
        status = "Critical"
        
    return {
        "node_id": node_id,
        "node_type": node_type,
        "health_score": health,
        "status": status,
        "metrics": {
            "gpa_avg": round(gpa_avg_flt, 2),
            "fail_rate": round(fail_rate_flt, 4),
            "clo_attainment_rate": round(clo_rate_flt, 4)
        }
    }

async def get_course_health_score(db: AsyncSession, course_id: int) -> dict:
    # 1. Fetch GPA & Fail Rate
    query = """
        SELECT
            ROUND(SUM(gpa_avg * total_students) / NULLIF(SUM(total_students), 0), 2) AS gpa_avg,
            ROUND(SUM(fail_rate_avg * total_students) / NULLIF(SUM(total_students), 0), 4) AS fail_rate_avg
        FROM vw_course_stats
        WHERE course_id = :node_id
    """
    res = await db.execute(text(query), {"node_id": course_id})
    stats = res.fetchone()
    gpa_avg = stats[0] if stats else 0.0
    fail_rate = stats[1] if stats else 0.0
    
    # 2. Calculate CLO Attainment
    clo_rate = await _calculate_clo_attainment(db, "course", course_id)
    
    # 3. Compute final
    return _compute_final(gpa_avg, fail_rate, clo_rate, "course", course_id)

async def get_course_health_batch(db: AsyncSession, course_ids: list[int]) -> list[dict]:
    if not course_ids:
        query = """
            SELECT
                course_id,
                ROUND(SUM(gpa_avg * total_students) / NULLIF(SUM(total_students), 0), 2) AS gpa_avg,
                ROUND(SUM(fail_rate_avg * total_students) / NULLIF(SUM(total_students), 0), 4) AS fail_rate_avg
            FROM vw_course_stats
            GROUP BY course_id
        """
        res = await db.execute(text(query))
    else:
        query = """
            SELECT
                course_id,
                ROUND(SUM(gpa_avg * total_students) / NULLIF(SUM(total_students), 0), 2) AS gpa_avg,
                ROUND(SUM(fail_rate_avg * total_students) / NULLIF(SUM(total_students), 0), 4) AS fail_rate_avg
            FROM vw_course_stats
            WHERE course_id = ANY(:course_ids)
            GROUP BY course_id
        """
        res = await db.execute(text(query), {"course_ids": course_ids})
        
    rows = res.fetchall()
    
    async def _process(row):
        c_id, gpa_avg, fail_rate = row[0], row[1], row[2]
        clo_rate = await _calculate_clo_attainment(db, "course", c_id)
        return _compute_final(gpa_avg, fail_rate, clo_rate, "course", c_id)
        
    tasks = [_process(r) for r in rows]
    if tasks:
        return await asyncio.gather(*tasks)
    return []


async def get_program_health_score(db: AsyncSession, program_id: int) -> dict:
    query = """
        SELECT
            ROUND(SUM(gpa_avg * total_students) / NULLIF(SUM(total_students), 0), 2) AS gpa_avg,
            ROUND(SUM(fail_rate_avg * total_students) / NULLIF(SUM(total_students), 0), 4) AS fail_rate_avg
        FROM vw_program_stats
        WHERE program_id = :node_id
    """
    res = await db.execute(text(query), {"node_id": program_id})
    stats = res.fetchone()
    gpa_avg = stats[0] if stats else 0.0
    fail_rate = stats[1] if stats else 0.0
    
    clo_rate = await _calculate_clo_attainment(db, "program", program_id)
    return _compute_final(gpa_avg, fail_rate, clo_rate, "program", program_id)

async def get_department_health_score(db: AsyncSession, department_id: int) -> dict:
    query = """
        SELECT
            ROUND(SUM(gpa_avg * total_students) / NULLIF(SUM(total_students), 0), 2) AS gpa_avg,
            ROUND(SUM(fail_rate_avg * total_students) / NULLIF(SUM(total_students), 0), 4) AS fail_rate_avg
        FROM vw_department_stats
        WHERE department_id = :node_id
    """
    res = await db.execute(text(query), {"node_id": department_id})
    stats = res.fetchone()
    gpa_avg = stats[0] if stats else 0.0
    fail_rate = stats[1] if stats else 0.0
    
    clo_rate = await _calculate_clo_attainment(db, "department", department_id)
    return _compute_final(gpa_avg, fail_rate, clo_rate, "department", department_id)
