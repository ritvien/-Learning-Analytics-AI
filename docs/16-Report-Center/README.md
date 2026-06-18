# Report Center - thiết kế báo cáo AI Learning Analytics

Tài liệu này mô tả module **Report Center** cho hệ thống AI Learning Analytics. Mục tiêu không phải là "Export Dashboard to PDF", mà là một trung tâm báo cáo có khả năng:

```text
Chọn mẫu báo cáo
→ chọn phạm vi/thời gian
→ hệ thống tính metric
→ AI sinh narrative
→ chỉ ra nguyên nhân
→ đề xuất action
→ lưu snapshot
→ xuất Web/PDF/Excel
→ gửi đúng stakeholder
→ theo dõi action sau báo cáo
```

## 1. Tư duy sản phẩm

Report Center phải khác dashboard ở điểm:

- Dashboard giúp xem và drill-down realtime.
- Report giúp chốt một **snapshot có version**, có narrative, có bằng chứng, có action list.
- Report không chỉ "mô tả tình hình", mà phải trả lời:
  - Điều gì đang tốt?
  - Điều gì đang xấu?
  - Vì sao xấu?
  - Ai chịu trách nhiệm xử lý?
  - Hành động tiếp theo là gì?
  - Báo cáo này có đủ tin để gửi chính thức không?

## 2. Giao diện Report Center - 5 tab

### Tab 1: Report Templates

Mục tiêu: người dùng chọn đúng loại báo cáo theo công việc, không phải tự nghĩ nên export dashboard nào.

| Template | Mục đích | Actor chính | Tần suất gợi ý |
| --- | --- | --- | --- |
| Weekly Class Risk Report | Báo cáo rủi ro lớp theo tuần | Lecturer, cố vấn | Hằng tuần |
| Course CLO Report | Báo cáo CLO học phần | Lecturer, trưởng bộ môn | Giữa kỳ/cuối kỳ |
| Program PLO Report | Báo cáo PLO ngành | Trưởng ngành, manager | Cuối kỳ/năm |
| Faculty Performance Report | Báo cáo khoa | Trưởng khoa, manager | Hằng tháng/cuối kỳ |
| School Executive Report | Báo cáo toàn trường | Ban giám hiệu, manager | Hằng tháng/cuối kỳ |
| Student Outcome Profile | Báo cáo cá nhân sinh viên | Cố vấn, lecturer | Khi cần can thiệp |
| Accreditation Evidence Report | Báo cáo kiểm định | QA, phòng đào tạo | Theo đợt kiểm định |
| Outcome Gap Report | Báo cáo khoảng cách chuẩn đầu ra | Manager, trưởng ngành | Giữa kỳ/cuối kỳ |
| Course Improvement Report | Báo cáo cải tiến học phần | Lecturer, trưởng bộ môn | Sau mỗi kỳ |

Mỗi template cần hiển thị:

- Mục đích.
- Ai dùng.
- Dữ liệu cần có.
- Mức độ sẵn sàng dữ liệu.
- Format hỗ trợ.
- Ví dụ action list sẽ sinh ra.

### Tab 2: Generate Report

Form tạo báo cáo:

| Field | Ví dụ | Ghi chú |
| --- | --- | --- |
| Loại báo cáo | Program PLO Report | Chọn từ template |
| Phạm vi | Ngành Hệ thống thương mại điện tử | Scope tùy report |
| Thời gian | Học kỳ 2025-2026.1 | ngày/tuần/tháng/học kỳ/năm |
| Định dạng | Web + PDF + Excel | MVP: Web, PDF, Excel |
| Mức chi tiết | Summary / Standard / Detailed | ảnh hưởng narrative và appendix |
| AI narrative | Có/Không | dùng LLM polish nhưng phải có nguồn |
| Appendix dữ liệu | Có/Không | Excel hoặc bảng chi tiết |
| Audience | Lecturer/Manager/BGH/QA | điều chỉnh tone và độ chi tiết |

Nút hành động:

- `Preview`: render realtime, chưa lưu bản chính thức.
- `Generate Final Report`: tạo snapshot, version, status `final`.
- `Schedule Report`: đặt lịch sinh tự động.
- `Send to Stakeholders`: gửi cho người nhận phù hợp.

Rule quan trọng:

- Preview có thể thay đổi theo dữ liệu realtime.
- Final report phải lưu snapshot để mở lại không đổi số.
- Nếu dữ liệu thiếu hoặc chưa được duyệt, report phải có cảnh báo data quality.

### Tab 3: Scheduled Reports

Mục tiêu: tự động sinh/gửi báo cáo theo chu kỳ.

| Báo cáo | Tần suất | Người nhận |
| --- | --- | --- |
| Weekly Class Risk | Thứ 2 hằng tuần | Giảng viên, cố vấn |
| Monthly Faculty Report | Ngày 1 hằng tháng | Trưởng khoa |
| Midterm Outcome Report | Tuần giữa kỳ | Phòng đào tạo |
| End-semester PLO Report | Cuối kỳ | Ban giám hiệu, QA |

