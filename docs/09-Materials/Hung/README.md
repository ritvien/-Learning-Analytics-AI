# Backend & Database — Hưng

> **Cập nhật lần cuối:** 13/06/2026  
> **Sprint 2 tasks hoàn thành:** T11 · T12 · T13  
> **Tham chiếu:** [Sprint2.md](../../07-Sprint-Planning/Sprint2.md) · [BackendSprint2Review.md](../../10-References/BackendSprint2Review.md)

---

## Tổng quan những gì đã xây dựng

| Hạng mục | Trạng thái | Ghi chú |
|:---------|:----------:|:--------|
| FastAPI skeleton + Docker | ✅ | Từ Sprint 1 |
| CI/CD (Ruff + pytest) | ✅ | Từ Sprint 1 |
| Alembic migration pipeline | ✅ | 3 migration versions |
| SQLAlchemy ORM — 18 models | ✅ | Async, Mapped style |
| CRUD API — 5 core entities | ✅ | Departments, Programs, Courses, Students, Grades |
| CRUD API — 5 entities bổ sung | ✅ | Teachers, Sections, Semesters, Cohorts, Analytics |
| DWH schema + ETL | ✅ | PostgreSQL only, idempotent |
| ML schema + scoring | ✅ | Cơ bản, train endpoint chưa implement |
| Seed data script | ✅ | Sinh SQL từ JSON crawl data |
| Unit tests | ✅ | 4 test files, in-memory SQLite |
| Tree Metrics API (T14) | ⬜ | Chưa làm |
| SSE Streaming (T15) | ⬜ | Chưa làm |

---

## Tech Stack

| Layer | Công nghệ | Version |
|:------|:----------|:--------|
| Framework | FastAPI + Uvicorn | >=0.115.0 |
| ORM | SQLAlchemy 2.0 (async, Mapped) | >=2.0.36 |
| Migrations | Alembic (async autogenerate) | >=1.14.0 |
| Schemas | Pydantic v2 | >=2.9.0 |
| Auth | JWT (python-jose) + passlib bcrypt | >=3.3.0 |
| DB dev/test | SQLite + aiosqlite | >=0.20.0 |
| DB production | PostgreSQL 16 + asyncpg | >=0.30.0 |
| Linting | Ruff | >=0.7.0 |
| Tests | pytest + pytest-asyncio + httpx | >=8.3.0 |

---

## Cấu trúc thư mục

```
backend/
├── app/
│   ├── main.py             # FastAPI app, lifespan, CORS, mount router
│   ├── config.py           # Settings (pydantic-settings, .env)
│   ├── database.py         # Async engine + session factory + Base
│   ├── dependencies.py     # DBSession, Pagination, JWT deps
│   ├── models/             # SQLAlchemy ORM models (nguồn schema duy nhất)
│   │   ├── academic.py     # University, Department, Program, Semester, Course
│   │   ├── people.py       # User, Teacher, Cohort, Student
│   │   ├── teaching.py     # Section, Enrollment, GradeComponentType, GradeComponent
│   │   ├── assessment.py   # PLO, CLO, CLOPLOMapping, StudentCLOAchievement
│   │   ├── base.py         # TimestampMixin
│   │   └── __init__.py     # Export 18 models cho Alembic autogenerate
│   ├── schemas/            # Pydantic schemas (Create / Update / Response)
│   │   ├── academic.py
│   │   ├── people.py
│   │   ├── teaching.py
│   │   ├── assessment.py
│   │   └── common.py       # OrmBase, PaginatedResponse
│   ├── api/v1/
│   │   ├── router.py       # Aggregate v1 router
│   │   └── endpoints/      # 10 endpoint modules
│   ├── analytics/
│   │   └── etl.py          # OLTP → DWH ETL idempotent
│   └── ml/
│       ├── aggregation.py  # Credit prediction aggregation logic
│       └── scoring.py      # Enrollment scoring
├── migrations/
│   ├── env.py              # Async migration runner
│   └── versions/           # 3 migration files
├── scripts/
│   └── generate_seed_data.py
├── tests/
│   ├── conftest.py
│   ├── test_health.py
│   ├── test_departments.py
│   ├── test_core_crud.py
│   └── test_ml_aggregation.py
├── db/
│   └── schema.sql          # Tài liệu tham chiếu (không dùng bởi Alembic)
├── Dockerfile
├── entrypoint.sh
├── alembic.ini
└── pyproject.toml
```

---

## Database — Kiến trúc tổng thể

Database gồm **3 schema**:

```
public          ← OLTP — dữ liệu thực, nguồn chuẩn
dwh             ← Data Warehouse — analytics, fact/dimension tables (PostgreSQL only)
ml              ← ML — model runs + predictions (PostgreSQL only)
```

