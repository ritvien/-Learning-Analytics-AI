-- Idempotent seed for outcome analytics.
-- This derives demo-ready PLO/CLO/mapping data from the currently loaded academic
-- and grade data, so report/dashboard flows have meaningful outcome coverage.

BEGIN;

INSERT INTO plos (program_id, code, name, description, bloom_level, sort_order, is_active)
SELECT
    p.id,
    v.code,
    v.name,
    v.description,
    v.bloom_level,
    v.sort_order,
    TRUE
FROM programs p
CROSS JOIN (
    VALUES
        ('PLO1', 'Foundational knowledge', 'Apply foundational knowledge and core concepts of the program.', 2, 1),
        ('PLO2', 'Professional practice', 'Use discipline-specific methods, tools, and standards in practical work.', 3, 2),
        ('PLO3', 'Problem solving', 'Analyze requirements, solve problems, and evaluate solution quality.', 4, 3),
        ('PLO4', 'Communication and teamwork', 'Communicate clearly and collaborate effectively in academic or professional contexts.', 3, 4),
        ('PLO5', 'Ethics and lifelong learning', 'Demonstrate professional ethics, responsibility, and continuous learning.', 3, 5)
) AS v(code, name, description, bloom_level, sort_order)
ON CONFLICT (program_id, code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    bloom_level = EXCLUDED.bloom_level,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

INSERT INTO clos (course_id, code, name, description, bloom_level, weight, sort_order, is_active)
SELECT
    c.id,
    v.code,
    v.name_prefix || c.name,
    v.description_prefix || c.name || '.',
    v.bloom_level,
    v.weight,
    v.sort_order,
    TRUE
FROM courses c
CROSS JOIN (
    VALUES
        ('CLO1', 'Understand ', 'Understand the core concepts and terminology of ', 2, 1.00, 1),
        ('CLO2', 'Apply ', 'Apply methods, procedures, and tools learned in ', 3, 1.00, 2),
        ('CLO3', 'Evaluate ', 'Analyze outcomes, evaluate alternatives, and communicate findings for ', 4, 1.00, 3)
) AS v(code, name_prefix, description_prefix, bloom_level, weight, sort_order)
ON CONFLICT (course_id, code) DO UPDATE
SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    bloom_level = EXCLUDED.bloom_level,
    weight = EXCLUDED.weight,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

INSERT INTO course_plos (course_id, plo_id, level)
SELECT DISTINCT
    pc.course_id,
    p.id AS plo_id,
    CASE
        WHEN p.sort_order IN (1, 2) THEN 3
        WHEN p.sort_order = 3 THEN 2
        ELSE 1
    END::SMALLINT AS level
FROM program_courses pc
JOIN plos p ON p.program_id = pc.program_id
ON CONFLICT (course_id, plo_id) DO UPDATE
SET level = EXCLUDED.level;

INSERT INTO clo_plo_mappings (clo_id, plo_id, contribution)
SELECT DISTINCT
    cl.id AS clo_id,
    p.id AS plo_id,
    CASE
        WHEN cl.sort_order = 1 AND p.sort_order IN (1, 5) THEN 2
        WHEN cl.sort_order = 2 AND p.sort_order IN (2, 4) THEN 3
        WHEN cl.sort_order = 3 AND p.sort_order IN (3, 4) THEN 3
        ELSE 1
    END::SMALLINT AS contribution
FROM clos cl
JOIN program_courses pc ON pc.course_id = cl.course_id
JOIN plos p
    ON p.program_id = pc.program_id
    AND (
        (cl.sort_order = 1 AND p.sort_order IN (1, 5))
        OR (cl.sort_order = 2 AND p.sort_order IN (2, 4))
        OR (cl.sort_order = 3 AND p.sort_order IN (3, 4))
    )
ON CONFLICT (clo_id, plo_id) DO UPDATE
SET contribution = EXCLUDED.contribution;

WITH ranked_clos AS (
    SELECT
        cl.id,
        cl.course_id,
        ROW_NUMBER() OVER (PARTITION BY cl.course_id ORDER BY cl.sort_order, cl.id) - 1 AS clo_index,
        COUNT(*) OVER (PARTITION BY cl.course_id) AS clo_count
    FROM clos cl
    WHERE cl.is_active = TRUE
)
INSERT INTO grade_component_clo_mappings (component_type_id, clo_id, weight)
SELECT
    gct.id AS component_type_id,
    rc.id AS clo_id,
    1.00 AS weight
FROM grade_component_types gct
JOIN sections s ON s.id = gct.section_id
JOIN ranked_clos rc
    ON rc.course_id = s.course_id
    AND rc.clo_index = MOD(GREATEST(gct.sort_order, 0), rc.clo_count)
ON CONFLICT (component_type_id, clo_id) DO UPDATE
SET weight = EXCLUDED.weight;

WITH scored AS (
    SELECT
        e.id AS enrollment_id,
        gccm.clo_id,
        SUM(
            CASE
                WHEN gc.score IS NULL THEN NULL
                WHEN gc.max_score <= 0 THEN NULL
                ELSE (gc.score / gc.max_score) * 100.0 * gccm.weight * gct.weight
            END
        ) / NULLIF(
            SUM(
                CASE
                    WHEN gc.score IS NULL THEN NULL
                    WHEN gc.max_score <= 0 THEN NULL
                    ELSE gccm.weight * gct.weight
                END
            ),
            0
        ) AS achievement_score
    FROM enrollments e
    JOIN grade_components gc ON gc.enrollment_id = e.id
    JOIN grade_component_types gct ON gct.id = gc.component_type_id
    JOIN grade_component_clo_mappings gccm ON gccm.component_type_id = gct.id
    GROUP BY e.id, gccm.clo_id
)
INSERT INTO student_clo_achievements (enrollment_id, clo_id, achievement_score, is_achieved)
SELECT
    enrollment_id,
    clo_id,
    ROUND(achievement_score, 2),
    achievement_score >= 50.0
FROM scored
WHERE achievement_score IS NOT NULL
ON CONFLICT (enrollment_id, clo_id) DO UPDATE
SET
    achievement_score = EXCLUDED.achievement_score,
    is_achieved = EXCLUDED.is_achieved;

COMMIT;
