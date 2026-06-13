# Backend Sprint 2 Review

> **Phạm vi:** nhiệm vụ Backend/DevOps của Hưng — Sprint 2 (11/06 – 24/06/2026)  
> **Tham chiếu:** [Sprint2.md](../07-Sprint-Planning/Sprint2.md) · [BackendSprint1Review.md](./BackendSprint1Review.md)

## 1. Kết quả thực hiện

| Task | Trạng thái | Bằng chứng / File thực hiện |
|:-----|:----------:|:---------------------------|
| T11 - Database Migration + Seed Runner | ✅ Done | `backend/alembic.ini`, `backend/migrations/env.py`, 3 migration versions trong `backend/migrations/versions/`, `backend/scripts/generate_seed_data.py`, `backend/entrypoint.sh` |
| T12 - SQLAlchemy Models + DB Session | ✅ Done | `backend/app/models/academic.py`, `backend/app/models/people.py`, `backend/app/models/assessment.py`, `backend/app/models/teaching.py`, `backend/app/models/base.py`, `backend/app/models/__init__.py`, `backend/app/database.py` |
| T13 - CRUD API — Core Entities (P0) | ✅ Done | `backend/app/api/v1/endpoints/departments.py`, `programs.py`, `courses.py`, `students.py`, `grades.py`, `backend/app/api/v1/router.py` |
| T14 - Tree Metrics API | ⬜ Chưa làm | — |
| T15 - SSE Streaming Endpoint | ⬜ Chưa làm | — |
| T16 - Unit Tests — Backend | ⬜ Chưa làm | — |
| T17 - Chốt ORM + Alembic Baseline | ⬜ Chưa làm | — |
| T18 - PR Cleanup ≥ 10 PRs | ⬜ Chưa làm | — |

---

## 2. Chi tiết thực hiện

### T11 — Database Migration + Seed Runner

**Alembic setup:**
- `backend/alembic.ini` — cấu hình `script_location = migrations`, async SQLAlchemy
- `backend/migrations/env.py` — async migration runner, import toàn bộ models từ `app.models` để autogenerate

**Migration versions (3 files):**
- `54025928d213_baseline_oltp_schema.py` — toàn bộ OLTP schema: universities, departments, programs, courses, users, teachers, students, cohorts, sections, enrollments, grade components, PLOs, CLOs, mappings
- `8b2d4c7e91af_add_dwh_and_ml_schemas.py` — tạo PostgreSQL schema `dwh` và `ml`, ETL tracking, data quality
- `c9e3f1a2b845_add_missing_dwh_dimensions.py` — bổ sung dimension tables cho DWH

**Seed runner:**
- `backend/scripts/generate_seed_data.py` — parse JSON export từ data crawl, sinh SQL INSERT statements, output ra `backend/db/init-data.sql`, xử lý batch, update sequences

**DB readiness trên Docker:**
- `backend/entrypoint.sh` — tự động chạy `alembic upgrade head` khi container khởi động
- `docker-compose.yml` — PostgreSQL healthcheck `pg_isready` (10 retries, 5s interval), backend phụ thuộc vào DB healthy

---

### T12 — SQLAlchemy Models + DB Session

**DB session factory** (`backend/app/database.py`):
- `Base` — `DeclarativeBase` cho toàn bộ models
- `engine` — async SQLAlchemy engine với pool settings
- `AsyncSessionLocal` — `async_sessionmaker[AsyncSession]`
- `get_db()` — FastAPI dependency, tự động commit/rollback

**Models (18 classes):**

| File | Models |
|:-----|:-------|
| `academic.py` | University, Department, Program, Course, Semester |
| `people.py` | User (RBAC: superadmin/admin/manager/lecturer/viewer), Teacher, Student, Cohort |
| `assessment.py` | PLO, CLO, CLOPLOMapping, GradeComponentCLOMapping, StudentCLOAchievement |
| `teaching.py` | Section, Enrollment, GradeComponentType, GradeComponent |
| `base.py` | TimestampMixin (`created_at`, `updated_at`) |

**Model registry** (`backend/app/models/__init__.py`): export tất cả 18 models để Alembic autogenerate nhận diện.

---

### T13 — CRUD API — Core Entities (P0)

**5 endpoint files** trong `backend/app/api/v1/endpoints/`:

| File | Prefix | Operations |
|:-----|:-------|:-----------|
| `departments.py` | `/departments` | GET list (pagination), GET one, POST, PATCH, DELETE (soft-delete → `is_active=False`) |
| `programs.py` | `/programs` | GET list (filter `department_id`), GET one, POST, PATCH, DELETE (soft-delete) |
| `courses.py` | `/courses` | GET list (filter `program_id`), GET one, POST (kèm `program_ids`), PATCH (xử lý relationship), DELETE (soft-delete) |
| `students.py` | `/students` | GET list (filter `program_id`, `cohort_id`), GET one, POST, PATCH, DELETE (soft-delete) |
| `grades.py` | `/grades` | GET enrollments (filter `section_id`, `student_id`), POST enrollment, PATCH grade, PUT grade component (upsert) |

**Router** (`backend/app/api/v1/router.py`): đăng ký tất cả routers với prefix chuẩn. Swagger UI tự động tại `/docs`.

---

## 3. Quyết định kỹ thuật

- Tất cả DELETE dùng **soft-delete** (`is_active=False`), không xóa vật lý để bảo toàn referential integrity.
- Grades endpoint tổ chức theo pattern **Enrollment + GradeComponent** thay vì CRUD đơn thuần, phù hợp với domain model.
- Async SQLAlchemy xuyên suốt (`AsyncSession`, `async_sessionmaker`) để tương thích với FastAPI async.
- `generate_seed_data.py` sinh SQL file thay vì import trực tiếp — cho phép review data trước khi load.

---

## 4. Vấn đề / Ghi chú

- Seed data script (`generate_seed_data.py`) sinh file SQL nhưng **chưa có cơ chế auto-run** khi khởi động container lần đầu — cần chạy tay hoặc mount vào `docker-entrypoint-initdb.d/`.
- Migration `8b2d4c7e91af` tạo schema `dwh`/`ml` nhưng **chỉ áp dụng cho PostgreSQL** (có check dialect), không ảnh hưởng SQLite.