### Schema public — OLTP

Dữ liệu học thuật được tổ chức theo 5 nhóm:

```
HIERARCHY
universities
    └── departments
            └── programs ──(many-to-many)── courses
                                                └── plos / clos

PEOPLE
users ──(optional)── teachers
cohorts
programs + cohorts ──── students

TEACHING
courses + semesters + teachers ──── sections
students + sections ─────────────── enrollments
sections ────────────────────────── grade_component_types
enrollments + component_types ───── grade_components

ASSESSMENT (CLO/PLO)
programs ──── plos
courses  ──── clos
clos × plos ─────── clo_plo_mappings
component_types × clos ── grade_component_clo_mappings
enrollments × clos ────── student_clo_achievements
```

#### Bảng chi tiết — OLTP

**universities**
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| code | unique | Mã trường |
| name | text | Tên đầy đủ |
| name_short | text | Tên viết tắt |
| website, address | text | |
| is_active | bool | |
| created_at, updated_at | timestamp | |

**departments**
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| university_id | FK → universities | |
| code | text | Mã khoa |
| name, name_en | text | |
| description | text | |
| head_name, email, phone | text | |
| is_active | bool | Soft-delete |
| created_at, updated_at | timestamp | |

**programs**
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| department_id | FK → departments | |
| code, name, name_en | text | |
| duration_years | int | default 4 |
| total_credits | int | |
| accreditation | text | ABET/AUN/... |
| version | text | |
| is_active | bool | |

**courses**
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| code | unique | |
| name, name_en | text | |
| credits | int | ≥ 1 |
| theory_hours, lab_hours | int | |
| is_elective | bool | |
| is_active | bool | |

**program_courses** — junction table
| Cột | Kiểu |
|:----|:-----|
| program_id | FK → programs |
| course_id | FK → courses |

**semesters**
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| code | unique | vd: HK1-2024 |
| name | text | |
| year | int | |
| term | int | 1–3 |
| is_current | bool | Chỉ 1 học kỳ current tại 1 thời điểm |

**users**
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | UUID string PK | |
| email | unique | |
| hashed_password | text | bcrypt |
| full_name | text | |
| role | enum | superadmin / admin / manager / lecturer / viewer |
| department_id | FK nullable | |
| is_active | bool | |

**teachers**
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| user_id | FK → users, nullable | Teacher có thể không có tài khoản |
| department_id | FK → departments | |
| code | unique nullable | |
| full_name, email, phone | text | |
| academic_title | text | ThS / TS / GS |
| specialization | text | |
| is_active | bool | |

**cohorts**
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| code | unique | vd: K18 |
| year_start | int | |
| year_end | int nullable | |
| note | text nullable | |

**students**
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| program_id | FK → programs | |
| cohort_id | FK → cohorts | |
| student_code | unique | MSSV |
| full_name, email, phone | text | |
| date_of_birth | date nullable | |
| gender | text | |
| class_code | text | |
| status | text | default "active" |
| gpa_cumulative | Numeric(4,2) | |
| is_active | bool | |

**sections** — lớp học phần
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| course_id | FK → courses | |
| teacher_id | FK → teachers, nullable | |
| semester_id | FK → semesters | |
| section_code | text | unique per (course, semester) |
| room, schedule | text | |
| max_students | int | |
| is_active | bool | |

**enrollments** — đăng ký học
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| student_id | FK → students | |
| section_id | FK → sections | |
| final_grade | Numeric(4,2) nullable | Thang 10 |
| grade_letter | text | A/B+/B/C+/C/D+/D/F |
| grade_4 | Numeric(3,2) | Thang 4 |
| is_passed | bool nullable | ≥ 5.0 |
| attempt_number | int | default 1 |
| status | text | default "enrolled" |
| unique (student_id, section_id, attempt_number) | | |

**grade_component_types** — cấu phần điểm của section
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| section_id | FK → sections | |
| name | text | vd: Giữa kỳ, Cuối kỳ |
| weight | Numeric(5,2) | % trọng số |
| max_score | float | default 10.0 |
| is_required | bool | |
| sort_order | int | |

**grade_components** — điểm thành phần của từng sinh viên
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| enrollment_id | FK → enrollments | |
| component_type_id | FK → grade_component_types | |
| score | Numeric(5,2) nullable | |
| is_absent | bool | |
| notes | text | |
| unique (enrollment_id, component_type_id) | | |

**plos** — Program Learning Outcomes
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| program_id | FK → programs | |
| code, name, description | text | |
| bloom_level | int 1–6 nullable | |
| sort_order | int | |
| is_active | bool | |
| unique (program_id, code) | | |

