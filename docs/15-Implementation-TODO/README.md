# TODO triển khai lại AI Learning Analytics

Tài liệu này là backlog cụ thể để sửa hệ thống theo thiết kế mới ở [Learning Analytics Workflow](../14-Outcome-Workflow/README.md).

Mục tiêu: chuyển sản phẩm từ các dashboard rời rạc sang hệ thống **AI Learning Analytics có workflow**, có giải thích chỉ số, agent tool calling, task can thiệp và dashboard riêng theo actor.

## 1. Ưu tiên tổng thể

| Priority | Nhóm việc | Lý do |
| --- | --- | --- |
| P0 | Sửa dữ liệu nền khoa-ngành-môn | Dữ liệu sai làm mọi filter/dashboard sai |
| P0 | Chuẩn hóa metric explanation | Actor phải hiểu chỉ số ngay khi hover/click |
| P0 | Tách Learning Analytics khỏi CLO/PLO | CLO/PLO không phải module chính |
| P1 | Xây Daily Brief MVP | Tạo khác biệt: hệ thống tự chỉ ra việc cần làm |
| P1 | Xây task workflow MVP | Insight phải biến thành hành động |
| P1 | Tách dashboard theo role | Manager/lecturer/admin không dùng chung một luồng |
| P2 | Agent tool calling có kiểm soát | Agent hỏi sâu và hoàn thành việc, không bịa số |
| P2 | Outcome Assessment chuẩn hóa | Làm lại CLO/PLO sau khi dữ liệu đúng |

## 2. P0 - Sửa dữ liệu nền

### 2.1. Tạo inventory khoa-ngành-môn

Việc cần làm:

- Xuất danh sách `departments`.
- Xuất danh sách `programs` kèm `department_id` hiện tại.
- Xuất danh sách `courses` kèm khoa quản lý môn.
- Xuất quan hệ `program_courses`.
- Tạo file rà soát trong `docs/15-Implementation-TODO/data-audit-program-course.md`.

Output mong muốn:

- Biết ngành nào đang gán sai khoa.
- Biết môn nào đang gán sai khoa.
- Biết môn nào thuộc nhiều ngành.
- Có cột trống để người dùng điền `Khoa đúng`, `Ngành đúng`, `Ghi chú`.

Code/data liên quan:

- `programs.department_id`
- `courses.department_id`
- `program_courses`
- `backend/db/init-data.sql`
- migration backfill department/course nếu cần

### 2.2. Sửa filter dựa trên dữ liệu đúng

Hiện trạng:

- Một số filter đang phụ thuộc `program.department_id`.
- DB có ngành bị gán sai khoa, ví dụ có ngành kỹ thuật nằm trong khoa không phù hợp.

Cần sửa:

- Filter `Khoa` phải ghi rõ là:
  - `Khoa quản lý môn`, hoặc
  - `Khoa quản lý ngành`
  tùy màn hình.
- Không dùng một nhãn `Khoa` chung chung.
- Nếu lọc theo khoa quản lý môn, danh sách ngành phải suy từ `courses.department_id + program_courses`.
- Nếu lọc theo khoa quản lý ngành, phải dùng `programs.department_id` sau khi đã sửa dữ liệu.

Màn hình cần kiểm tra:

- `frontend/src/app/(dashboard)/manager/analytics/page.tsx`
- `frontend/src/app/(dashboard)/manager/analytics/programs/page.tsx`
- `frontend/src/app/(dashboard)/manager/analytics/courses/page.tsx`
- `frontend/src/app/(dashboard)/manager/analytics/outcomes/page.tsx`
- các trang CRUD khoa/ngành/môn

## 3. P0 - Metric explanation pattern

### 3.1. Tạo component dùng chung

Cần tạo:

```text
frontend/src/components/analytics/metric-explain-card.tsx
frontend/src/components/analytics/metric-explain-panel.tsx
frontend/src/components/analytics/ask-agent-button.tsx
frontend/src/components/analytics/metric-tooltip.tsx
```

Mục tiêu:

- Mọi KPI/card/chart/table cell có cùng cách giải thích.
- Không copy/paste logic tooltip và nút hỏi AI ở từng page.

Props đề xuất:

```ts
type MetricExplainPayload = {
  metricKey: string
  label: string
  value: string | number
  unit?: string
  formula: string
  source: string
  interpretation?: string
  scope: {
    level: "school" | "department" | "program" | "course" | "section" | "student" | "outcome"
    id?: string | number
    label?: string
  }
  filters?: Record<string, string | number | null>
  sampleSize?: number
  warnings?: string[]
  drilldowns?: Array<{ label: string; href: string }>
}
```

Behavior:

- Hover: tooltip công thức ngắn.
- Click: mở panel chi tiết.
- Nút `Hỏi AI`: mở `/chat?q=...` với context.
- Nút `Tạo task`: sau này gọi task workflow.

### 3.2. Áp dụng vào các dashboard hiện có

Thứ tự áp dụng:

1. `/manager/analytics`
2. `/manager/analytics/programs`
3. `/manager/analytics/courses`
4. `/manager/analytics/sections`
5. `/manager/analytics/students`
6. `/manager/analytics/outcomes`

Mỗi metric cần có:

- Label rõ.
- Công thức.
- Dữ liệu nguồn.
- Scope/filter đang áp dụng.
- Sample size.
- Cảnh báo dữ liệu nếu thiếu.
- Link drill-down.

## 4. P0 - Tách lại module Learning Analytics và CLO/PLO

### 4.1. Navigation mới

Manager sidebar nên đổi thành:

```text
Tổng quan hôm nay
Nhà trường
Khoa
Ngành
Môn học
Lớp học phần
Sinh viên rủi ro
Can thiệp & Task
CLO/PLO
Báo cáo & AI
Quản trị dữ liệu
```

Lecturer sidebar:

```text
Lớp của tôi
Sinh viên cần chú ý
Điểm & minh chứng
CLO môn học
Task được giao
AI hỗ trợ
```

Admin sidebar:

```text
Data Quality Center
Import dữ liệu
Khoa/Ngành/Môn
Người dùng & Role
Cấu hình kỳ phân tích
Audit log
```

File liên quan:

- `frontend/src/components/layout/app-sidebar.tsx`
- route trong `frontend/src/app/(dashboard)/...`

### 4.2. Đánh nhãn CLO/PLO hiện tại là experimental

Vì CLO/PLO hiện đang seed tự động:

- Trang `/manager/analytics/outcomes` phải hiển thị banner:
  `Dữ liệu CLO/PLO hiện là experimental, chưa dùng cho kết luận học thuật chính thức.`
- Không đưa CLO/PLO làm dashboard trung tâm.
- Chỉ dùng để demo workflow explainability/tool calling.

## 5. P1 - Daily Brief MVP

### 5.1. Backend API

Cần endpoint:

```text
GET /api/v1/analytics/brief
```

Response đề xuất:

```json
{
  "generated_at": "2026-06-17T00:00:00Z",
  "role": "manager",
  "items": [
    {
      "id": "insight-001",
      "severity": "high",
      "title": "Khoa CNTT có 2 môn tăng fail rate",
      "scope_type": "department",
      "scope_id": 5,
      "metric_key": "fail_rate",
      "value": 18.4,
      "delta": 6.2,
      "formula": "Enrollment trượt / enrollment có kết quả",
      "sample_size": 1240,
      "actions": ["drill_down", "ask_agent", "create_task"]
    }
  ]
}
```

Nguồn dữ liệu ban đầu:

- health score views hiện có.
- enrollments.
- students.
- courses.
- sections.

### 5.2. Frontend page

Route đề xuất:

```text
/manager/daily-brief
```

UI cần có:

- Danh sách việc cần chú ý hôm nay.
- Filter theo khoa/học kỳ/severity.
- Mỗi item có:
  - công thức hover,
  - click xem giải thích,
  - hỏi AI,
  - tạo task,
  - drill-down.

## 6. P1 - Task workflow MVP

### 6.1. Backend data model

Tạo bảng:

```text
analytics_tasks
task_comments
task_status_history
```

Trường chính:

```text
id
task_type
priority
scope_type
scope_id
source_metric
source_value
reason
assignee_id
created_by
deadline
status
resolution_note
created_at
updated_at
closed_at
```

Status:

```text
open
assigned
in_progress
submitted
reviewed
closed
```

### 6.2. Backend API

```text
GET /api/v1/tasks
POST /api/v1/tasks
PATCH /api/v1/tasks/{id}
POST /api/v1/tasks/{id}/comments
POST /api/v1/tasks/{id}/submit
POST /api/v1/tasks/{id}/review
POST /api/v1/tasks/{id}/close
```

