-- =============================================================================
-- EduInsight — PostgreSQL Schema v1.0
-- Hệ thống AI Phân tích Học tập (Student Analytics for Faculty Management)
-- =============================================================================
-- Phiên bản: 1.0
-- Ngày tạo:  09/06/2026
-- Tham chiếu: docs/02-PRD/PRD.md — Section 2.3 Data Model
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- full-text search on Vietnamese names

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
CREATE TYPE user_role     AS ENUM ('superadmin', 'admin', 'manager', 'lecturer', 'viewer');
CREATE TYPE node_type     AS ENUM ('university', 'department', 'program', 'course');
CREATE TYPE health_status AS ENUM ('green', 'yellow', 'red');
CREATE TYPE alert_level   AS ENUM ('info', 'warning', 'critical');
CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE grade_system  AS ENUM ('scale_10', 'scale_4', 'letter');

-- =============================================================================
-- BLOCK 1: ACADEMIC HIERARCHY
-- =============================================================================

CREATE TABLE universities (
    id          SERIAL          PRIMARY KEY,
    code        VARCHAR(20)     NOT NULL UNIQUE,
    name        VARCHAR(255)    NOT NULL,
    name_short  VARCHAR(50),
    website     VARCHAR(255),
    address     TEXT,
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE universities IS 'Root node of Academic Tree. Supports multi-university for future scale.';

-- ---------------------------------------------------------------------------

CREATE TABLE departments (
    id              SERIAL          PRIMARY KEY,
    university_id   INT             NOT NULL REFERENCES universities(id) ON DELETE RESTRICT,
    code            VARCHAR(20)     NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    name_en         VARCHAR(255),
    description     TEXT,
    head_name       VARCHAR(255),
    email           VARCHAR(255),
    phone           VARCHAR(30),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (university_id, code)
);
COMMENT ON TABLE departments IS 'Khoa — second level of Academic Tree.';
CREATE INDEX idx_departments_university ON departments(university_id);

-- ---------------------------------------------------------------------------

CREATE TABLE programs (
    id              SERIAL          PRIMARY KEY,
    department_id   INT             NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    code            VARCHAR(30)     NOT NULL,
    name            VARCHAR(255)    NOT NULL,
    name_en         VARCHAR(255),
    description     TEXT,
    duration_years  SMALLINT        NOT NULL DEFAULT 4,
    total_credits   SMALLINT,
    accreditation   VARCHAR(50),    -- e.g. 'ABET', 'AUN', 'MOET'
    version         VARCHAR(20),    -- e.g. '2022', '2024'
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (department_id, code)
);
COMMENT ON TABLE programs IS 'Ngành/Chương trình đào tạo — third level of Academic Tree.';
CREATE INDEX idx_programs_department ON programs(department_id);

-- ---------------------------------------------------------------------------

CREATE TABLE semesters (
    id          SERIAL          PRIMARY KEY,
    code        VARCHAR(20)     NOT NULL UNIQUE, -- e.g. '2024-1', '2024-2', '2024-3'
    name        VARCHAR(100)    NOT NULL,         -- e.g. 'HK1 năm học 2024–2025'
    year        SMALLINT        NOT NULL,
    term        SMALLINT        NOT NULL CHECK (term BETWEEN 1 AND 10),
    start_date  DATE,
    end_date    DATE,
    is_current  BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE semesters IS 'Học kỳ — used as FK for sections and snapshots.';

-- ---------------------------------------------------------------------------

CREATE TABLE courses (
    id              SERIAL          PRIMARY KEY,
    code            VARCHAR(30)     NOT NULL UNIQUE,
    name            VARCHAR(255)    NOT NULL,
    name_en         VARCHAR(255),
    credits         SMALLINT        NOT NULL CHECK (credits >= 0),
    theory_hours    SMALLINT,
    lab_hours       SMALLINT,
    prerequisite_note TEXT,                       -- free-text until course_prerequisites
    description     TEXT,
    is_elective     BOOLEAN         NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE courses IS 'Môn học — fourth level of Academic Tree.';
CREATE INDEX idx_courses_name_trgm ON courses USING gin(name gin_trgm_ops);

-- ---------------------------------------------------------------------------

CREATE TABLE program_courses (
    program_id      INT             NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    course_id       INT             NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    PRIMARY KEY (program_id, course_id)
);
COMMENT ON TABLE program_courses IS 'Mapping between programs and courses to handle shared courses.';

-- ---------------------------------------------------------------------------

CREATE TABLE course_prerequisites (
    course_id       INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    prerequisite_id INT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, prerequisite_id),
    CHECK (course_id <> prerequisite_id)
);
COMMENT ON TABLE course_prerequisites IS 'Môn tiên quyết — used for bottleneck detection in Metric Engine.';

-- =============================================================================
-- BLOCK 2: PEOPLE
-- =============================================================================

CREATE TABLE users (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    email           VARCHAR(255)    NOT NULL UNIQUE,
    hashed_password VARCHAR(255)    NOT NULL,
    full_name       VARCHAR(255)    NOT NULL,
    role            user_role       NOT NULL DEFAULT 'viewer',
    department_id   INT             REFERENCES departments(id) ON DELETE SET NULL,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE users IS 'Auth users. Role controls view/edit access across the system.';
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_department ON users(department_id);

-- ---------------------------------------------------------------------------

CREATE TABLE teachers (
    id              SERIAL          PRIMARY KEY,
    user_id         UUID            REFERENCES users(id) ON DELETE SET NULL,
    department_id   INT             NOT NULL REFERENCES departments(id) ON DELETE RESTRICT,
    code            VARCHAR(20)     UNIQUE,
    full_name       VARCHAR(255)    NOT NULL,
    email           VARCHAR(255)    UNIQUE,
    phone           VARCHAR(30),
    academic_title  VARCHAR(50),    -- e.g. 'GS', 'PGS', 'TS', 'ThS'
    specialization  VARCHAR(255),
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE teachers IS 'Giảng viên — linked to user account and department.';
CREATE INDEX idx_teachers_department ON teachers(department_id);
CREATE INDEX idx_teachers_name_trgm ON teachers USING gin(full_name gin_trgm_ops);

-- ---------------------------------------------------------------------------

CREATE TABLE cohorts (
    id          SERIAL          PRIMARY KEY,
    code        VARCHAR(10)     NOT NULL UNIQUE, -- e.g. 'K17', 'K18', 'K19'
    year_start  SMALLINT        NOT NULL,
    year_end    SMALLINT,
    note        TEXT,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE cohorts IS 'Khóa học — K17, K18... Used to group students and compute cross-cohort comparisons.';

-- ---------------------------------------------------------------------------

CREATE TABLE students (
    id              SERIAL          PRIMARY KEY,
    program_id      INT             NOT NULL REFERENCES programs(id) ON DELETE RESTRICT,
    cohort_id       INT             NOT NULL REFERENCES cohorts(id) ON DELETE RESTRICT,
    student_code    VARCHAR(20)     NOT NULL UNIQUE,
    full_name       VARCHAR(255)    NOT NULL,
    date_of_birth   DATE,
    gender          VARCHAR(10),
    email           VARCHAR(255),
    phone           VARCHAR(30),
    class_code      VARCHAR(30),    -- lớp hành chính
    status          VARCHAR(20)     NOT NULL DEFAULT 'active', -- active, graduated, dropped, transferred
    gpa_cumulative  NUMERIC(4,2),   -- cached, updated by metric engine
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE students IS 'Sinh viên — linked to program and cohort.';
CREATE INDEX idx_students_program ON students(program_id);
CREATE INDEX idx_students_cohort ON students(cohort_id);
CREATE INDEX idx_students_code ON students(student_code);
CREATE INDEX idx_students_name_trgm ON students USING gin(full_name gin_trgm_ops);

-- =============================================================================
-- BLOCK 3: TEACHING — SECTIONS, ENROLLMENTS, GRADES
-- =============================================================================

CREATE TABLE sections (
    id              SERIAL          PRIMARY KEY,
    course_id       INT             NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
    teacher_id      INT             REFERENCES teachers(id) ON DELETE SET NULL,
    semester_id     INT             NOT NULL REFERENCES semesters(id) ON DELETE RESTRICT,
    section_code    VARCHAR(50)     NOT NULL,    -- e.g. 'L01', 'L02'
    room            VARCHAR(50),
    schedule        VARCHAR(255),               -- e.g. 'T2-4 (7:00-9:30)'
    max_students    SMALLINT,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, semester_id, section_code)
);
COMMENT ON TABLE sections IS 'Lớp học phần — one course offered in one semester by one teacher.';
CREATE INDEX idx_sections_course ON sections(course_id);
CREATE INDEX idx_sections_teacher ON sections(teacher_id);
CREATE INDEX idx_sections_semester ON sections(semester_id);

-- ---------------------------------------------------------------------------

CREATE TABLE enrollments (
    id              SERIAL          PRIMARY KEY,
    student_id      INT             NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
    section_id      INT             NOT NULL REFERENCES sections(id) ON DELETE RESTRICT,
    final_grade     NUMERIC(4,2)    CHECK (final_grade >= 0 AND final_grade <= 10),
    grade_letter    VARCHAR(5),                 -- A+, A, B+, B, C+, C, D+, D, F
    grade_4         NUMERIC(3,2),               -- GPA scale 4.0
    is_passed       BOOLEAN,                    -- computed: final_grade >= 5.0
    attempt_number  SMALLINT        NOT NULL DEFAULT 1, -- 1=lần đầu, 2=thi lại, 3=học lại
    status          VARCHAR(20)     NOT NULL DEFAULT 'enrolled', -- enrolled, completed, withdrawn
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (student_id, section_id, attempt_number)
);
COMMENT ON TABLE enrollments IS 'Đăng ký học phần + kết quả điểm tổng kết.';
CREATE INDEX idx_enrollments_student ON enrollments(student_id);
CREATE INDEX idx_enrollments_section ON enrollments(section_id);
CREATE INDEX idx_enrollments_passed ON enrollments(is_passed);

-- ---------------------------------------------------------------------------

CREATE TABLE grade_component_types (
    id          SERIAL          PRIMARY KEY,
    section_id  INT             NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
    name        VARCHAR(100)    NOT NULL,    -- e.g. 'Quiz 1', 'Midterm', 'Final Exam', 'Lab 1'
    weight      NUMERIC(5,2)    NOT NULL CHECK (weight > 0 AND weight <= 100),
    max_score   NUMERIC(5,2)    NOT NULL DEFAULT 10,
    is_required BOOLEAN         NOT NULL DEFAULT TRUE,
    sort_order  SMALLINT        NOT NULL DEFAULT 0
);
COMMENT ON TABLE grade_component_types IS 'Định nghĩa cấu trúc điểm thành phần của từng lớp học phần.';
CREATE INDEX idx_gct_section ON grade_component_types(section_id);

-- ---------------------------------------------------------------------------

CREATE TABLE grade_components (
    id                      SERIAL          PRIMARY KEY,
    enrollment_id           INT             NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    component_type_id       INT             NOT NULL REFERENCES grade_component_types(id) ON DELETE CASCADE,
    score                   NUMERIC(5,2)    CHECK (score >= 0),
    max_score               NUMERIC(5,2)    NOT NULL DEFAULT 10,
    is_absent               BOOLEAN         NOT NULL DEFAULT FALSE,
    notes                   TEXT,
    created_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (enrollment_id, component_type_id)
);
COMMENT ON TABLE grade_components IS 'Điểm thành phần từng sinh viên. Linked to CLO via grade_component_clo_mappings.';
CREATE INDEX idx_grade_components_enrollment ON grade_components(enrollment_id);
CREATE INDEX idx_grade_components_type ON grade_components(component_type_id);

-- =============================================================================
-- BLOCK 4: CLO / PLO ASSESSMENT
-- =============================================================================

CREATE TABLE plos (
    id          SERIAL          PRIMARY KEY,
    program_id  INT             NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    code        VARCHAR(20)     NOT NULL,    -- e.g. 'PLO-a', 'PLO-b'
    name        VARCHAR(255)    NOT NULL,
    description TEXT,
    bloom_level SMALLINT        CHECK (bloom_level BETWEEN 1 AND 6), -- Bloom's taxonomy
    sort_order  SMALLINT        NOT NULL DEFAULT 0,
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (program_id, code)
);
COMMENT ON TABLE plos IS 'Program Learning Outcomes (CĐR chương trình) — theo chuẩn ABET/AUN.';
CREATE INDEX idx_plos_program ON plos(program_id);

-- ---------------------------------------------------------------------------

CREATE TABLE clos (
    id          SERIAL          PRIMARY KEY,
    course_id   INT             NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    code        VARCHAR(20)     NOT NULL,    -- e.g. 'CLO1', 'CLO2'
    name        VARCHAR(255)    NOT NULL,
    description TEXT,
    bloom_level SMALLINT        CHECK (bloom_level BETWEEN 1 AND 6),
    weight      NUMERIC(5,2)    NOT NULL DEFAULT 1.0, -- relative weight in CLO aggregation
    sort_order  SMALLINT        NOT NULL DEFAULT 0,
    is_active   BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, code)
);
COMMENT ON TABLE clos IS 'Course Learning Outcomes (CĐR môn học).';
CREATE INDEX idx_clos_course ON clos(course_id);

-- ---------------------------------------------------------------------------

CREATE TABLE clo_plo_mappings (
    clo_id          INT             NOT NULL REFERENCES clos(id) ON DELETE CASCADE,
    plo_id          INT             NOT NULL REFERENCES plos(id) ON DELETE CASCADE,
    contribution    SMALLINT        NOT NULL DEFAULT 1 CHECK (contribution BETWEEN 1 AND 3),
    -- 1=I (Introduced), 2=D (Developed), 3=A (Assessed) — ABET standard
    PRIMARY KEY (clo_id, plo_id)
);
COMMENT ON TABLE clo_plo_mappings IS 'Ma trận CLO ↔ PLO. contribution: 1=Introduced, 2=Developed, 3=Assessed.';

-- ---------------------------------------------------------------------------

CREATE TABLE course_plos (
    course_id       INT             NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    plo_id          INT             NOT NULL REFERENCES plos(id) ON DELETE CASCADE,
    level           SMALLINT        NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 3),
    PRIMARY KEY (course_id, plo_id)
);
COMMENT ON TABLE course_plos IS 'Ma trận Course ↔ PLO. level: 1=Thấp, 2=Trung bình, 3=Cao.';

-- ---------------------------------------------------------------------------

CREATE TABLE grade_component_clo_mappings (
    component_type_id   INT             NOT NULL REFERENCES grade_component_types(id) ON DELETE CASCADE,
    clo_id              INT             NOT NULL REFERENCES clos(id) ON DELETE CASCADE,
    weight              NUMERIC(5,2)    NOT NULL DEFAULT 1.0,
    PRIMARY KEY (component_type_id, clo_id)
);
COMMENT ON TABLE grade_component_clo_mappings IS 'Mapping: bài kiểm tra/thi → CLO đánh giá.';

-- ---------------------------------------------------------------------------

CREATE TABLE student_clo_achievements (
    id                  SERIAL          PRIMARY KEY,
    enrollment_id       INT             NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
    clo_id              INT             NOT NULL REFERENCES clos(id) ON DELETE CASCADE,
    achievement_score   NUMERIC(5,2),           -- 0–100%
    is_achieved         BOOLEAN,                -- true if >= threshold
    computed_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    UNIQUE (enrollment_id, clo_id)
);
COMMENT ON TABLE student_clo_achievements IS 'Mức đạt CLO từng sinh viên — computed by Metric Engine.';
CREATE INDEX idx_clo_achievements_enrollment ON student_clo_achievements(enrollment_id);
CREATE INDEX idx_clo_achievements_clo ON student_clo_achievements(clo_id);

-- =============================================================================
-- BLOCK 5: SYLLABUS
-- =============================================================================

CREATE TABLE syllabi (
    id              SERIAL          PRIMARY KEY,
    course_id       INT             NOT NULL REFERENCES courses(id) ON DELETE CASCADE UNIQUE,
    version         VARCHAR(20),
    raw_text        TEXT,           -- full parsed text (for AI context)
    structure       JSONB,          -- {"chapters": [{"title": "...", "topics": [...]}]}
    file_url        VARCHAR(500),   -- S3 / Supabase Storage URL
    file_hash       VARCHAR(64),    -- SHA-256 of original file for dedup
    embedding_synced BOOLEAN        NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE syllabi IS 'Đề cương môn học — parsed text fed to ChromaDB for RAG.';
CREATE INDEX idx_syllabi_course ON syllabi(course_id);

-- =============================================================================
-- BLOCK 6: METRIC ENGINE — CACHE & CONFIG
-- =============================================================================

CREATE TABLE health_score_configs (
    id              SERIAL          PRIMARY KEY,
    name            VARCHAR(100)    NOT NULL DEFAULT 'default',
    w_gpa           NUMERIC(4,3)    NOT NULL DEFAULT 0.4 CHECK (w_gpa BETWEEN 0 AND 1),
    w_fail_rate     NUMERIC(4,3)    NOT NULL DEFAULT 0.3 CHECK (w_fail_rate BETWEEN 0 AND 1),
    w_clo           NUMERIC(4,3)    NOT NULL DEFAULT 0.3 CHECK (w_clo BETWEEN 0 AND 1),
    pass_threshold  NUMERIC(4,2)    NOT NULL DEFAULT 5.0,   -- điểm tối thiểu để qua môn
    clo_threshold   NUMERIC(5,2)    NOT NULL DEFAULT 50.0,  -- % tối thiểu đạt CLO
    green_threshold NUMERIC(5,2)    NOT NULL DEFAULT 75.0,
    yellow_threshold NUMERIC(5,2)   NOT NULL DEFAULT 50.0,
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    CONSTRAINT weights_sum CHECK (ABS(w_gpa + w_fail_rate + w_clo - 1.0) < 0.001)
);
COMMENT ON TABLE health_score_configs IS 'Cấu hình trọng số Health Score — configurable by admin.';

INSERT INTO health_score_configs (name, w_gpa, w_fail_rate, w_clo)
VALUES ('default', 0.4, 0.3, 0.3);

-- ---------------------------------------------------------------------------

CREATE TABLE node_metric_snapshots (
    id              BIGSERIAL       PRIMARY KEY,
    node_type       node_type       NOT NULL,
    node_id         INT             NOT NULL,
    semester_id     INT             REFERENCES semesters(id) ON DELETE SET NULL,
    cohort_id       INT             REFERENCES cohorts(id) ON DELETE SET NULL,
    config_id       INT             NOT NULL REFERENCES health_score_configs(id),
    gpa_avg         NUMERIC(4,2),
    fail_rate       NUMERIC(5,4),   -- 0.0–1.0
    clo_achievement NUMERIC(5,4),   -- 0.0–1.0
    health_score    NUMERIC(5,4),   -- 0.0–1.0
    health_status   health_status,
    student_count   INT,
    enrollment_count INT,
    computed_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ     NOT NULL DEFAULT (NOW() + INTERVAL '1 hour'),
    extra_metrics   JSONB           DEFAULT '{}'
);
COMMENT ON TABLE node_metric_snapshots IS 'Cache metric cho từng node. Invalidated on data change or TTL.';
CREATE INDEX idx_snapshots_node ON node_metric_snapshots(node_type, node_id);
CREATE INDEX idx_snapshots_computed ON node_metric_snapshots(computed_at DESC);
CREATE INDEX idx_snapshots_expires ON node_metric_snapshots(expires_at);
CREATE INDEX idx_snapshots_semester ON node_metric_snapshots(semester_id);

-- ---------------------------------------------------------------------------

CREATE TABLE anomaly_events (
    id              BIGSERIAL       PRIMARY KEY,
    node_type       node_type       NOT NULL,
    node_id         INT             NOT NULL,
    metric_name     VARCHAR(50)     NOT NULL,   -- 'fail_rate', 'gpa_avg', 'clo_achievement'
    current_value   NUMERIC(10,4),
    baseline_value  NUMERIC(10,4),
    delta           NUMERIC(10,4),
    severity        alert_level     NOT NULL DEFAULT 'warning',
    description     TEXT,
    is_resolved     BOOLEAN         NOT NULL DEFAULT FALSE,
    detected_at     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    resolved_at     TIMESTAMPTZ
);
COMMENT ON TABLE anomaly_events IS 'Phát hiện bất thường: tỷ lệ trượt tăng đột biến, GPA drop...';
CREATE INDEX idx_anomaly_node ON anomaly_events(node_type, node_id);
CREATE INDEX idx_anomaly_resolved ON anomaly_events(is_resolved, detected_at DESC);

-- =============================================================================
-- BLOCK 7: ALERTS & REPORTS
-- =============================================================================

CREATE TABLE alerts (
    id              BIGSERIAL       PRIMARY KEY,
    node_type       node_type,
    node_id         INT,
    anomaly_id      BIGINT          REFERENCES anomaly_events(id) ON DELETE SET NULL,
    level           alert_level     NOT NULL DEFAULT 'warning',
    title           VARCHAR(255)    NOT NULL,
    message         TEXT,
    is_read         BOOLEAN         NOT NULL DEFAULT FALSE,
    is_dismissed    BOOLEAN         NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE alerts IS 'Thông báo cảnh báo hiển thị trên Dashboard và Tree badges.';
CREATE INDEX idx_alerts_node ON alerts(node_type, node_id);
CREATE INDEX idx_alerts_unread ON alerts(is_read, created_at DESC);

-- ---------------------------------------------------------------------------

CREATE TABLE reports (
    id              SERIAL          PRIMARY KEY,
    node_type       node_type       NOT NULL,
    node_id         INT             NOT NULL,
    semester_id     INT             REFERENCES semesters(id) ON DELETE SET NULL,
    title           VARCHAR(255)    NOT NULL,
    content         TEXT,           -- AI-generated markdown report
    file_url        VARCHAR(500),   -- PDF/DOCX export URL
    generated_by    UUID            REFERENCES users(id) ON DELETE SET NULL,
    generated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE reports IS 'Báo cáo cải tiến CTĐT sinh bởi AI — có thể export PDF/Word.';
CREATE INDEX idx_reports_node ON reports(node_type, node_id);
CREATE INDEX idx_reports_generated ON reports(generated_at DESC);

-- =============================================================================
-- BLOCK 8: AI CHAT
-- =============================================================================

CREATE TABLE chat_sessions (
    id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID            NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    context_type    node_type       NOT NULL,
    context_id      INT             NOT NULL,
    title           VARCHAR(255),   -- auto-generated from first message
    is_active       BOOLEAN         NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    last_message_at TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE chat_sessions IS 'AI Chat session — each node click may open a new session.';
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_context ON chat_sessions(context_type, context_id);
CREATE INDEX idx_chat_sessions_active ON chat_sessions(is_active, last_message_at DESC);

-- ---------------------------------------------------------------------------

CREATE TABLE chat_messages (
    id              BIGSERIAL       PRIMARY KEY,
    session_id      UUID            NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role            VARCHAR(20)     NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
    content         TEXT            NOT NULL,
    tool_calls      JSONB,          -- LangGraph tool call metadata
    tool_results    JSONB,          -- tool execution results
    charts_data     JSONB,          -- embedded chart specs (Recharts/Nivo format)
    token_count     INT,
    latency_ms      INT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE chat_messages IS 'Individual messages in a chat session. Stores tool calls and chart data.';
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);

-- ---------------------------------------------------------------------------

CREATE TABLE suggested_questions_cache (
    id              SERIAL          PRIMARY KEY,
    context_type    node_type       NOT NULL,
    context_id      INT             NOT NULL,
    questions       JSONB           NOT NULL, -- ["Q1", "Q2", "Q3", "Q4"]
    generated_at    TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ     NOT NULL DEFAULT (NOW() + INTERVAL '6 hours'),
    UNIQUE (context_type, context_id)
);
COMMENT ON TABLE suggested_questions_cache IS 'Cache câu hỏi gợi ý theo node — TTL 6 giờ.';

-- =============================================================================
-- BLOCK 9: DATA IMPORT & AUDIT
-- =============================================================================

CREATE TABLE import_jobs (
    id              SERIAL          PRIMARY KEY,
    job_type        VARCHAR(50)     NOT NULL, -- 'students', 'grades', 'courses'
    file_name       VARCHAR(255)    NOT NULL,
    file_url        VARCHAR(500),
    file_hash       VARCHAR(64),
    status          import_status   NOT NULL DEFAULT 'pending',
    total_rows      INT,
    processed_rows  INT             NOT NULL DEFAULT 0,
    failed_rows     INT             NOT NULL DEFAULT 0,
    error_summary   TEXT,
    uploaded_by     UUID            REFERENCES users(id) ON DELETE SET NULL,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE import_jobs IS 'Lịch sử import Excel/CSV — hỗ trợ rollback và error report.';
CREATE INDEX idx_import_jobs_status ON import_jobs(status, created_at DESC);
CREATE INDEX idx_import_jobs_user ON import_jobs(uploaded_by);

-- ---------------------------------------------------------------------------

CREATE TABLE import_job_errors (
    id              BIGSERIAL       PRIMARY KEY,
    job_id          INT             NOT NULL REFERENCES import_jobs(id) ON DELETE CASCADE,
    row_number      INT             NOT NULL,
    column_name     VARCHAR(100),
    raw_value       TEXT,
    error_message   TEXT            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE import_job_errors IS 'Chi tiết lỗi từng dòng trong import job.';
CREATE INDEX idx_import_errors_job ON import_job_errors(job_id);

-- ---------------------------------------------------------------------------

CREATE TABLE audit_logs (
    id              BIGSERIAL       PRIMARY KEY,
    user_id         UUID            REFERENCES users(id) ON DELETE SET NULL,
    action          VARCHAR(50)     NOT NULL,   -- 'create', 'update', 'delete', 'import', 'login'
    table_name      VARCHAR(100)    NOT NULL,
    record_id       VARCHAR(50),                -- PK of affected record (cast to text)
    old_data        JSONB,
    new_data        JSONB,
    ip_address      INET,
    user_agent      TEXT,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE audit_logs IS 'Audit trail — mọi thao tác ghi dữ liệu đều được log.';
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name, record_id, created_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action, created_at DESC);

-- =============================================================================
-- BLOCK 10: SYSTEM CONFIGURATION
-- =============================================================================

CREATE TABLE system_configs (
    key         VARCHAR(100)    PRIMARY KEY,
    value       JSONB           NOT NULL,
    description TEXT,
    updated_by  UUID            REFERENCES users(id) ON DELETE SET NULL,
    updated_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE system_configs IS 'Key-value store for system-wide settings (feature flags, LLM config...).';

INSERT INTO system_configs (key, value, description) VALUES
    ('llm.provider',          '"gemini"',                         'LLM provider: gemini | mistral'),
    ('llm.model',             '"gemini-1.5-flash"',               'LLM model name'),
    ('llm.auto_analyze',      'true',                             'Enable auto-analysis on node click'),
    ('cache.metric_ttl_sec',  '3600',                             'Metric snapshot TTL in seconds'),
    ('cache.question_ttl_sec','21600',                            'Suggested questions cache TTL'),
    ('import.max_file_mb',    '10',                               'Max import file size in MB'),
    ('health.weights',        '{"gpa":0.4,"fail":0.3,"clo":0.3}','Default health score weights');

-- =============================================================================
-- VIEWS — Convenience queries used by Metric Engine and AI Agent
-- =============================================================================

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

COMMENT ON VIEW vw_section_stats IS 'Thống kê tổng hợp từng lớp học phần — used by Metric Engine.';

-- ---------------------------------------------------------------------------

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

COMMENT ON VIEW vw_course_stats IS 'Thống kê môn học theo học kỳ — used for drill-down in Academic Tree.';

-- ---------------------------------------------------------------------------

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

COMMENT ON VIEW vw_program_stats IS 'Thống kê ngành/chương trình theo học kỳ.';

-- ---------------------------------------------------------------------------

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

COMMENT ON VIEW vw_department_stats IS 'Thống kê khoa theo học kỳ — root metrics for Academic Tree.';

-- =============================================================================
-- FUNCTIONS & TRIGGERS
-- =============================================================================

-- Auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'universities', 'departments', 'programs', 'courses',
        'users', 'teachers', 'students', 'sections',
        'enrollments', 'grade_components', 'syllabi'
    ]
    LOOP
        EXECUTE format(
            'CREATE TRIGGER trg_%s_updated_at
             BEFORE UPDATE ON %s
             FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at()',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Compute is_passed and grade_letter automatically on enrollment upsert
CREATE OR REPLACE FUNCTION trigger_compute_pass_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    threshold NUMERIC;
BEGIN
    SELECT pass_threshold INTO threshold
    FROM health_score_configs WHERE is_active = TRUE LIMIT 1;
    threshold := COALESCE(threshold, 5.0);

    IF NEW.final_grade IS NOT NULL THEN
        NEW.is_passed := NEW.final_grade >= threshold;
        NEW.grade_letter := CASE
            WHEN NEW.final_grade >= 9.0 THEN 'A+'
            WHEN NEW.final_grade >= 8.5 THEN 'A'
            WHEN NEW.final_grade >= 8.0 THEN 'B+'
            WHEN NEW.final_grade >= 7.0 THEN 'B'
            WHEN NEW.final_grade >= 6.5 THEN 'C+'
            WHEN NEW.final_grade >= 5.5 THEN 'C'
            WHEN NEW.final_grade >= 5.0 THEN 'D+'
            WHEN NEW.final_grade >= 4.0 THEN 'D'
            ELSE 'F'
        END;
        NEW.grade_4 := CASE
            WHEN NEW.final_grade >= 9.0 THEN 4.0
            WHEN NEW.final_grade >= 8.5 THEN 4.0
            WHEN NEW.final_grade >= 8.0 THEN 3.5
            WHEN NEW.final_grade >= 7.0 THEN 3.0
            WHEN NEW.final_grade >= 6.5 THEN 2.5
            WHEN NEW.final_grade >= 5.5 THEN 2.0
            WHEN NEW.final_grade >= 5.0 THEN 1.5
            WHEN NEW.final_grade >= 4.0 THEN 1.0
            ELSE 0.0
        END;
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enrollments_compute_pass
BEFORE INSERT OR UPDATE OF final_grade ON enrollments
FOR EACH ROW EXECUTE FUNCTION trigger_compute_pass_status();

-- ---------------------------------------------------------------------------
-- Invalidate metric cache when grade data changes
CREATE OR REPLACE FUNCTION trigger_invalidate_metric_cache()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Mark snapshots for the affected section's course/program/dept as expired
    UPDATE node_metric_snapshots
    SET expires_at = NOW() - INTERVAL '1 second'
    WHERE node_type IN ('course', 'program', 'department', 'university')
      AND computed_at > NOW() - INTERVAL '24 hours';
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enrollments_invalidate_cache
AFTER INSERT OR UPDATE OR DELETE ON enrollments
FOR EACH STATEMENT EXECUTE FUNCTION trigger_invalidate_metric_cache();

-- =============================================================================
-- SEED: Default University (for single-tenant dev setup)
-- =============================================================================


