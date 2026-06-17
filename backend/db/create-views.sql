-- Views extracted from schema.sql for re-creation

CREATE OR REPLACE VIEW vw_section_stats AS
SELECT
    s.id                                    AS section_id,
    s.course_id,
    s.teacher_id,
    s.semester_id,
    COUNT(e.id)                             AS enrollment_count,
    COUNT(e.id) FILTER (WHERE e.is_passed = TRUE)  AS pass_count,
    COUNT(e.id) FILTER (WHERE e.is_passed = FALSE) AS fail_count,
    ROUND(AVG(e.final_grade)::NUMERIC, 2)   AS gpa_avg_10,
    ROUND(
        COUNT(e.id) FILTER (WHERE e.is_passed = FALSE)::NUMERIC
        / NULLIF(COUNT(e.id), 0), 4
    )                                       AS fail_rate
FROM sections s
LEFT JOIN enrollments e ON e.section_id = s.id AND e.status = 'completed'
GROUP BY s.id, s.course_id, s.teacher_id, s.semester_id;

CREATE OR REPLACE VIEW vw_course_stats AS
SELECT
    pc.program_id,
    c.id                                    AS course_id,
    c.code,
    c.name,
    c.credits,
    sec.semester_id,
    COUNT(DISTINCT sec.id)                  AS section_count,
    COUNT(e.id)                             AS total_students,
    ROUND(AVG(e.final_grade)::NUMERIC, 2)   AS gpa_avg,
    ROUND(
        COUNT(e.id) FILTER (WHERE e.is_passed = FALSE)::NUMERIC 
        / NULLIF(COUNT(e.id), 0), 4
    )                                       AS fail_rate_avg
FROM program_courses pc
JOIN courses c ON pc.course_id = c.id
JOIN sections sec ON sec.course_id = c.id
JOIN enrollments e ON e.section_id = sec.id AND e.status = 'completed'
JOIN students s ON e.student_id = s.id AND s.program_id = pc.program_id
GROUP BY pc.program_id, c.id, c.code, c.name, c.credits, sec.semester_id;

CREATE OR REPLACE VIEW vw_program_stats AS
SELECT
    p.id                                    AS program_id,
    p.department_id,
    p.code,
    p.name,
    cs.semester_id,
    COUNT(DISTINCT cs.course_id)            AS course_count,
    SUM(cs.total_students)                  AS total_students,
    ROUND(SUM(cs.gpa_avg * cs.total_students) / NULLIF(SUM(cs.total_students), 0), 2) AS gpa_avg,
    ROUND(SUM(cs.fail_rate_avg * cs.total_students) / NULLIF(SUM(cs.total_students), 0), 4) AS fail_rate_avg
FROM programs p
JOIN vw_course_stats cs ON cs.program_id = p.id
GROUP BY p.id, p.department_id, p.code, p.name, cs.semester_id;

CREATE OR REPLACE VIEW vw_department_stats AS
SELECT
    d.id                                    AS department_id,
    d.university_id,
    d.code,
    d.name,
    ps.semester_id,
    COUNT(DISTINCT ps.program_id)           AS program_count,
    SUM(ps.total_students)                  AS total_students,
    ROUND(AVG(ps.gpa_avg)::NUMERIC, 2)     AS gpa_avg,
    ROUND(AVG(ps.fail_rate_avg)::NUMERIC, 4) AS fail_rate_avg
FROM departments d
JOIN vw_program_stats ps ON ps.department_id = d.id
GROUP BY d.id, d.university_id, d.code, d.name, ps.semester_id;