Mỗi schedule cần có:

- Template.
- Scope.
- Frequency.
- Timezone.
- Recipients.
- Output formats.
- Last run.
- Next run.
- Status: active/paused/failed.
- Failure reason.

### Tab 4: Report Library

Mục tiêu: lưu toàn bộ báo cáo đã tạo, có version và trạng thái.

Filter:

- Loại báo cáo.
- Khoa.
- Ngành.
- Môn.
- Lớp.
- Học kỳ.
- Người tạo.
- Trạng thái.

Trạng thái:

| Status | Ý nghĩa |
| --- | --- |
| Draft | Bản nháp, chưa gửi chính thức |
| Final | Bản chính thức đã generate |
| Approved | Đã duyệt |
| Archived | Lưu trữ |
| Failed | Generate lỗi |

Library cần hỗ trợ:

- Xem report web.
- Tải PDF.
- Tải Excel appendix.
- Xem metric snapshot.
- Xem narrative snapshot.
- Xem action list trích xuất.
- Xem lịch sử duyệt/gửi.

### Tab 5: Insights & Actions

Đây là phần "wow" thật sự.

Report sinh ra action list, không chỉ file PDF.

| Vấn đề | Đối tượng | Mức độ | Hành động đề xuất | Người phụ trách |
| --- | --- | --- | --- | --- |
| PLO3 thấp | Ngành CNTT | Cao | Rà soát môn CSDL, CNPM | Trưởng ngành |
| CLO2 yếu | Môn CSDL | Cao | Bổ sung lab ERD | Giảng viên |
| 24 SV nguy cơ | Lớp CSDL01 | Trung bình | Cố vấn liên hệ | CVHT |

Action có thể chuyển thành task:

```text
Report insight
→ suggested action
→ create task
→ assign owner
→ track status
→ report follow-up
```

## 3. Cấu trúc một báo cáo chuẩn

Một báo cáo "xịn" nên có cấu trúc:

### 3.1. Cover / Metadata

- Tên báo cáo.
- Report type.
- Scope.
- Period.
- Generated by.
- Generated at.
- Version.
- Status.
- Audience.

### 3.2. Executive Summary

- 3-5 điểm chính.
- Tình trạng tổng thể.
- Rủi ro lớn nhất.
- Cơ hội cải thiện.
- Action ưu tiên.

### 3.3. Data Readiness & Quality

- Dữ liệu đã đủ chưa.
- Số dòng dữ liệu dùng.
- Missing data.
- Mapping/approval status nếu liên quan CLO/PLO.
- Cảnh báo độ tin cậy.

### 3.4. Key Metrics

- KPI chính theo report.
- Công thức.
- Sample size.
- So sánh kỳ trước.
- Trend.

### 3.5. Detailed Analysis

Tùy report:

- School: khoa/ngành/môn/lớp rủi ro.
- Faculty: ngành/môn/lớp trong khoa.
- Program: PLO, môn bottleneck, cohort.
- Course: CLO, điểm thành phần, lớp.
- Section: sinh viên rủi ro, điểm thành phần.
- Student: hồ sơ học tập, môn/CLO/PLO yếu.

### 3.6. Root Cause Analysis

- Chỉ số nào kéo xuống.
- Đối tượng nào đóng góp nhiều nhất.
- Có bất thường dữ liệu không.
- Có thiếu evidence không.

### 3.7. AI Narrative

AI narrative phải dựa trên metric snapshot và tool outputs.

Không được viết chung chung. Phải có:

- Chỉ số cụ thể.
- Scope.
- Mẫu số.
- So sánh.
- Nguyên nhân.
- Mức độ tin cậy.

### 3.8. Recommendations

Khuyến nghị phải actionable:

- Làm gì.
- Cho đối tượng nào.
- Ai phụ trách.
- Deadline gợi ý.
- Evidence liên quan.

### 3.9. Action List

Mỗi action nên có:

```text
action_id
issue
scope_type
scope_id
severity
recommended_action
owner_role
suggested_assignee_id
due_date
source_metric
source_report_section
status
```

### 3.10. Appendix

- Bảng dữ liệu chi tiết.
- Metric definitions.
- Query/tool outputs.
- Danh sách sinh viên/lớp/môn nếu được phép.
- Version dữ liệu.

## 4. Các nhóm báo cáo cần hỗ trợ

### 4.1. School Executive Report

Audience:

- Ban giám hiệu.
- Phòng đào tạo.
- Manager cấp trường.

Nội dung:

- Tổng quan học tập toàn trường.
- Khoa/ngành rủi ro.
- Môn/lớp bất thường.
- Sinh viên nguy cơ.
- PLO/CLO cấp cao nếu dữ liệu đã xác nhận.
- Action list cấp trường.