**clos** — Course Learning Outcomes
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| id | PK | |
| course_id | FK → courses | |
| code, name, description | text | |
| bloom_level | int 1–6 nullable | |
| weight | float | default 1.0 |
| sort_order | int | |
| is_active | bool | |
| unique (course_id, code) | | |

**clo_plo_mappings** — ma trận CLO × PLO
| Cột | Kiểu | Ghi chú |
|:----|:-----|:--------|
| clo_id | FK → clos | PK composite |
| plo_id | FK → plos | PK composite |
| contribution | int 1–3 | Mức đóng góp (ABET/AUN) |

**grade_component_clo_mappings**
| Cột | Kiểu |
|:----|:-----|
| component_type_id | FK → grade_component_types, PK |
| clo_id | FK → clos, PK |
| weight | float default 1.0 |

**student_clo_achievements**
| Cột | Kiểu |
|:----|:-----|
| id | PK |
| enrollment_id | FK → enrollments |
| clo_id | FK → clos |
| achievement_score | float nullable |
| is_achieved | bool nullable |
| unique (enrollment_id, clo_id) | |

---

### Schema dwh — Data Warehouse *(PostgreSQL only)*

ETL idempotent từ OLTP → DWH chạy qua `POST /admin/dwh/refresh`.

**Dimension tables:**

| Bảng | Mô tả |
|:-----|:------|
| `dwh.dim_student` | Snapshot sinh viên (student_code, program_id, cohort_id, status) |
| `dwh.dim_course` | Snapshot môn học (code, name, credits) |
| `dwh.dim_semester` | Snapshot học kỳ (code, year, term) |
| `dwh.dim_section` | Snapshot lớp học phần |
| `dwh.dim_program` | Snapshot chương trình đào tạo |
| `dwh.dim_cohort` | Snapshot khóa |

**Fact tables:**

| Bảng | Mô tả |
|:-----|:------|
| `dwh.fact_enrollment_outcome` | Kết quả từng enrollment: final_grade, grade_4, is_passed |
| `dwh.fact_student_semester` | Tổng tín chỉ/điểm/pass/fail của sinh viên theo học kỳ |

**Tracking:**

| Bảng | Mô tả |
|:-----|:------|
| `dwh.etl_run` | Log các lần ETL: status, thời gian, số rows |
| `dwh.data_quality_result` | Kết quả data quality checks mỗi ETL run |

---

### Schema ml — Machine Learning *(PostgreSQL only)*

| Bảng | Mô tả |
|:-----|:------|
| `ml.model_run` | Lưu model metadata (name, version, metrics, artifact_uri) |
| `ml.enrollment_prediction` | Xác suất pass/fail từng enrollment + explanation |
| `ml.student_semester_prediction` | Tổng expected_passed/failed credits theo sinh viên-học kỳ |

---

## Migrations

| File | Nội dung |
|:-----|:---------|
| `54025928d213_baseline_oltp_schema.py` | Tạo toàn bộ 18 bảng OLTP (schema public) |
| `8b2d4c7e91af_add_dwh_and_ml_schemas.py` | Tạo schema dwh + ml với 8 DWH tables + 3 ML tables |
| `c9e3f1a2b845_add_missing_dwh_dimensions.py` | Bổ sung dim_section, dim_program, dim_cohort |

**Chạy migration:**
```bash
# Trong container (tự động khi startup)
alembic upgrade head

# Manual
cd backend && alembic upgrade head

# Rollback
alembic downgrade -1

# Xem lịch sử
alembic history
```

---

## API Endpoints

Base URL: `/api/v1` · Swagger: `/api/docs`

### System
| Method | Path | Mô tả |
|:-------|:-----|:------|
| GET | `/health` | Health check |

### Departments
| Method | Path | Mô tả |
|:-------|:-----|:------|
| GET | `/departments` | Danh sách (pagination: skip, limit) |
| GET | `/departments/{id}` | Chi tiết |
| POST | `/departments` | Tạo mới |
| PATCH | `/departments/{id}` | Cập nhật partial |
| DELETE | `/departments/{id}` | Soft-delete |

### Programs
| Method | Path | Mô tả |
|:-------|:-----|:------|
| GET | `/programs?department_id=` | Danh sách (filter theo khoa) |
| GET | `/programs/{id}` | Chi tiết |
| POST | `/programs` | Tạo mới |
| PATCH | `/programs/{id}` | Cập nhật |
| DELETE | `/programs/{id}` | Soft-delete |

### Courses
| Method | Path | Mô tả |
|:-------|:-----|:------|
| GET | `/courses?program_id=` | Danh sách (filter theo ngành) |
| GET | `/courses/{id}` | Chi tiết kèm program_ids |
| POST | `/courses` | Tạo mới (bắt buộc program_ids) |
| PATCH | `/courses/{id}` | Cập nhật (optional program_ids) |
| DELETE | `/courses/{id}` | Soft-delete |

