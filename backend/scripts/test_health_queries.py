import asyncio
from sqlalchemy import text
from app.database import engine

async def test_queries():
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT id FROM courses LIMIT 1"))
        course_id = res.scalar_one_or_none()
        print(f"Course ID: {course_id}")
        
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
        res = await conn.execute(text(query), {"node_id": course_id})
        att_rate = res.scalar_one_or_none()
        print(f"CLO Attainment Rate for course {course_id}: {att_rate}")

        # Check vw_course_stats
        vw_query = """
            SELECT gpa_avg, fail_rate_avg 
            FROM vw_course_stats 
            WHERE course_id = :node_id
            LIMIT 1
        """
        res = await conn.execute(text(vw_query), {"node_id": course_id})
        stats = res.fetchone()
        print(f"Stats from view: {stats}")

asyncio.run(test_queries())