### 4.2. Faculty Performance Report

Audience:

- Trưởng khoa.
- Phó khoa.
- Quản lý đào tạo cấp khoa.

Nội dung:

- GPA/pass/fail/retake trong khoa.
- So sánh ngành trong khoa.
- Môn bottleneck.
- Lớp bất thường.
- Giảng viên/lớp cần hỗ trợ.
- Action list cho khoa.

### 4.3. Program PLO Report

Audience:

- Trưởng ngành.
- Hội đồng chương trình.
- QA/kiểm định.

Nội dung:

- PLO attainment.
- PLO trend.
- PLO x cohort/course heatmap.
- Course contribution.
- Weak PLO analysis.
- Evidence strength.
- Action plan cải tiến CTĐT.

Điều kiện:

- Chỉ dùng chính thức khi CLO/PLO/mapping đã approved/locked.
- Nếu chưa, report phải gắn nhãn experimental.

### 4.4. Course CLO Report

Audience:

- Giảng viên.
- Trưởng bộ môn.
- QA học phần.

Nội dung:

- Tổng quan môn.
- CLO attainment.
- Điểm thành phần.
- Component bottleneck.
- So sánh lớp học phần.
- Sinh viên chưa đạt CLO.
- Khuyến nghị cải tiến học phần.

### 4.5. Weekly Class Risk Report

Audience:

- Giảng viên.
- Cố vấn học tập.

Nội dung:

- Điểm lớp.
- Sinh viên nguy cơ.
- Điểm thành phần yếu.
- Rủi ro sớm.
- Gợi ý can thiệp tuần này.

### 4.6. Student Outcome Profile

Audience:

- Cố vấn.
- Giảng viên.
- Sinh viên nếu được phép.

Nội dung:

- GPA/tín chỉ.
- Môn đã rớt hoặc nguy cơ rớt.
- CLO/PLO yếu nếu có dữ liệu.
- Lộ trình hỗ trợ.
- Intervention history.

### 4.7. Accreditation Evidence Report

Audience:

- QA.
- Phòng khảo thí/đảm bảo chất lượng.
- Hội đồng kiểm định.

Nội dung:

- PLO/CLO chính thức.
- Mapping matrix.
- Evidence strength.
- Assessment runs.
- Improvement actions.
- Approval logs.

### 4.8. Outcome Gap Report

Audience:

- Manager.
- Trưởng ngành.
- Trưởng khoa.

Nội dung:

- PLO/CLO yếu.
- Khoảng cách so với target.
- Môn/lớp đóng góp.
- Action cần xử lý.

### 4.9. Course Improvement Report

Audience:

- Giảng viên.
- Trưởng bộ môn.

Nội dung:

- Môn yếu ở đâu.
- CLO/điểm thành phần yếu.
- So sánh nhiều kỳ.
- Đề xuất cải tiến bài giảng/assignment/rubric.

## 5. DB cần bổ sung

Hiện hệ thống đã có bảng `reports` và `report_feedback`, nhưng còn thiếu nhiều thành phần để thành Report Center.

### 5.1. report_templates

```text
id
code
name
description
report_group
default_audience
supported_formats
required_scope_types
default_detail_level
requires_ai_narrative
requires_appendix
is_active
created_at
updated_at
```

### 5.2. report_runs

Dùng để lưu mỗi lần preview/final generate.

```text
id
template_id
report_id
run_type              -- preview/final/scheduled
status                -- pending/running/success/failed
scope_type
scope_id
period_type
period_id
period_start
period_end
detail_level
formats
requested_by
started_at
finished_at
error_message
```

### 5.3. report_snapshots

Lưu dữ liệu đóng băng của report.

```text
id
report_id
metric_snapshot_json
narrative_snapshot
data_quality_snapshot_json
tool_outputs_json
version
created_at
```

### 5.4. report_files

```text
id
report_id
file_type             -- web/pdf/docx/xlsx/pptx
file_url
file_name
mime_type
file_size
created_at
```

### 5.5. report_schedules

```text
id
template_id
scope_type
scope_id
period_type
frequency             -- daily/weekly/monthly/midterm/end_semester/annual/custom
cron_expression
timezone
formats
detail_level
include_ai_narrative
include_appendix
status                -- active/paused/failed
created_by
next_run_at
last_run_at
created_at
updated_at
```

### 5.6. report_recipients

```text
id
schedule_id
report_id
user_id
email
role
delivery_channel      -- in_app/email/download
delivery_status       -- pending/sent/failed
sent_at
error_message
```

### 5.7. report_actions

Action list trích xuất từ report.

```text
id
report_id
issue
scope_type
scope_id
severity              -- low/medium/high/critical
recommended_action
owner_role
suggested_assignee_id
source_metric
source_section
status                -- suggested/accepted/task_created/dismissed/done
linked_task_id
created_at
updated_at
```

