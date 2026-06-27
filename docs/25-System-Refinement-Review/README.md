# System Refinement Review

> Ngày review: 26/06/2026  
> Vai trò review: chuyên gia giáo dục + reviewer hệ thống BE/FE/database/AI.  
> Phạm vi đối chiếu: docs chuẩn hiện tại, `backend/app/api/v1/endpoints`, `backend/app/analytics`, `backend/app/ml`, `backend/app/agent`, `backend/app/reports`, `frontend/src/lib/api.ts`, dashboard layout/sidebar/preloader, các page analytics/report/chat.

## 1. Kết luận nhanh

EduInsight hiện đã có nền tốt của một hệ thống learning analytics:

- Dữ liệu học vụ OLTP đã tách khỏi DWH và ML schema.
- Analytics overview, department, program đã đọc aggregate từ DWH.
- Dropout ML đã có train/score/predict API, prediction lưu ở schema `ml`.
- Agent đã có guardrail quan trọng: không tự sinh xác suất dropout, chỉ đọc prediction.
- Report Center và Report Agent đã có plan/confirm, snapshot, lịch báo cáo và action plan dạng nội dung.
- Observability đã có event log, session, trace ID và API superadmin.

Nhưng hệ thống vẫn đang dừng nhiều ở mức **phát hiện và diễn giải**. Để thành sản phẩm giáo dục đặc biệt hơn, cần thêm lớp **vận hành can thiệp**:

```text
Insight/risk
-> evidence
-> giao việc
-> can thiệp
-> follow-up
-> đo hiệu quả
-> báo cáo
```

Các việc cần làm không nên chỉ là polish UI. Cần sửa đồng thời BE, FE, database, ETL, ML và agent để mọi cảnh báo có bằng chứng, hành động và vòng đời xử lý.

## 2. Hiện trạng đã kiểm chứng

| Nhóm | Đã có | Khoảng thiếu chính |
|---|---|---|
| Analytics DWH | `/analytics/dashboard/overview`, `/departments`, `/programs/{id}` đọc DWH | Chưa có aggregate API production cho course, section, student risk profile |
| Frontend analytics | Overview/department/program dùng API aggregate; course/section/student có UI phong phú | Course/section/student vẫn tải raw enrollment lớn và tự aggregate ở FE |
| ML dropout | `/admin/ml/train`, `/admin/ml/score-dropout`, `/predictions/students/{id}/dropout-risk` | Chưa nối thành risk list/watchlist cấp lớp/ngành; chưa có calibration/drift surface trong UI |
| Report | Có report snapshot, schedule, report agent plan/confirm | Action plan chưa thành task/intervention object thật |
| Agent | Có global chat, route handoff, report build plan, dropout tool | SQL tool còn quá rộng; chưa có tool registry theo role/scope cho insight/task/intervention |
| RBAC | Read scope khá tốt ở student/section/prediction/report | Write scope một số CRUD cần siết, đặc biệt `sections` và phân công giảng viên |
| Observability | Event log, page view, HTTP/chat/tool events, admin APIs | Một số UI action chính chưa gửi `filter_change`, `entity_open`, `chat_open`; chưa gắn task/intervention trace |
| DQ | ETL có reconciliation enrollment/component | Chưa có DQ học vụ sâu: điểm ngoài khoảng, thiếu giảng viên, thiếu mapping CLO, thiếu điểm |

## 3. P0 cần sửa ngay

### P0-01. Bỏ raw preload lớn sau login

Hiện trạng:

- `frontend/src/components/layout/dashboard-preloader.tsx` vẫn preload:
  - `getSections({ limit: 5000 })`
  - `getStudents({ limit: 1000 })`
  - `getCourses({ limit: 1000 })`
  - `getEnrollments({ limit: 5000 })`
  - `getGradeComponents({ limit: 10000 })`
  - `getEnrollments({ limit: 50000 })`

Tác động:

- Login/demo qua Ngrok dễ chậm.
- Tăng tải backend vô ích.
- Làm sai hướng kiến trúc DWH vì frontend kéo raw data để tính dashboard.

FE cần sửa:

- Chỉ preload route và aggregate nhẹ:
  - `api.getTree()`
  - `api.getDashboardOverview()`
  - `api.getDashboardDepartments()`
  - first `api.getDashboardProgram()`
  - `api.getReports({ limit: 20 })`
- Không preload enrollment/grade component raw.
- Preload CRUD chỉ khi hover sidebar hoặc vào route quản trị tương ứng.

BE không cần sửa ngay, nhưng nên thêm aggregate API ở P0-02/P0-03 để FE không cần raw.

Acceptance:

- Sau login không có request `limit=50000` hoặc `grade/components?limit=10000`.
- Overview dashboard vẫn load đủ KPI trong 1 request aggregate chính.

### P0-02. Thêm aggregate API cho Course Analytics

Hiện trạng:

- `frontend/src/app/(dashboard)/manager/analytics/courses/page.tsx` gọi:
  - `api.getCourses({ limit: 500 })`
  - `api.getEnrollments({ limit: 50000 })`
  - `api.getSections({ limit: 5000 })`
  - `api.getCourseHealthBatch(...)`
- FE tự tính trend, distribution, section table.

BE cần bổ sung:

```text
GET /api/v1/analytics/dashboard/courses
GET /api/v1/analytics/dashboard/courses/{course_id}
```

Response đề xuất:

```json
{
  "filters": { "semester_code": "...", "department_id": 1, "program_id": 2 },
  "course_rows": [
    {
      "id": 10,
      "code": "MATH101",
      "name": "Toan cao cap",
      "credits": 3,
      "completed_enrollments": 120,
      "pass_rate": 72.5,
      "avg_grade": 6.4,
      "failed_count": 33,
      "near_fail_count": 12,
      "health_score": 68.2,
      "clo_attainment_rate": 0.71
    }
  ],
  "selected_course": {
    "kpis": {},
    "trend": [],
    "grade_distribution": [],
    "section_rows": []
  }
}
```

Database/ETL:

- Query từ `dwh.fact_enrollment_outcome`, `dwh.fact_clo_achievement`, `dwh.dim_course`, `dwh.dim_section`, `dwh.dim_semester`.
- Không đọc bảng CRUD trực tiếp để tính dashboard.
- Thêm index nếu cần:
  - `dwh.fact_enrollment_outcome(course_id, semester_id)`
  - `dwh.fact_enrollment_outcome(section_id)`
  - `dwh.fact_clo_achievement(course_id, semester_id)`

FE cần sửa:

- `courses/page.tsx` chuyển sang gọi aggregate API.
- Chỉ gọi raw enrollment khi người dùng mở evidence drawer hoặc export chi tiết, có phân trang.
- Table lớp trong môn phải có link:
  - `/manager/analytics/sections?section_id=...&course_id=...&semester_code=...&source=courses`

Acceptance:

- Default course analytics không gọi `getEnrollments(limit=50000)`.
- Mở một môn vẫn có trend, distribution, section rows từ aggregate API.
- Row lớp click được sang page lớp đúng context.

### P0-03. Thêm aggregate API cho Section Analytics và Risk Student List

Hiện trạng:

- `sections/page.tsx` gọi `getEnrollments(limit=50000)`, `getSections(limit=5000)`, `getStudents(limit=1000)`.
- Risk student list đang do frontend tính bằng `final_grade` và ngưỡng rule-based.

BE cần bổ sung:

```text
GET /api/v1/analytics/dashboard/sections
GET /api/v1/analytics/dashboard/sections/{section_id}
GET /api/v1/analytics/dashboard/sections/{section_id}/risk-students
```

Response section list:

```json
{
  "section_rows": [
    {
      "id": 300,
      "section_code": "SE101-01",
      "course_id": 25,
      "course_code": "SE101",
      "course_name": "Nhap mon CNPM",
      "semester_code": "2025-2",
      "teacher_id": 8,
      "teacher_name": "Nguyen Van A",
      "student_count": 45,
      "graded_count": 41,
      "pass_rate": 68.3,
      "avg_grade": 5.9,
      "failed_count": 9,
      "near_fail_count": 5,
      "missing_grade_count": 4,
      "risk_level": "high"
    }
  ]
}
```

Response risk students:

```json
{
  "items": [
    {
      "student_id": 1200,
      "student_code": "21810310019",
      "full_name": "Nguyen Van B",
      "final_grade": 4.8,
      "risk_bucket": "near_fail",
      "dropout_probability": 0.61,
      "dropout_risk_level": "high",
      "reasons": ["Cận trượt", "GPA giảm", "Có prediction dropout cao"]
    }
  ]
}
```

Database/ML:

- Risk list nên merge hai nguồn:
  - descriptive/rule-based từ DWH: điểm thấp, thiếu điểm, trượt, cận trượt;
  - predictive từ `ml.student_dropout_prediction` nếu có.
- Không để frontend tự tạo xác suất hoặc tự suy diễn dropout.

FE cần sửa:

- `sections/page.tsx` đọc aggregate section list.
- Khi mở detail lớp, gọi risk-students endpoint.
- Risk student row click sang:
  - `/manager/analytics/students?student_id=...&section_id=...&source=sections`
- Thêm actions: `Tạo báo cáo lớp`, `Hỏi AI về lớp`, `Tạo can thiệp`.

Acceptance:

- Lecturer vào page chỉ thấy lớp của mình từ backend scope.
- Không còn cần `getStudents(limit=1000)` để render danh sách risk trong lớp.
- Risk list hiển thị cả lý do rule-based và prediction nếu có.

### P0-04. Siết write RBAC cho Section và phân công giảng viên

Hiện trạng:

- `backend/app/api/v1/endpoints/sections.py`
  - `list_sections` đã scope theo role khá tốt.
  - `create_section`, `update_section`, `delete_section` chỉ dùng `require_write_access`, chưa kiểm tra object scope.
- `docs/24-Teacher-Section-Assignment/README.md` đã ghi đúng nhu cầu gán lớp cho Teacher, nhưng code BE chưa siết scope write đủ chặt.

BE cần sửa:

- `create_section(payload, db, current_user)`:
  - admin/superadmin được tạo mọi khoa.
  - manager chỉ tạo section cho course thuộc khoa mình.
  - lecturer/viewer không được tạo.
- `update_section(section_id, payload, db, current_user)`:
  - kiểm tra user có quyền trên section hiện tại.
  - nếu đổi `course_id`, course mới cũng phải trong scope.
  - nếu đổi `teacher_id`, teacher mới phải thuộc khoa phù hợp.
- `delete_section(section_id, db, current_user)`:
  - manager chỉ xóa mềm section trong khoa mình.
- Thêm helper:

```text
can_write_section(db, user, section_id)
can_assign_teacher_to_section(db, user, teacher_id, section_id)
```

FE cần sửa:

- Thêm `api.createSection`, `api.updateSection`, `api.deleteSection`.
- Từ `teachers/page.tsx`, thêm dialog phân lớp như docs/24.
- Sau phân lớp, lecturer login phải thấy đúng `/manager/analytics/sections` và `/manager/grades`.

Test cần thêm:

- Manager không gán teacher ngoài khoa.
- Manager không sửa section ngoài khoa.
- Lecturer gọi PATCH section bị 403.

Acceptance:

- Không thể dùng API để gán giảng viên ngoài scope.
- UI phân công lớp không cần Postman/manual DB.

### P0-05. Tạo Task/Intervention workflow MVP

Hiện trạng:

- Report action plan hiện là text trong `metrics_json`.
- Chưa có bảng task/intervention thật.
- Không có lifecycle giao việc, follow-up, đóng task, đo kết quả.

Database cần thêm migration mới, không sửa migration cũ:

```text
ops.analytics_tasks
ops.task_comments
ops.task_status_history
ops.student_interventions
ops.intervention_followups
```

Nếu chưa muốn thêm schema `ops`, có thể để `public`, nhưng nên tách schema để rõ workload vận hành.

Schema MVP:

```sql
CREATE SCHEMA IF NOT EXISTS ops;

CREATE TABLE ops.analytics_tasks (
  id BIGSERIAL PRIMARY KEY,
  task_type TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  scope_type TEXT NOT NULL,
  scope_id TEXT NOT NULL,
  source_type TEXT NULL,
  source_id TEXT NULL,
  source_metric TEXT NULL,
  source_value JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT NOT NULL,
  assignee_user_id UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  due_at TIMESTAMPTZ NULL,
  resolution_note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ NULL
);

CREATE TABLE ops.student_interventions (
  id BIGSERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES public.students(id),
  task_id BIGINT NULL REFERENCES ops.analytics_tasks(id) ON DELETE SET NULL,
  section_id INT NULL REFERENCES public.sections(id),
  intervention_type TEXT NOT NULL,
  note TEXT NOT NULL,
  outcome TEXT NULL,
  created_by UUID NULL REFERENCES public.users(id) ON DELETE SET NULL,
  follow_up_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

BE API:

```text
GET /api/v1/tasks
POST /api/v1/tasks
PATCH /api/v1/tasks/{id}
POST /api/v1/tasks/{id}/comments
POST /api/v1/tasks/{id}/close

GET /api/v1/students/{id}/interventions
POST /api/v1/students/{id}/interventions
PATCH /api/v1/interventions/{id}
```

FE:

- Sidebar thêm `Can thiệp & việc cần làm`.
- Sections risk list có nút `Tạo can thiệp`.
- Reports action plan có nút `Tạo task` cho từng action.
- Student profile hiển thị intervention history.

Agent/Report:

- Report Agent chỉ được tạo task/intervention sau khi user xác nhận.
- Tool mới:

```text
create_task(...)
create_intervention(...)
schedule_followup(...)
```

Acceptance:

- Từ một sinh viên/lớp rủi ro có thể tạo task/can thiệp.
- Task có assignee, deadline, status, source evidence.
- Đóng task bắt buộc có resolution note.

## 4. P1 nên làm sau P0

### P1-01. Student Risk Profile API

Hiện trạng:

- `students/page.tsx` tải `students 1000`, `sections 5000`, `courses 500`, rồi gọi enrollment raw theo student.
- UI có risk explanation nhưng là rule-based trong FE; chưa đọc dropout API.
- Copy còn tiếng Anh: `Risk level`, `Credit progress`, `Risk Explanation`, `Student Transcript Table`.

BE:

```text
GET /api/v1/analytics/students/{student_id}/risk-profile
GET /api/v1/analytics/students/search?q=...
```

Risk profile cần gồm:

- học vụ: GPA, pass rate, failed credits, current semester;
- prediction: dropout_probability/risk_level nếu có;
- reasons: top factors từ ML + rule-based;
- transcript paginated;
- interventions history;
- linked sections/courses.

FE:

- Thay select 1000 SV bằng combobox search MSSV/họ tên.
- Khi mở từ section, giữ chip `Từ lớp ...`.
- Việt hóa label.
- Transcript row click sang course/section.

Acceptance:

- User tìm sinh viên bằng MSSV/họ tên trong 1 thao tác.
- Không tải 1000 sinh viên mặc định.
- Hồ sơ sinh viên đọc risk từ backend, không tự kết luận xác suất ở FE.

### P1-02. Daily Brief / Việc cần chú ý hôm nay

Hiện trạng:

- `/manager/analytics` là dashboard số liệu, chưa phải hàng đợi việc.

BE:

```text
GET /api/v1/analytics/brief
GET /api/v1/analytics/insights
POST /api/v1/analytics/insights/{id}/dismiss
POST /api/v1/analytics/insights/{id}/create-task
```

Database:

```text
ops.analytics_insights
ops.metric_snapshots
```

Insight nên lưu:

- scope_type/scope_id;
- metric_key;
- current_value;
- baseline_value;
- severity;
- reason;
- evidence JSON;
- recommended_action;
- generated_at;
- dismissed_at.

FE:

- Landing sau login nên là `Tổng quan` với panel `Cần xử lý trước`.
- Mỗi insight có nút: `Xem chi tiết`, `Tạo task`, `Hỏi AI`, `Bỏ qua`.

Acceptance:

- Manager vào hệ thống thấy ngay 5-7 việc ưu tiên, không phải tự đọc chart.

### P1-03. Data Quality Center

Hiện trạng:

- `dwh.data_quality_result` mới có reconciliation count.

BE/ETL cần thêm checks:

- điểm ngoài `[0, max_score]`;
- final_grade ngoài thang điểm;
- enrollment thiếu student/section/course/semester;
- lớp thiếu giảng viên;
- sinh viên thiếu program/cohort;
- course thiếu department;
- CLO chưa có mapping grade component;
- PLO/CLO mapping trống;
- section có enrollment nhưng không active;
- tỷ lệ thiếu điểm theo lớp/học kỳ.

API:

```text
GET /api/v1/data-quality/summary
GET /api/v1/data-quality/issues
POST /api/v1/data-quality/issues/{id}/resolve
```

Database:

```text
dq.data_quality_checks
dq.data_quality_issues
dq.data_quality_resolutions
```

FE:

- Admin page `Data Quality Center`.
- Report Center đọc DQ warning để gắn nhãn `Tạm tính`, `Dữ liệu thiếu`, `Cỡ mẫu nhỏ`.

Acceptance:

- Báo cáo và dashboard không kết luận mạnh khi DQ fail.
- Admin biết lỗi dữ liệu nằm ở bảng/entity nào.

### P1-04. Metric Explanation Pattern

Hiện trạng:

- Nhiều KPI hiển thị số nhưng chưa có công thức/sample size/source rõ ràng.

BE:

```text
GET /api/v1/analytics/metrics/explain?metric_key=...&scope_type=...&scope_id=...
```

Payload:

```json
{
  "metric_key": "section_pass_rate",
  "label": "Ty le dat lop",
  "formula": "passed_enrollments / completed_enrollments",
  "value": 68.3,
  "sample_size": 41,
  "data_sources": ["dwh.fact_enrollment_outcome", "dwh.dim_section"],
  "filters": {},
  "warnings": [],
  "drilldowns": []
}
```

FE:

- KPI/card/chart cell có `Explain` panel.
- Actions: `Hỏi AI về chỉ số`, `Tạo task`, `Drill-down`.

Agent:

- Tool `explain_metric(metric_key, scope, filters)`.
- Agent không tự giải thích công thức nếu backend chưa trả metric metadata.

Acceptance:

- Người dùng biết chỉ số tính từ đâu, mẫu bao nhiêu, có warning gì.

### P1-05. Route policy map tập trung ở frontend

Hiện trạng:

- `frontend/src/app/(dashboard)/layout.tsx` chỉ guard `/manager/users` và `/manager/programs`.
- Sidebar cũng chỉ dùng `roles` vài route.

FE cần thêm:

```text
frontend/src/lib/route-policy.ts
```

Nội dung:

```ts
{
  "/manager/users": ["superadmin", "admin"],
  "/manager/observability": ["superadmin"],
  "/manager/programs": ["superadmin", "admin", "manager"],
  "/manager/sections": ["superadmin", "admin", "manager"],
  "/manager/analytics/students": ["superadmin", "admin", "manager", "lecturer"],
}
```

Acceptance:

- Sidebar và route guard dùng cùng policy.
- Role label trong header Việt hóa:
  - `superadmin` -> `Superadmin`
  - `admin` -> `Quản trị`
  - `manager` -> `Quản lý`
  - `lecturer` -> `Giảng viên`
  - `viewer` -> `Người xem`

## 5. P2 làm để hệ thống nổi bật hơn

### P2-01. Prerequisite/Bottleneck Map

Database:

- Đã có `courses.prerequisite_note`; nếu muốn tốt hơn cần bảng quan hệ:

```text
course_prerequisites(course_id, prerequisite_course_id, relation_type, min_grade)
```

BE:

```text
GET /api/v1/analytics/curriculum/bottlenecks
GET /api/v1/analytics/courses/{id}/downstream-impact
```

FE:

- Course page hiển thị môn tiên quyết và môn bị ảnh hưởng phía sau.
- Program page có `Môn nút thắt`.

Giá trị giáo dục:

- Không chỉ biết môn nào trượt nhiều, mà biết môn nào làm chậm tiến độ học tập.

### P2-02. Outcome Assessment official workflow

Hiện trạng:

- CLO/PLO đã có model và report enrichment.
- Chưa có versioning/approval/run chính thức.

Database:

```text
obe.outcome_versions
obe.outcome_review_cycles
obe.outcome_approval_logs
obe.assessment_runs
obe.assessment_run_items
```

BE:

```text
GET /api/v1/outcomes/readiness
POST /api/v1/outcomes/runs
GET /api/v1/outcomes/runs/{id}
POST /api/v1/outcomes/mappings/{id}/approve
```

FE:

- `CLO/PLO` không nên là dashboard trang trí; cần workflow:
  - kiểm tra mapping;
  - khóa version;
  - chạy assessment;
  - trace evidence;
  - xuất báo cáo kiểm định.

Acceptance:

- Nếu mapping chưa duyệt, UI gắn nhãn `Thử nghiệm`.
- Báo cáo kiểm định có version và evidence trail.

### P2-03. What-if Simulation

BE:

```text
POST /api/v1/simulation/student-credit
POST /api/v1/simulation/course-intervention
```

Ví dụ:

- Nếu sinh viên đạt 6.5 môn này thì GPA kỳ thay đổi thế nào?
- Nếu mở phụ đạo giảm fail rate môn X 10%, số sinh viên rủi ro giảm bao nhiêu?

Giá trị:

- Đây là tính năng demo rất mạnh vì chuyển từ descriptive analytics sang decision support.

## 6. Agent và AI cần chỉnh

### 6.1. Hạn chế SQL tool quá rộng

Hiện trạng:

- `backend/app/agent/tools.py` có `execute_sql_query(query)` cho SELECT bất kỳ, chỉ chặn DML/DDL bằng regex và giới hạn 50 dòng.

Rủi ro:

- Agent có thể đọc bảng ngoài scope nếu prompt/tool query không gắn user context.
- Regex SELECT không đủ để enforce domain/RBAC.

Đề xuất:

- Giữ SQL tool cho dev/eval hoặc admin-only.
- Với production chat, ưu tiên tool typed:

```text
get_school_overview(scope)
get_department_health(department_id, semester_code)
get_program_health(program_id, semester_code)
get_course_health(course_id, semester_code)
get_section_risk(section_id)
get_student_risk_profile(student_id)
get_dropout_prediction(student_id)
explain_metric(metric_key, scope)
create_task(...)
create_intervention(...)
```

Mỗi tool nhận `current_user` hoặc context scope do backend validate, không để LLM tự viết SQL.

### 6.2. Agent context phải theo chart/entity

FE cần chuẩn hóa context khi bấm `Hỏi AI`:

```json
{
  "source": "dashboard",
  "route": "/manager/analytics/sections",
  "entity": { "type": "section", "id": 300 },
  "metric": { "key": "section_pass_rate" },
  "filters": { "semester_code": "2025-2" }
}
```

BE/Agent:

- Router dùng context để chọn tool.
- Response bắt buộc trả:
  - số liệu dùng;
  - scope;
  - sample size;
  - link drill-down;
  - next action.

### 6.3. Write action luôn cần confirmation

Áp dụng cho:

- tạo task;
- tạo intervention;
- tạo report snapshot;
- schedule report;
- export/send report.

Report Agent đã đi đúng hướng với pending action. Cần dùng pattern này cho task/intervention.

## 7. Observability cần bổ sung

Hiện trạng tốt:

- `obs.event_log`, session, request_id, trace_id, page_view, HTTP, agent/tool.
- Superadmin API đã có.

Cần bổ sung event FE:

```text
filter_change
entity_open
chart_select
drilldown_open
report_plan_created
report_snapshot_confirmed
task_created
intervention_created
intervention_followup_completed
```

FE cần gắn:

- `analytics/page.tsx`: filter, click khoa/ngành/heatmap.
- `departments/page.tsx`: chọn khoa, mở course/section.
- `programs/page.tsx`: chọn ngành, mở course.
- `sections/page.tsx`: mở lớp, mở sinh viên risk.
- `students/page.tsx`: mở course/section từ transcript.
- `reports/page.tsx`: tạo/confirm report.

Acceptance:

- Superadmin có thể trace:

```text
page_view
-> filter_change
-> entity_open(section)
-> report_plan_created
-> report_snapshot_confirmed
-> task_created
```

## 8. Test và verify cần thêm

Backend tests:

- Section write RBAC.
- Course aggregate API scope.
- Section risk list scope.
- Student risk profile scope.
- Task/intervention lifecycle.
- Report action -> create task confirmation.
- DQ issue creation/resolution.
- Agent tool không vượt scope.

Frontend tests:

- Sidebar/route policy theo role.
- Preloader không gọi raw large endpoints.
- Course page dùng aggregate API.
- Section risk row mở student profile.
- Teacher assignment dialog.
- Student search combobox.
- Report confirm tạo snapshot và link đúng.

E2E:

```text
manager login
-> Tổng quan
-> mở ngành rủi ro
-> mở môn bottleneck
-> mở lớp yếu
-> mở sinh viên risk
-> tạo intervention task
-> tạo report
-> hỏi AI action plan
```

Verify commands:

```powershell
.\scripts\verify.ps1 -Quick
cd backend; pytest tests/test_sections.py tests/test_dropout_api.py tests/test_observability_admin.py -q
cd frontend; npm run lint; npm test
```

## 9. Backlog đề xuất

| ID | Ưu tiên | Việc | BE | FE | DB/ETL | Test |
|---|---:|---|---|---|---|---|
| R25-01 | P0 | Cắt raw dashboard preload | - | sửa preloader | - | FE unit/mock fetch |
| R25-02 | P0 | Course aggregate API | endpoint dashboard courses | đổi courses page | index/query DWH | backend + FE |
| R25-03 | P0 | Section aggregate + risk list | endpoint sections/risk-students | đổi sections page | join DWH + ML | backend + FE |
| R25-04 | P0 | Section write RBAC | can_write_section, teacher scope | enable assignment UI | - | RBAC pytest |
| R25-05 | P0 | Task/intervention MVP | tasks/interventions APIs | task UI + section/student action | ops schema migration | lifecycle tests |
| R25-06 | P1 | Student risk profile API | endpoint + search | student detail/search | join DWH + ML + ops | scope tests |
| R25-07 | P1 | Daily brief/insights | brief/insights APIs | landing action queue | metric snapshots | e2e |
| R25-08 | P1 | Data Quality Center | DQ APIs | admin DQ page | dq schema/checks | DQ tests |
| R25-09 | P1 | Metric explanation | explain endpoint | explain panel | metric registry | unit |
| R25-10 | P1 | Route policy map | - | shared policy + role labels | - | FE tests |
| R25-11 | P2 | Bottleneck/prerequisite map | curriculum APIs | program/course map | prerequisite table | integration |
| R25-12 | P2 | Outcome official workflow | outcomes APIs | CLO/PLO workflow | obe schema | assessment tests |
| R25-13 | P2 | What-if simulation | simulation APIs | simulation panel | optional snapshots | model tests |

## 10. Thứ tự triển khai khuyến nghị

1. Cắt preload raw lớn để app nhẹ ngay.
2. Làm aggregate API cho course và section, sau đó đổi FE tương ứng.
3. Siết write RBAC `sections` trước khi mở UI phân công lớp.
4. Thêm task/intervention MVP để risk có hành động thật.
5. Làm student risk profile đọc DWH + ML + intervention history.
6. Thêm Daily Brief làm landing điều hành.
7. Bổ sung Data Quality Center và metric explanation.
8. Sau khi workflow ổn, mới mở rộng CLO/PLO official và what-if simulation.

## 11. Định nghĩa hoàn thành cho docs25

Hệ thống được xem là tinh chỉnh đúng hướng khi:

- Dashboard điều hành không tải raw enrollment lớn ở frontend.
- Course/section/student analytics đều có aggregate/detail API có RBAC.
- Mọi risk quan trọng có evidence, owner, action và status.
- Report action plan có thể biến thành task/intervention thật.
- Agent chỉ gọi typed tools có scope, không dựa vào SQL tự do cho production.
- Dữ liệu thiếu/sai được surfacing ở dashboard/report, không bị giấu.
- Lecturer có flow rõ: lớp của tôi -> SV cần chú ý -> can thiệp -> follow-up.
- Manager có flow rõ: brief hôm nay -> drill-down -> giao việc -> theo dõi -> báo cáo.
