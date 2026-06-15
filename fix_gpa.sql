UPDATE enrollments
SET grade_4 = CASE
    WHEN grade_letter IN ('A+', 'A') THEN 4.0
    WHEN grade_letter = 'B+' THEN 3.5
    WHEN grade_letter = 'B' THEN 3.0
    WHEN grade_letter = 'C+' THEN 2.5
    WHEN grade_letter = 'C' THEN 2.0
    WHEN grade_letter = 'D+' THEN 1.5
    WHEN grade_letter = 'D' THEN 1.0
    WHEN grade_letter = 'F' THEN 0.0
    ELSE NULL
END;

UPDATE students s
SET gpa_cumulative = (
    SELECT ROUND((SUM(e.grade_4 * c.credits) / SUM(c.credits))::numeric, 2)
    FROM enrollments e
    JOIN sections sec ON e.section_id = sec.id
    JOIN courses c ON sec.course_id = c.id
    WHERE e.student_id = s.id AND e.grade_4 IS NOT NULL AND c.credits > 0
);