### 5.8. report_approvals

```text
id
report_id
reviewer_id
status                -- approved/rejected/request_changes
comment
created_at
```

### 5.9. report_audit_logs

```text
id
report_id
actor_id
event_type            -- created/generated/downloaded/sent/approved/archived
event_payload_json
created_at
```

## 6. API cần bổ sung

### 6.1. Templates

```text
GET /api/v1/report-center/templates
GET /api/v1/report-center/templates/{template_id}
POST /api/v1/report-center/templates
PATCH /api/v1/report-center/templates/{template_id}
```

### 6.2. Generate report

```text
POST /api/v1/report-center/preview
POST /api/v1/report-center/generate
GET /api/v1/report-center/runs/{run_id}
```

Request:

```json
{
  "template_code": "program_plo_report",
  "scope_type": "program",
  "scope_id": 2,
  "period_type": "semester",
  "period_id": 6,
  "formats": ["web", "pdf", "xlsx"],
  "detail_level": "standard",
  "include_ai_narrative": true,
  "include_appendix": true,
  "audience": "manager"
}
```

### 6.3. Report Library

```text
GET /api/v1/report-center/reports
GET /api/v1/report-center/reports/{report_id}
PATCH /api/v1/report-center/reports/{report_id}/status
GET /api/v1/report-center/reports/{report_id}/files
GET /api/v1/report-center/reports/{report_id}/snapshot
```

Filters:

```text
report_type
department_id
program_id
course_id
section_id
student_id
semester_id
created_by
status
limit
offset
```

### 6.4. Scheduled Reports

```text
GET /api/v1/report-center/schedules
POST /api/v1/report-center/schedules
PATCH /api/v1/report-center/schedules/{schedule_id}
POST /api/v1/report-center/schedules/{schedule_id}/pause
POST /api/v1/report-center/schedules/{schedule_id}/resume
POST /api/v1/report-center/schedules/{schedule_id}/run-now
```

### 6.5. Insights & Actions

```text
GET /api/v1/report-center/actions
GET /api/v1/report-center/reports/{report_id}/actions
POST /api/v1/report-center/actions/{action_id}/accept
POST /api/v1/report-center/actions/{action_id}/dismiss
POST /api/v1/report-center/actions/{action_id}/create-task
PATCH /api/v1/report-center/actions/{action_id}
```

### 6.6. Approval & delivery

```text
POST /api/v1/report-center/reports/{report_id}/approve
POST /api/v1/report-center/reports/{report_id}/request-changes
POST /api/v1/report-center/reports/{report_id}/archive
POST /api/v1/report-center/reports/{report_id}/send
```

### 6.7. Agent integration

```text
POST /api/v1/report-center/reports/{report_id}/ask
POST /api/v1/report-center/reports/{report_id}/regenerate-narrative
POST /api/v1/report-center/actions/suggest
```

## 7. Report Agent cần xây như thế nào?

Report Agent không nên chỉ là chatbot trả lời chung chung. Nó cần là **agent có tool calling bám vào Report Center**, phục vụ 4 việc:

```text
1. Giải thích báo cáo
2. Tạo narrative/action list
3. Hỏi sâu theo metric/scope
4. Chuyển insight thành task/can thiệp/báo cáo kế tiếp
```

### 7.1. Vai trò của Report Agent

Agent hỗ trợ trong Report Center theo các tình huống:

| Tình huống | Người dùng hỏi | Agent phải làm |
| --- | --- | --- |
| Explain report | "Vì sao báo cáo kết luận khoa này rủi ro?" | Gọi tool lấy snapshot, metric, action list rồi giải thích |
| Explain metric | "Pass rate này tính từ đâu?" | Gọi `explain_report_metric` và trả công thức, mẫu số, nguồn |
| Root cause | "PLO3 thấp do môn nào?" | Gọi trace/drill-down tool |
| Improve narrative | "Viết lại phần summary cho trưởng khoa" | Dựa trên snapshot, không tự bịa số |
| Suggest actions | "Từ report này cần làm gì?" | Sinh action candidates có owner/severity |
| Create task | "Tạo task cho trưởng ngành xử lý PLO3" | Hỏi xác nhận rồi gọi task API |
| Schedule report | "Hẹn báo cáo này mỗi tháng" | Hỏi lịch/người nhận rồi tạo schedule |
| Compare reports | "So với tháng trước xấu hơn ở đâu?" | Gọi tool so sánh 2 snapshot |

### 7.2. Nguyên tắc bắt buộc

1. **Agent chỉ được trả lời dựa trên report snapshot/tool output.**
   Không tự tạo số liệu ngoài nguồn.

2. **Mọi câu trả lời phải có source.**
   Source tối thiểu gồm: `report_id`, `snapshot_id`, `metric_key`, `scope`, `period`.

