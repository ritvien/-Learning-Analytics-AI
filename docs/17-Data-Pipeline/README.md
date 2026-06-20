# Review task Sprint 2 - Hung Backend/DevOps

> Cap nhat ngay 20/06/2026. Tai lieu nay chi ghi nhan cac viec Hung phu trach da hoan thien, bang chung trong code, ket qua verify va cac viec con thieu. Khong mo ta pipeline tong the.

## 1. Tong ket nhanh

| Nhom viec | Trang thai | Ket luan |
| --- | --- | --- |
| T14 - Tree Metrics API | Done | Da co API cay hoc vu va FE dashboard dung du lieu that tu backend. |
| T17/T23 - ORM + Alembic modernization | Done | ORM/schema da dong bo them cac field va migration moi; DB dang o Alembic head. |
| T24 - Seed/import diem thanh phan | Done | Docker backend co seed runner khi DB trong; reset DB sach van dung lai du lieu hoc vu. |
| T25 - Reset DB local + verify revision | Done | Da co script reset local va da chay verify voi Docker/Postgres. |
| T26 - DWH schema, ETL idempotent, DQ checks | Done | Da co fact assessment, ETL idempotent, DQ reconciliation pass. |
| T19 - CLO/PLO backend logic | Done | Da materialize `student_clo_achievements`, report/ETL dung du lieu CLO/PLO. |
| T29 - Report theo Khoa/Nganh/Mon | Done mot phan lon | Da co report types va UI chon Khoa/Nganh/Mon/Lop; export file that van con thieu. |
| T18 - PR Cleanup >= 10 PRs | Chua xac nhan | Can kiem tren GitHub/PR that, workspace local khong xac minh duoc. |

## 2. Cac task da lam

### T14 - Tree Metrics API

Da hoan thien:

- Them `GET /api/v1/tree`.
- Them endpoint metrics theo node.
- Tree tra du cau truc `school -> department -> program -> course`.
- Metrics gom sinh vien, mon hoc, enrollments, pass/fail rate, GPA, health score.
- Dashboard `/manager` da chuyen sang doc metrics tu Tree API thay vi tu join sai o frontend.

Bang chung:

- `backend/app/api/v1/endpoints/tree.py`
- `backend/app/api/v1/router.py`
- `backend/tests/test_tree.py`
- `frontend/src/app/(dashboard)/manager/page.tsx`

Verify:

- Tree API sau reset tra: `699` sinh vien, `480` mon, GPA `2.45`, fail rate `16.7%`, health score `72.28`.

### T17/T23 - ORM + Alembic modernization

Da hoan thien:

- Dong bo ORM voi schema moi.
- Giu Program-Course many-to-many bang `program_courses`.
- Them snapshot/timestamps cho diem va enrollment:
  - `Enrollment.registered_credits`
  - `Enrollment.completed_at`
  - `GradeComponent.assessed_at`
  - `GradeComponent.recorded_at`
- Them migration moi len Alembic head.

Bang chung:

- `backend/app/models/teaching.py`
- `backend/app/schemas/teaching.py`
- `backend/app/api/v1/endpoints/grades.py`
- `backend/migrations/versions/d4e5f6a7b8c9_add_assessment_timestamps.py`
- `backend/migrations/versions/e5f6a7b8c9d0_add_dwh_assessment_facts.py`

Verify:

- Alembic current: `e5f6a7b8c9d0 (head)`.

### T24 - Seed/import diem thanh phan

Da hoan thien:

- Them seed runner de Docker backend tu nap seed khi DB trong.
- Mount `backend/db` vao container backend.
- Seed chay idempotent, reset volume sach van co du academic/grade/outcome data.
- Startup backend chay migration, seed neu DB trong, refresh CLO achievement roi moi start API.

Bang chung:

- `backend/scripts/seed_database.py`
- `backend/entrypoint.sh`
- `docker-compose.yml`
- `backend/db/init-data.sql`
- `backend/db/seed-outcomes.sql`

Verify sau reset:

- `12` khoa
- `37` nganh
- `480` mon
- `699` sinh vien
- `35,916` enrollments
- `96,899` grade components

### T25 - Reset DB local + verify revision

Da hoan thien:

- Them script reset DB local bang Docker.
- Script co guard `-Yes` de tranh xoa volume ngoai y muon.
- Da chay reset that tu volume sach.
- Sau reset, backend/db healthy va Alembic len head.

Bang chung:

- `scripts/reset_local_db.ps1`