### 6.3. Frontend UI

Routes:

```text
/manager/tasks
/lecturer/tasks
/admin/tasks
```

UI:

- Kanban hoặc table theo status.
- Filter theo assignee, priority, scope.
- Create task từ metric/insight.
- Comment và resolution note.
- Link về dashboard nguồn.

## 7. P1 - Lecturer workflow

### 7.1. Trang lớp của tôi

Route:

```text
/lecturer/classes
```

Cần hiển thị:

- Lớp học phần giảng viên phụ trách.
- Risk status từng lớp.
- Pass/fail rate.
- Điểm trung bình.
- Số sinh viên nguy cơ.
- Task liên quan.

### 7.2. Trang chi tiết lớp

Route:

```text
/lecturer/classes/[sectionId]
```

Cần có:

- Danh sách sinh viên.
- Điểm thành phần.
- Sinh viên rủi ro.
- Metric explanation.
- Nút hỏi AI.
- Nút tạo intervention note.

### 7.3. Intervention note

Cần model/API:

```text
student_interventions
GET /api/v1/students/{id}/interventions
POST /api/v1/students/{id}/interventions
```

## 8. P2 - Agent tool calling

### 8.1. Tool registry backend

Cần chuẩn hóa tool:

```text
explain_metric
find_root_causes
compare_periods
get_student_risk_profile
create_task
create_intervention
generate_report
get_data_quality_summary
```

### 8.2. Chat context

Hiện có `/chat?q=...`.

Cần nâng cấp:

- Nhận thêm context object nếu mở từ metric.
- Lưu source metric trong message.
- Agent trả lời kèm nguồn dữ liệu/tool đã gọi.
- Nếu action thay đổi dữ liệu, yêu cầu xác nhận.

Frontend:

- `AskAgentButton` build query từ `MetricExplainPayload`.
- Sau này có thể chuyển từ query string sang session/context store.

## 9. P2 - Data Quality Center

Route:

```text
/admin/data-quality
```

Checks cần có:

- Ngành gán sai khoa.
- Môn thiếu khoa quản lý.
- Môn thuộc nhiều ngành bất thường.
- Lớp thiếu giảng viên.
- Enrollment thiếu điểm.
- Sinh viên thiếu ngành/khóa.
- CLO/PLO mapping chưa xác nhận.

Actions:

- Export inventory.
- Mark issue resolved.
- Create data-fix task.
- Apply safe migration/backfill sau khi duyệt.

## 10. P2 - Outcome Assessment làm lại sau

Chỉ làm lại CLO/PLO khi:

- Khoa-ngành-môn đã đúng.
- CLO chính thức đã nhập.
- PLO chính thức đã nhập.
- Mapping CLO-PLO đã được duyệt.
- Mapping điểm-CLO đã được duyệt.

Việc cần làm:

- Versioning CLO/PLO.
- Approval workflow.
- Assessment runs.
- Evidence trace.
- Báo cáo kiểm định.

## 11. Quick fixes cần làm ngay trong code

| File | Việc cần sửa |
| --- | --- |
| `frontend/src/app/(dashboard)/manager/analytics/outcomes/page.tsx` | Tách metric explain thành component dùng chung |
| `frontend/src/components/layout/app-sidebar.tsx` | Rebuild navigation theo role/module mới |
| `frontend/src/lib/api.ts` | Thêm API types cho brief/task/intervention/metric explanation |
| `backend/app/api/v1/endpoints/analytics.py` | Thêm endpoint brief và explain metric |
| `backend/app/models` | Thêm task/intervention/insight models |
| `backend/migrations/versions` | Migration cho task/intervention/insight |
| `docs/README.md` | Giữ link workflow 14 và TODO 15 |
| `README.md` | Normalize encoding và đưa link workflow/TODO lên đầu |

## 12. Definition of Done

Một màn hình analytics được coi là đạt workflow mới khi:

- Có role rõ.
- Có scope/filter rõ nhãn.
- KPI có tooltip công thức khi hover.
- Click KPI mở panel giải thích.
- Có nút hỏi AI cạnh chỉ số.
- AI nhận context chỉ số cụ thể.
- Có drill-down liên quan.
- Có thể tạo task từ insight.
- Có cảnh báo data quality nếu dữ liệu thiếu/sai.