3. **Action thay đổi dữ liệu phải xác nhận.**
   Tạo task, gửi report, approve report, schedule report đều cần user confirm.

4. **Narrative phải giữ số liệu gốc.**
   LLM chỉ được diễn giải/polish, không được thay đổi metric.

5. **Nếu dữ liệu thiếu, phải nói thiếu.**
   Không được lấp khoảng trống bằng nhận định giả.

### 7.3. Tool registry cho Report Agent

Nhóm tool đọc report:

```text
get_report(report_id)
get_report_snapshot(report_id)
get_report_metrics(report_id)
get_report_actions(report_id)
get_report_files(report_id)
get_report_data_quality(report_id)
```

Nhóm tool giải thích:

```text
explain_report_metric(report_id, metric_key)
explain_report_section(report_id, section_key)
trace_report_metric(report_id, metric_key, drilldown_level)
compare_report_snapshots(report_id_a, report_id_b)
find_report_root_causes(report_id, metric_key)
```

Nhóm tool sinh nội dung:

```text
generate_report_narrative(report_id, audience, detail_level)
rewrite_report_section(report_id, section_key, tone, audience)
suggest_report_actions(report_id)
summarize_report_for_stakeholder(report_id, stakeholder_role)
```

Nhóm tool workflow:

```text
create_task_from_report_action(action_id, assignee_id, due_date)
accept_report_action(action_id)
dismiss_report_action(action_id, reason)
schedule_report(template_id, scope, frequency, recipients)
send_report(report_id, recipients, formats)
request_report_approval(report_id, reviewer_id)
approve_report(report_id, comment)
```

Nhóm tool tìm dữ liệu liên quan:

```text
search_reports(query, filters)
list_related_reports(scope_type, scope_id, period)
list_reports_by_template(template_code, filters)
```

### 7.4. API cần bổ sung riêng cho Agent

Hiện có chat API chung. Report Center nên có API agent riêng để truyền context tốt hơn.

```text
POST /api/v1/report-agent/sessions
GET /api/v1/report-agent/sessions/{session_id}
POST /api/v1/report-agent/sessions/{session_id}/messages
POST /api/v1/report-agent/ask
POST /api/v1/report-agent/stream
POST /api/v1/report-agent/tools/confirm
GET /api/v1/report-agent/tools
```

Request `POST /api/v1/report-agent/ask`:

```json
{
  "message": "Vì sao PLO3 trong báo cáo này thấp?",
  "context": {
    "report_id": "rep_123",
    "snapshot_id": "snap_456",
    "metric_key": "plo3_attainment",
    "scope_type": "program",
    "scope_id": 2,
    "period_id": 6
  },
  "mode": "explain",
  "allow_actions": false
}
```

Response:

```json
{
  "answer": "PLO3 thấp chủ yếu do...",
  "sources": [
    {
      "type": "report_snapshot",
      "id": "snap_456",
      "metric_key": "plo3_attainment"
    }
  ],
  "tool_calls": [
    {
      "tool": "get_report_snapshot",
      "status": "success"
    },
    {
      "tool": "find_report_root_causes",
      "status": "success"
    }
  ],
  "suggested_actions": [
    {
      "label": "Tạo task rà soát môn CSDL",
      "action_type": "create_task",
      "requires_confirmation": true
    }
  ]
}
```

API xác nhận action:

```text
POST /api/v1/report-agent/tools/confirm
```

```json
{
  "pending_action_id": "pa_123",
  "confirmed": true,
  "parameters": {
    "assignee_id": "user_456",
    "due_date": "2026-07-01"
  }
}
```

### 7.5. Database cần bổ sung cho Report Agent

Ngoài các bảng Report Center ở phần DB, agent cần lưu session, tool call và pending action.

#### report_agent_sessions

```text
id
user_id
report_id
context_json
status              -- active/closed
created_at
updated_at
```

#### report_agent_messages

```text
id
session_id
role                -- user/assistant/system/tool
content
context_json
created_at
```

#### report_agent_tool_calls

```text
id
session_id
message_id
tool_name
tool_input_json
tool_output_json
status              -- pending/running/success/failed
error_message
started_at
finished_at
```

#### report_agent_pending_actions

```text
id
session_id
message_id
action_type
action_payload_json
requires_confirmation
status              -- pending/confirmed/rejected/executed/failed
confirmed_by
confirmed_at
executed_at
error_message
```

#### report_agent_feedback

```text
id
session_id
message_id
rating
is_helpful
comment
created_at
```

### 7.6. Agent modes

Agent nên có mode rõ để tránh trả lời lan man.

