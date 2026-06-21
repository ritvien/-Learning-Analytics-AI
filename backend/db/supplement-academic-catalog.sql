-- Supplemental EPU academic catalog.
-- Safe to run repeatedly: existing catalog rows are updated by code and new rows are inserted.

BEGIN;

INSERT INTO departments (university_id, code, name, is_active)
VALUES
    (1, 'DEPT09', 'Khoa Kế toán - Tài chính', TRUE),
    (1, 'DEPT10', 'Khoa Quản trị Kinh doanh và Du lịch', TRUE),
    (1, 'DEPT13', 'Khoa Năng lượng mới', TRUE),
    (1, 'DEPT14', 'Khoa Xây dựng', TRUE)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

WITH catalog(department_code, code, name, duration_years) AS (
    VALUES
        ('DEPT12', '7510301', 'Công nghệ kỹ thuật điện, điện tử', 5),
        ('DEPT13', '7510403', 'Công nghệ kỹ thuật năng lượng', 5),
        ('DEPT13', '7520115', 'Kỹ thuật nhiệt', 5),
        ('DEPT11', '7510601', 'Quản lý công nghiệp', 4),
        ('DEPT11', '7510602', 'Quản lý năng lượng', 4),
        ('DEPT08', '7510303', 'Công nghệ kỹ thuật điều khiển và tự động hoá', 5),
        ('DEPT07', '7510302', 'Công nghệ kỹ thuật điện tử - viễn thông', 5),
        ('DEPT05', '7480201', 'Công nghệ thông tin', 5),
        ('DEPT13', '7510406', 'Công nghệ kỹ thuật môi trường', 5),
        ('DEPT01', '7510201', 'Công nghệ kỹ thuật cơ khí', 5),
        ('DEPT01', '7510203', 'Công nghệ kỹ thuật cơ điện tử', 5),
        ('DEPT14', '7510102', 'Công nghệ kỹ thuật công trình xây dựng', 5),
        ('DEPT10', '7340101', 'Quản trị kinh doanh', 4),
        ('DEPT09', '7340201', 'Tài chính - Ngân hàng', 4),
        ('DEPT09', '7340301', 'Kế toán', 4),
        ('DEPT09', '7340302', 'Kiểm toán', 4),
        ('DEPT10', '7340122', 'Thương mại điện tử', 4),
        ('DEPT10', '7810103', 'Quản trị dịch vụ du lịch và lữ hành', 4),
        ('DEPT08', '7520107', 'Kỹ thuật Robot', 5),
        ('DEPT05', '7460108', 'Khoa học dữ liệu', 5),
        ('DEPT07', '7480106', 'Kỹ thuật máy tính', 5),
        ('DEPT01', '7510205', 'Công nghệ kỹ thuật ô tô', 5),
        ('DEPT10', '7810201', 'Quản trị khách sạn', 4),
        ('DEPT10', '7340115', 'Marketing', 4),
        ('DEPT09', '7340205', 'Công nghệ tài chính', 4),
        ('DEPT08', '7480107', 'Trí tuệ nhân tạo', 5),
        ('DEPT02', '7460117', 'Toán tin', 5),
        ('DEPT10', '7380107', 'Luật kinh tế', 4),
        ('DEPT03', '7220201', 'Ngôn ngữ Anh', 4),
        ('DEPT13', '7510402', 'Công nghệ vật liệu', 5),
        ('DEPT13', '7510407', 'Công nghệ kỹ thuật hạt nhân', 5),
        ('DEPT10', '7340120', 'Kinh doanh quốc tế', 4),
        ('DEPT05', '7480102', 'Mạng máy tính và truyền thông dữ liệu', 5),
        ('DEPT11', '7520117', 'Kỹ thuật công nghiệp', 5),
        ('DEPT12', '7520118', 'Kỹ thuật hệ thống công nghiệp', 5),
        ('DEPT13', '7520401', 'Vật lý kỹ thuật', 5),
        ('DEPT11', '7510605', 'Logistics và quản lý chuỗi cung ứng', 4)
),
resolved AS (
    SELECT d.id AS department_id, c.code, c.name, c.duration_years
    FROM catalog c
    JOIN departments d ON d.university_id = 1 AND d.code = c.department_code
),
updated_by_name AS (
    UPDATE programs p
    SET department_id = r.department_id,
        code = r.code,
        name = r.name,
        duration_years = r.duration_years,
        is_active = TRUE,
        updated_at = NOW()
    FROM resolved r
    WHERE lower(p.name) = lower(r.name)
       OR (p.name = 'Tài chính – Ngân hàng' AND r.code = '7340201')
    RETURNING r.code
)
INSERT INTO programs (department_id, code, name, duration_years, is_active)
SELECT r.department_id, r.code, r.name, r.duration_years, TRUE
FROM resolved r
WHERE NOT EXISTS (SELECT 1 FROM updated_by_name u WHERE u.code = r.code)
  AND NOT EXISTS (
      SELECT 1 FROM programs p
      WHERE p.department_id = r.department_id AND p.code = r.code
  )
ON CONFLICT (department_id, code) DO UPDATE SET
    name = EXCLUDED.name,
    duration_years = EXCLUDED.duration_years,
    is_active = EXCLUDED.is_active,
    updated_at = NOW();

SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments));
SELECT setval('programs_id_seq', (SELECT MAX(id) FROM programs));

COMMIT;