### Students
| Method | Path | Mô tả |
|:-------|:-----|:------|
| GET | `/students?program_id=&cohort_id=` | Danh sách |
| GET | `/students/{id}` | Chi tiết |
| POST | `/students` | Tạo mới |
| PATCH | `/students/{id}` | Cập nhật |
| DELETE | `/students/{id}` | Soft-delete |

### Grades
| Method | Path | Mô tả |
|:-------|:-----|:------|
| GET | `/grades/enrollments?section_id=&student_id=` | Danh sách enrollment |
| POST | `/grades/enrollments` | Đăng ký học |
| PATCH | `/grades/enrollments/{id}/grade` | Nhập/cập nhật điểm (0–10) |
| PUT | `/grades/components` | Upsert điểm thành phần |

**Logic tự động khi nhập điểm:**
```
≥ 8.5 → A    (4.0)
≥ 8.0 → B+   (3.5)
≥ 7.0 → B    (3.0)
≥ 6.5 → C+   (2.5)
≥ 5.5 → C    (2.0)   ← Pass/Fail threshold: 5.0
≥ 5.0 → D+   (1.5)
≥ 4.0 → D    (1.0)
< 4.0 → F    (0.0)
```

### Các endpoint khác
| Prefix | Mô tả |
|:-------|:------|
| `/teachers` | CRUD giảng viên (filter: department_id) |
| `/sections` | CRUD lớp học phần (filter: course_id, semester_id, teacher_id) |
| `/semesters` | CRUD học kỳ, auto-clear is_current khi set mới |
| `/cohorts` | CRUD khóa học |
| `/analytics` | DWH overview, trends theo học kỳ, ETL status |
| `/admin/dwh/refresh` | Trigger OLTP → DWH ETL |
| `/admin/ml/score` | Batch-score enrollments |
| `/predictions/...` | Xem kết quả dự đoán |

---

## DB Session & Auth

**Session factory** (`app/database.py`):
```python
# Async engine
engine = create_async_engine(settings.database_url, pool_pre_ping=True, pool_recycle=3600)

# Session factory
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, autoflush=False)

# FastAPI dependency
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session   # auto-commit on success, rollback on exception
```

**JWT Auth** (`app/dependencies.py`):
- OAuth2PasswordBearer: `tokenUrl=/api/v1/auth/login`
- Token expire: 1440 phút (24h), algorithm HS256
- Roles: `superadmin > admin > manager > lecturer > viewer`

**Pagination** (mặc định cho tất cả list endpoints):
- `skip=0`, `limit=50` (max 200)

---

## Environment Variables

```env
APP_ENV=development           # development | staging | production
DEBUG=false
DATABASE_URL=sqlite+aiosqlite:///./eduinsight.db   # dev
# DATABASE_URL=postgresql+asyncpg://user:pass@db:5432/eduinsight  # prod
SECRET_KEY=change-me-in-production-use-openssl-rand-hex-32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440
CORS_ORIGINS=http://localhost:3000
LLM_PROVIDER=gemini
LLM_MODEL=gemini-1.5-flash
LLM_API_KEY=
```

---

## Docker

**Startup sequence:**
```
docker-compose up
  → PostgreSQL healthcheck (pg_isready, 10 retries × 5s)
  → Backend entrypoint.sh:
      1. alembic upgrade head   ← tự động migrate
      2. uvicorn app.main:app --host 0.0.0.0 --port 8000
```

**Reset DB sạch:**
```bash
docker-compose down -v     # xóa volume
docker-compose up --build  # build lại + migrate từ đầu
```

---

## Tests

```bash
cd backend
pytest tests/           # chạy toàn bộ (in-memory SQLite, auto-asyncio)
pytest tests/ -v        # verbose
pytest tests/test_departments.py  # chạy 1 file
```

| File | Test gì |
|:-----|:--------|
| `test_health.py` | GET /health → 200 |
| `test_departments.py` | Create → List → Soft-delete, 404 handling |
| `test_core_crud.py` | Full flow: University → Dept → Program → Course → Teacher → Student → Section → Enrollment → Grade |
| `test_ml_aggregation.py` | Credit prediction math, xác suất hợp lệ |

---

## Seed Data

Script `backend/scripts/generate_seed_data.py` đọc file JSON từ data crawl (EPU) và sinh SQL INSERT:

```bash
python scripts/generate_seed_data.py
# → backend/db/init-data.sql
```

Load vào DB:
```bash
# Trong PostgreSQL container
psql -U postgres -d eduinsight -f /app/db/init-data.sql
```

**Dữ liệu sinh ra bao gồm:** universities, departments, programs, cohorts, semesters, courses, students, sections, enrollments (kèm final_grade, grade_letter).