| Mode | Mục đích | Tool được phép |
| --- | --- | --- |
| explain | Giải thích report/metric | read/explain tools |
| root_cause | Tìm nguyên nhân | read/explain/drill-down |
| narrative | Viết lại narrative | read + narrative tools |
| action_planning | Đề xuất action | read + suggest action |
| workflow | Tạo task/schedule/send | workflow tools, cần confirm |
| compare | So sánh report/kỳ | compare tools |

### 7.7. Prompt contract cho Agent

System prompt của Report Agent cần nhấn mạnh:

```text
Bạn là Report Agent cho hệ thống AI Learning Analytics.
Bạn chỉ được dùng dữ liệu từ tool output/report snapshot.
Không tự bịa số liệu, không đổi giá trị metric.
Nếu thiếu dữ liệu, nói rõ thiếu dữ liệu.
Mọi hành động thay đổi hệ thống phải yêu cầu xác nhận.
Luôn trả lời kèm nguồn: report_id, metric_key, scope, period.
```

Output nên theo cấu trúc:

```text
1. Trả lời ngắn gọn
2. Bằng chứng/số liệu
3. Nguyên nhân
4. Độ tin cậy/cảnh báo dữ liệu
5. Hành động đề xuất
6. Nguồn/tool đã dùng
```

### 7.8. Frontend cần bổ sung cho Agent

Trong Report Center:

- Nút `Ask AI` ở mỗi report.
- Nút `Ask AI` ở từng metric/section/action.
- Side panel chat theo report, không nhất thiết chuyển trang.
- Hiển thị tool calls đã dùng.
- Hiển thị sources.
- Nếu agent đề xuất action, hiển thị confirm card.

Components đề xuất:

```text
frontend/src/components/reports/report-agent-panel.tsx
frontend/src/components/reports/report-agent-source-list.tsx
frontend/src/components/reports/report-agent-tool-trace.tsx
frontend/src/components/reports/report-agent-confirm-action.tsx
```

### 7.9. Luồng ví dụ

Manager mở `Program PLO Report`, click `Ask AI` ở PLO3:

```text
User: Vì sao PLO3 thấp?
Agent:
  call get_report_snapshot(report_id)
  call explain_report_metric(report_id, "plo3_attainment")
  call find_report_root_causes(report_id, "plo3_attainment")
Answer:
  PLO3 đạt 62%, thấp hơn target 75%.
  Nguyên nhân chính đến từ CLO2/CLO4 của môn CSDL và CNPM.
  Có 184/430 sinh viên chưa đạt nhóm CLO liên quan.
  Đề xuất tạo task cho trưởng ngành rà soát 2 môn này.
Action:
  [Tạo task] [Xem drill-down] [Xuất evidence]
```

Lecturer mở `Course CLO Report`, hỏi:

```text
User: Tôi cần cải thiện gì cho CLO2?
Agent:
  call get_report_snapshot
  call trace_report_metric("clo2_attainment")
  call suggest_report_actions
Answer:
  CLO2 thấp do Assignment 1 và Final Q2.
  Đề xuất bổ sung lab ERD trước giữa kỳ và chỉnh rubric feedback.
```

## 8. Backend hướng xử lý

### 8.1. Report generation pipeline

```text
Validate request
→ resolve template
→ resolve scope/period
→ collect metrics
→ run data quality checks
→ build report sections
→ generate deterministic narrative
→ optional LLM polish
→ extract action list
→ render web report
→ export files nếu final
→ save snapshot/version
→ return report/run
```

### 8.2. Service structure đề xuất

```text
backend/app/reports/
├─ center_service.py
├─ templates.py
├─ collectors/
│  ├─ school.py
│  ├─ faculty.py
│  ├─ program.py
│  ├─ course.py
│  ├─ section.py
│  └─ student.py
├─ renderers/
│  ├─ web.py
│  ├─ pdf.py
│  └─ excel.py
├─ narrative.py
├─ actions.py
└─ schedules.py
```

### 8.3. Metric collectors

Mỗi report không nên tự query lung tung. Cần collector theo scope:

- `collect_school_metrics`
- `collect_faculty_metrics`
- `collect_program_metrics`
- `collect_course_metrics`
- `collect_section_metrics`
- `collect_student_metrics`
- `collect_outcome_metrics`

Collector trả về payload có:

```text
metrics
charts
tables
data_quality
drilldowns
source_refs
```

### 8.4. AI narrative

AI chỉ được polish hoặc phân tích dựa trên payload đã có.

Prompt phải truyền:

- report type.
- audience.
- scope.
- period.
- metric snapshot.
- warnings.
- requested detail level.

AI output nên là structured JSON:

```json
{
  "executive_summary": [],
  "strengths": [],
  "risks": [],
  "root_causes": [],
  "recommendations": [],
  "action_items": []
}
```

Nếu LLM lỗi:

- fallback deterministic narrative.
- report vẫn generate được.
- đánh dấu `llm_enhanced=false`.

### 8.5. Action extraction

Action không nên là text chết trong report.