Lenh dung:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\reset_local_db.ps1 -Yes
```

Verify:

- Docker services: `backend` va `db` healthy.
- Alembic current: `e5f6a7b8c9d0 (head)`.
- Seed counts dung nhu muc T24.

### T26 - DWH schema, ETL idempotent, DQ checks

Da hoan thien:

- Them DWH fact cho diem thanh phan va CLO achievement.
- ETL refresh idempotent bang upsert.
- ETL refresh `student_clo_achievements` truoc khi nap DWH.
- Data quality reconciliation pass cho enrollment va grade component.

Bang chung:

- `backend/app/analytics/etl.py`
- `backend/migrations/versions/e5f6a7b8c9d0_add_dwh_assessment_facts.py`

Verify:

- `dwh.fact_enrollment_outcome`: `35,916` rows.
- `dwh.fact_grade_component`: `96,899` rows.
- `dwh.fact_clo_achievement`: `71,028` rows.
- DQ checks:
  - `enrollment_count_reconciliation`: pass, `35916/35916`.
  - `grade_component_count_reconciliation`: pass, `96899/96899`.
- ETL chay lai lan 2 van pass, xac nhan idempotent.

### T19 - CLO/PLO backend logic

Da hoan thien:

- Them metric engine de materialize `student_clo_achievements`.
- Tinh diem CLO tu `grade_components x grade_component_clo_mappings`.
- Dat/chua dat CLO theo nguong `>= 4.0`.
- Report service da co CLO breakdown, PLO attainment va narrative fallback.

Bang chung:

- `backend/app/analytics/clo.py`
- `backend/app/analytics/etl.py`
- `backend/app/reports/service.py`

Verify:

- `student_clo_achievements`: `71,028` rows sau reset.
- `dwh.fact_clo_achievement`: `71,028` rows sau ETL.

### T29 - Report theo Khoa/Nganh/Mon

Da hoan thien:

- Them report types:
  - `department_health`
  - `program_health`
  - `course_health`
  - `section_intervention`
  - `school_overview`
- Report Center co tao report theo Khoa/Nganh/Mon/Lop.
- UI da sua de chon scope theo cascade `Khoa -> Nganh -> Mon -> Lop`.
- Chon mon da doi tu dropdown phang sang search/list, tranh hieu nham chi co 2 mon.
- Fetch sections tang len `5000`, tranh thieu lop hoc phan.
- Dashboard report labels/filter da bo sung Khoa va Mon.

Bang chung:

- `backend/app/schemas/reports.py`
- `backend/app/reports/service.py`
- `frontend/src/app/(dashboard)/manager/reports/page.tsx`
- `frontend/src/lib/api.ts`

Con gioi han:

- UI da chuan hoa lua chon `web_preview`, `pdf_a4`, `xlsx_appendix`, nhung backend export file PDF/Excel that chua tach thanh service rieng.

### RBAC/doc quyen lien quan

Da hoan thien:

- Sua quyen doc department cho role doc-only/lecturer theo scope.
- Bo sung access-control helpers cho department/course/report scope.

Bang chung:

- `backend/app/access_control.py`
- `backend/app/api/v1/endpoints/departments.py`

## 3. Ket qua test/build da chay

| Hang muc | Ket qua |
| --- | --- |
| Backend tests | `23 passed, 2 warnings` |
| Frontend build | `next build` pass |
| Docker backend/db | healthy |
| Alembic current | `e5f6a7b8c9d0 (head)` |
| DWH ETL | completed |
| DQ reconciliation | pass |
| Tree API | tra dung metric tong |

## 4. Con thieu / can lam tiep

### P0 neu can demo production hon

- Export file that cho Report Center:
  - PDF A4 sinh file that thay vi chi print browser.
  - Excel appendix sinh file `.xlsx` that.
- Dua DQ nang cao vao report:
  - range diem `[0..max]`;
  - FK mo coi;
  - ty le thieu diem theo lop;
  - do phu mapping CLO->PLO va component->CLO;
  - ghi vao `metrics_json.data_quality`.

### P1

- Worker/cron tu dong:
  - chay ETL theo lich;
  - chay report schedules;
  - trigger sau khi cap nhat diem.
- Invalidate health-score cache sau ETL/import diem.
- Them pagination/search server-side cho course/section neu data tang lon hon.

### Ngoai code local

- T18 PR Cleanup >= 10 PRs:
  - Chua xac nhan duoc trong workspace local.
  - Can kiem tren GitHub: so PR, trang thai merge, PR cleanup con open hay khong.

## 5. Ket luan

Phan Backend/DevOps Sprint 2 cua Hung da co nen tang du de demo:

- DB reset sach dung duoc.
- Seed du lieu tu dong.
- Alembic o head.
- Tree API va dashboard dung metric that.
- DWH ETL chay idempotent va DQ pass.
- CLO/PLO co materialized achievement.
- Report Center da tao duoc report theo Khoa/Nganh/Mon/Lop.

Phan con thieu chu yeu la export file that, DQ nang cao dua vao report va kiem chung T18 tren GitHub.