Pipeline:

```text
metric risks
→ rule-based action candidates
→ optional AI wording
→ report_actions
→ user accept/dismiss/create-task
```

Ví dụ rule:

- PLO attainment < target: action review mapping/course contribution.
- CLO attainment < target: action review assessment component/rubric.
- Class fail rate > threshold: action lecturer intervention.
- Student risk high: action advisor follow-up.

## 9. Frontend hướng xử lý

### 9.1. Route mới

```text
frontend/src/app/(dashboard)/manager/report-center/page.tsx
```

Hoặc tách tab:

```text
/manager/report-center/templates
/manager/report-center/generate
/manager/report-center/schedules
/manager/report-center/library
/manager/report-center/actions
```

### 9.2. Components cần tạo

```text
frontend/src/components/reports/report-template-card.tsx
frontend/src/components/reports/report-generate-form.tsx
frontend/src/components/reports/report-preview.tsx
frontend/src/components/reports/report-schedule-table.tsx
frontend/src/components/reports/report-library-table.tsx
frontend/src/components/reports/report-action-list.tsx
frontend/src/components/reports/report-status-badge.tsx
frontend/src/components/reports/report-format-selector.tsx
```

### 9.3. UX yêu cầu

Tab 1:

- Card template rõ mục đích.
- Badge actor/frequency.
- Data readiness indicator.

Tab 2:

- Form generate.
- Preview live.
- Nút Generate Final.
- Nút Schedule.
- Nút Send.

Tab 3:

- Table schedule.
- Toggle pause/resume.
- Run now.

Tab 4:

- Table library.
- Filter nhiều chiều.
- Status badge.
- Download files.

Tab 5:

- Action list.
- Accept/dismiss.
- Create task.
- Ask AI.

## 10. Quyền truy cập

| Action | Manager | Trưởng khoa | Lecturer | Cố vấn | Admin |
| --- | --- | --- | --- | --- | --- |
| Xem template | yes | yes | yes | yes | yes |
| Generate school report | yes | no | no | no | yes |
| Generate faculty report | yes | own faculty | no | no | yes |
| Generate course/class report | yes | own faculty | own class/course | assigned | yes |
| Generate student profile | yes | own faculty | limited | assigned | yes |
| Schedule report | yes | yes | limited | no | yes |
| Approve report | yes | yes | no | no | yes |
| Send report | yes | yes | limited | no | yes |
| Create task from action | yes | yes | no | limited | yes |
| Archive report | yes | yes | no | no | yes |

## 11. MVP triển khai trước

### MVP 1 - Report Center UI skeleton

- 5 tab.
- Template cards.
- Generate form.
- Library list dùng API report hiện có.
- Actions tab mock từ report content/metrics.

### MVP 2 - Backend report templates + generate request mới

- Thêm `report_templates`.
- Mở rộng report type.
- Endpoint preview/generate.
- Lưu snapshot JSON.

### MVP 3 - Action list thật

- Thêm `report_actions`.
- Extract actions rule-based.
- Cho phép accept/dismiss/create task.

### MVP 4 - Schedule

- Thêm `report_schedules`.
- Run now trước.
- Cron/background worker sau.

### MVP 5 - Export

- Web report.
- PDF.
- Excel appendix.
- DOCX/PPTX để sau.

## 12. Việc cần sửa trong code hiện tại

| File/khu vực | Hiện trạng | Cần sửa |
| --- | --- | --- |
| `backend/app/schemas/reports.py` | Report type mới có 3 loại | Mở rộng report types theo template |
| `backend/app/models/report.py` | Chỉ có reports, feedback | Thêm template/run/snapshot/files/schedule/actions/approval |
| `backend/app/reports/service.py` | Sinh report deterministic theo 3 type | Tách collector, renderer, narrative, action extractor |
| `backend/app/api/v1/endpoints/reports.py` | CRUD generate/list/get/feedback | Thêm report-center endpoints |
| `frontend/src/app/(dashboard)/manager/reports/page.tsx` | Một page generate/report history đơn giản | Rebuild thành Report Center 5 tab |
| `frontend/src/lib/api.ts` | Report API types ít | Thêm ReportCenter types và methods |
| `frontend/src/components/layout/app-sidebar.tsx` | Sidebar có Báo cáo | Đổi route/name thành Report Center |
| `docs/14-Outcome-Workflow/README.md` | Có Reports & AI Agent ở mức workflow | Link sang docs 16 cho thiết kế report chi tiết |
| `docs/15-Implementation-TODO/README.md` | Có task/report ở mức backlog chung | Thêm todo cụ thể từ docs 16 nếu cần |

## 13. Definition of Done

Report Center đạt yêu cầu khi:

- Có 5 tab đúng chức năng.
- Người dùng chọn template thay vì export dashboard thủ công.
- Generate report có preview và final snapshot.
- Report lưu version, status, metric snapshot, narrative snapshot.
- Có filter library theo loại/khoa/ngành/môn/lớp/học kỳ/người tạo/trạng thái.
- Có scheduled reports.
- Có insights & actions trích xuất từ report.
- Action có thể chuyển thành task.
- AI narrative có nguồn dữ liệu rõ.
- Export tối thiểu Web + PDF + Excel.
- Permission theo actor được kiểm soát.

## 14. Agent Reliability Architecture

Report Agent không được thiết kế như chatbot tự do. Nó là agent có kiểm soát, dùng tool calling, memory và audit để phục vụ báo cáo.

### 14.1. Mục tiêu

- Trả lời câu hỏi chuyên sâu về report, metric, risk và action.
- Giải thích được chỉ số đến từ đâu, tính như thế nào, giới hạn diễn giải là gì.
- Đề xuất hành động nhưng không tự ghi dữ liệu nếu chưa được xác nhận.
- Lưu lại lịch sử hội thoại, tool call, prompt version và memory để có thể kiểm tra lại.

### 14.2. Memory

Short-term memory:

- Lưu ở `report_agent_sessions` và `report_agent_messages`.
- Dùng cho ngữ cảnh hội thoại hiện tại.
- Có `short_summary` để tóm tắt thread khi dài, tránh nhồi toàn bộ chat vào LLM.

Long-term memory:

- Lưu ở `agent_memories`.
- Chỉ lưu thông tin có ích, không lưu suy đoán mơ hồ.
- Ví dụ: report gần đây, scope thường dùng, preference về mức chi tiết, role/phạm vi dữ liệu.

Quy tắc dùng memory:

- Memory chỉ là ngữ cảnh phụ, không được thay thế dữ liệu trong report snapshot.
- Nếu memory mâu thuẫn với report/tool output, ưu tiên tool output.
- Memory nhạy cảm hoặc hành động ghi dữ liệu phải có audit.

### 14.3. Prompt

Prompt được version hóa bằng `agent_prompt_versions`.

Prompt hiện tại cần ràng buộc agent:

- Chỉ kết luận từ report snapshot, metric và tool output.
- Không bịa số liệu, không tự tạo công thức.
- Khi giải thích metric phải có: giá trị, công thức, nguồn dữ liệu, giới hạn.
- Khi phân tích nguyên nhân phải tách rõ dấu hiệu đã thấy và giả thuyết cần kiểm chứng.
- Khi đề xuất action phải có đối tượng, mức độ, owner gợi ý và điều kiện kiểm chứng.
- Mọi write action phải đi qua pending confirmation.

### 14.4. Tool policy

Read-only tools:

- `get_report_snapshot`
- `explain_report_metric`
- `trace_report_metric`
- `suggest_report_actions`
- `list_recent_reports`

Write-intent tools:

- `create_task_from_report_action`
- `schedule_report`
- `send_report`

Write-intent tools không được chạy trực tiếp. Agent chỉ tạo record trong `report_agent_pending_actions`, UI hiển thị cho actor xác nhận, sau đó backend mới thực thi workflow tương ứng.

### 14.5. DB cần có cho agent

- `agent_memories`: long-term memory theo user/namespace.
- `agent_prompt_versions`: lưu prompt contract và version.
- `report_agent_sessions`: session hội thoại theo report/scope.
- `report_agent_messages`: message lịch sử.
- `report_agent_tool_calls`: audit từng tool call.
- `report_agent_pending_actions`: hành động ghi dữ liệu chờ xác nhận.

### 14.6. API cần có cho agent

- `GET /api/v1/report-agent/tools`
- `POST /api/v1/report-agent/sessions`
- `GET /api/v1/report-agent/sessions/{session_id}`
- `POST /api/v1/report-agent/ask`
- `POST /api/v1/report-agent/stream`
- `POST /api/v1/report-agent/tools/confirm/{action_id}`

### 14.7. Frontend interaction

Mỗi metric trong dashboard/report cần có:

- Hover: hiển thị công thức ngắn, nguồn dữ liệu và ngưỡng cảnh báo.
- Click: mở panel chi tiết có trace, dữ liệu đầu vào, warning về độ tin cậy.
- Nút `Ask AI`: gửi `report_id`, `metric_key`, `scope`, `role` vào Report Agent.
- Nếu agent đề xuất ghi dữ liệu, UI hiển thị confirmation thay vì thực thi ngầm.

### 14.8. Những phần còn thiếu sau MVP agent

- Tool thực thi thật cho `create_task_from_report_action`.
- Schedule engine cho report định kỳ.
- Export PDF/Excel có appendix dữ liệu.
- Approval workflow cho report chính thức.
- UI Report Center 5 tab.
- UI agent side panel gắn vào từng report/metric.
- Data quality score cho từng report trước khi cho generate final.
