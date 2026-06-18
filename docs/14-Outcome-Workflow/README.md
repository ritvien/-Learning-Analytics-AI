# Thiết kế lại hệ thống AI Learning Analytics theo workflow vận hành

## 1. Định vị lại bài toán

Tên bài toán là **AI Phân Tích Học Tập cho Khoa & Nhà Trường**. Vì vậy sản phẩm không nên được thiết kế như một dashboard CLO/PLO, cũng không nên chỉ là CRUD dữ liệu học vụ.

Sản phẩm cần là một hệ thống vận hành phân tích học tập:

```text
Dữ liệu học vụ
→ phân tích sức khỏe học tập
→ phát hiện rủi ro
→ giao việc xử lý
→ theo dõi kết quả can thiệp
→ báo cáo/AI hỏi đáp
```

CLO/PLO vẫn quan trọng, nhưng chỉ là một module chuyên sâu về chuẩn đầu ra và kiểm định chất lượng. Lõi sản phẩm phải là Learning Analytics theo nhiều cấp: trường, khoa, ngành, môn, lớp, sinh viên.

## 2. Điểm khác biệt cần xây

Nếu chỉ làm dashboard biểu đồ thì sản phẩm rất dễ giống một BI tool thông thường. Điểm khác biệt nên nằm ở **workflow ra quyết định và can thiệp**:

1. **Không chỉ xem số liệu, mà hệ thống tự chỉ ra việc cần làm.**
   Ví dụ: "Khoa X có 3 môn rủi ro, 2 lớp cần can thiệp, 46 sinh viên nguy cơ".

2. **Mọi cảnh báo đều drill-down được.**
   Từ cấp trường có thể đi xuống khoa, ngành, môn, lớp, sinh viên và điểm thành phần.

3. **Mỗi insight phải có bằng chứng và độ tin cậy.**
   Hệ thống không chỉ nói "ngành này rủi ro", mà phải nói rủi ro do chỉ số nào, dữ liệu nào, học kỳ nào, số lượng sinh viên bao nhiêu.

4. **Có vòng đời xử lý task.**
   Cảnh báo không dừng ở xem. Nó phải tạo task, giao người phụ trách, cập nhật trạng thái, ghi nhận kết quả.

5. **AI agent là lớp phân tích sâu, không phải trang chính.**
   Agent giúp hỏi "vì sao", tóm tắt, soạn báo cáo, gợi ý ưu tiên, nhưng không thay thế workflow quản lý.

## 3. Kiến trúc module tổng thể

```text
AI Learning Analytics
├─ 1. Academic Data Hub
├─ 2. School Overview
├─ 3. Faculty Analytics
├─ 4. Program Analytics
├─ 5. Course Analytics
├─ 6. Section/Class Analytics
├─ 7. Student Risk Profile
├─ 8. Intervention Workflow
├─ 9. Outcome Assessment - CLO/PLO
├─ 10. Reports & AI Agent
└─ 11. Admin & Data Quality
```

### 3.1. Academic Data Hub

Đây là nền dữ liệu vận hành:

- Khoa.
- Ngành.
- Môn học.
- Lớp học phần.
- Sinh viên.
- Giảng viên.
- Điểm.
- Enrollment.
- Học kỳ/khóa.

Mục tiêu:

- CRUD dữ liệu học vụ.
- Import dữ liệu.
- Kiểm tra dữ liệu thiếu/sai.
- Chuẩn hóa quan hệ khoa-ngành-môn-lớp.

Không nên để người dùng chính bắt đầu ở module này, trừ admin hoặc người phụ trách dữ liệu.

### 3.2. School Overview

Dành cho ban quản lý nhà trường.

Câu hỏi cần trả lời:

- Toàn trường đang ổn hay có dấu hiệu xấu đi?
- Khoa nào cần ưu tiên xem?
- Ngành nào đang có nhiều sinh viên nguy cơ?
- Môn nào có tỷ lệ trượt cao bất thường?
- Học kỳ này khác gì so với các học kỳ trước?

Chỉ số:

- Tổng sinh viên đang học.
- GPA trung bình.
- Pass/fail rate.
- Số sinh viên nguy cơ.
- Số lớp/môn rủi ro.
- Top khoa/ngành/môn cần chú ý.
- Xu hướng theo học kỳ.

Hành động:

- Mở chi tiết khoa/ngành/môn.
- Tạo task rà soát.
- Sinh báo cáo tuần/tháng.
- Hỏi AI phân tích nguyên nhân.

### 3.3. Faculty Analytics

Dành cho trưởng khoa hoặc manager cấp khoa.

Câu hỏi:

- Khoa đang mạnh/yếu ở đâu?
- Ngành nào kéo chỉ số khoa xuống?
- Môn nào có tỷ lệ trượt hoặc điểm thấp?
- Lớp nào cần can thiệp sớm?
- Giảng viên/lớp nào cần rà soát dữ liệu?

Luồng:

```text
Chọn khoa
→ xem health score của khoa
→ xem ngành rủi ro
→ xem môn/lớp gây ảnh hưởng
→ tạo task cho giảng viên hoặc bộ môn
```

### 3.4. Program Analytics

Dành cho quản lý ngành/chương trình.

Câu hỏi:

- Ngành có đang đi xuống qua các học kỳ không?
- Khóa sinh viên nào yếu?
- Môn nào là bottleneck?
- Nhóm sinh viên nào có nguy cơ chậm tiến độ?
- Có liên quan đến CLO/PLO không?

Luồng:

```text
Chọn ngành
→ xem GPA/pass rate/fail rate theo khóa và học kỳ
→ xem môn bottleneck
→ xem sinh viên nguy cơ
→ nếu cần thì mở Outcome Assessment để soi CLO/PLO
```

### 3.5. Course Analytics

Dành cho manager và giảng viên.

Câu hỏi:

- Môn này khó thật hay dữ liệu điểm bất thường?
- Tỷ lệ trượt thay đổi qua các kỳ thế nào?
- Lớp nào trong môn này có vấn đề?
- Điểm thành phần nào kéo điểm tổng xuống?
- CLO nào của môn đang yếu?

Luồng:

```text
Chọn môn
→ xem xu hướng điểm/pass/fail
→ so sánh các lớp học phần
→ xem phân phối điểm
→ drill xuống lớp/sinh viên
→ nếu dùng kiểm định thì xem CLO của môn
```

### 3.6. Section/Class Analytics

Dành cho giảng viên và manager.

Câu hỏi:

- Lớp này có bao nhiêu sinh viên rủi ro?
- Điểm thành phần nào đang thấp?
- Có cần can thiệp trước kỳ thi không?
- Sinh viên nào cần được nhắc nhở?

Luồng giảng viên:

```text
Lớp tôi dạy
→ cảnh báo lớp
→ danh sách sinh viên rủi ro
→ điểm thành phần yếu
→ ghi chú can thiệp
→ cập nhật trạng thái xử lý
```

### 3.7. Student Risk Profile

Dành cho cố vấn học tập, giảng viên, manager.

Câu hỏi:

- Sinh viên này đang rủi ro vì gì?
- GPA thấp, trượt nhiều, vắng dữ liệu hay điểm thành phần yếu?
- Môn nào cần ưu tiên?
- Can thiệp trước đây có hiệu quả không?

Thông tin cần có:

- Hồ sơ học tập.
- GPA tích lũy.
- Lịch sử môn đã học/rớt.
- Điểm theo học kỳ.
- Risk score.
- Lý do rủi ro.
- Lịch sử can thiệp.

### 3.8. Intervention Workflow

Đây là điểm khác biệt chính của hệ thống.

Cảnh báo phải biến thành việc có người xử lý:

```text
Insight/risk
→ tạo task
→ giao người phụ trách
→ xử lý
→ ghi chú kết quả
→ đánh giá hiệu quả
→ đóng task
```

Loại task:

- Rà soát dữ liệu điểm.
- Can thiệp sinh viên rủi ro.
- Rà soát môn/lớp có fail rate cao.
- Rà soát mapping CLO/PLO.
- Giải trình chỉ số bất thường.
- Tạo báo cáo cho khoa/nhà trường.

Trạng thái task:

```text
open
→ assigned
→ in_progress
→ submitted
→ reviewed
→ closed
```

Task phải lưu:

- Nguồn tạo task.
- Scope: trường/khoa/ngành/môn/lớp/sinh viên.
- Chỉ số kích hoạt.
- Người giao.
- Người xử lý.
- Deadline.
- Ghi chú.
- Kết quả xử lý.
- Hiệu quả sau can thiệp.

### 3.9. Outcome Assessment - CLO/PLO

Đây là module chuyên sâu, không phải màn hình trung tâm đầu tiên.

Câu hỏi:

- Ngành có đạt PLO không?
- Môn nào/CLO nào đóng góp vào PLO?
- Điểm thành phần nào là minh chứng?
- Dữ liệu CLO/PLO đã được xác nhận chưa?
- Có đủ tin để dùng cho kiểm định không?

Luồng:

```text
Chuẩn hóa PLO/CLO
→ xác nhận mapping CLO-PLO
→ xác nhận mapping điểm-CLO
→ chạy assessment run
→ xem attainment
→ trace evidence
→ xuất báo cáo kiểm định
```

Quy tắc:

- Nếu CLO/PLO/mapping còn draft thì dashboard phải gắn nhãn "experimental".
- Không dùng dữ liệu seed để kết luận học thuật.
- Mọi chỉ số CLO/PLO phải có evidence trail.

### 3.10. Reports & AI Agent

Agent phục vụ hỏi sâu và báo cáo:

Thiết kế chi tiết cho module báo cáo nằm ở [Report Center](../16-Report-Center/README.md).

- "Vì sao khoa CNTT giảm pass rate?"
- "Ngành nào cần ưu tiên tuần này?"
- "Môn nào có fail rate bất thường?"
- "Sinh viên nào cần can thiệp?"
- "PLO nào yếu và do CLO/môn nào?"
- "Tạo báo cáo tuần cho trưởng khoa."

Agent phải trả lời kèm:

- Chỉ số sử dụng.
- Scope dữ liệu.
- Học kỳ.
- Số lượng mẫu.
- Độ tin cậy dữ liệu.
- Link drill-down.

### 3.11. Admin & Data Quality

Mục tiêu:

- Quản trị tài khoản/role.
- Quản trị danh mục.
- Import dữ liệu.
- Kiểm tra dữ liệu thiếu/sai.
- Audit log.
- Quản trị kỳ phân tích và kỳ báo cáo.

Data quality checks:

- Sinh viên thiếu ngành/khóa.
- Môn chưa có khoa quản lý.
- Ngành gán sai khoa.
- Lớp thiếu giảng viên.
- Điểm thiếu hoặc bất thường.
- CLO chưa có mapping.
- Mapping chưa được duyệt.

## 4. Workflow tổng thể theo role

### 4.1. Manager/Nhà trường

```text
Đăng nhập
→ School Overview
→ xem cảnh báo ưu tiên
→ chọn khoa/ngành rủi ro
→ drill-down môn/lớp/sinh viên
→ tạo task xử lý
→ theo dõi task
→ xem hiệu quả sau can thiệp
→ tạo báo cáo/nhờ AI tóm tắt
```

Manager cần màn hình mặc định là **việc cần chú ý hôm nay**, không phải một dashboard biểu đồ tĩnh.

### 4.2. Trưởng khoa

```text
Đăng nhập
→ Faculty Analytics
→ xem ngành/môn/lớp trong khoa
→ nhận task từ nhà trường
→ giao tiếp cho giảng viên/bộ môn
→ duyệt kết quả xử lý
→ báo cáo lại manager
```

### 4.3. Giảng viên

```text
Đăng nhập
→ My Classes
→ xem lớp có cảnh báo
→ xem sinh viên yếu và điểm thành phần
→ cập nhật ghi chú can thiệp
→ xác nhận dữ liệu điểm/CLO nếu được yêu cầu
→ gửi phản hồi
```

Giảng viên không nên phải tự tìm mã khoa, mã ngành, mã môn.

### 4.4. Cố vấn học tập

```text
Đăng nhập
→ danh sách sinh viên được phân công
→ xem risk profile
→ ghi nhận tư vấn/can thiệp
→ cập nhật trạng thái sinh viên
→ theo dõi tiến triển
```

### 4.5. Admin

```text
Đăng nhập
→ Data Quality Center
→ xử lý dữ liệu thiếu/sai
→ quản trị người dùng/role
→ mở kỳ phân tích
→ kiểm tra audit log
```

## 5. Luồng task thống nhất

Mọi module đều nên dùng cùng một task workflow.

### 5.1. Task được tạo từ đâu?

- Từ cảnh báo tự động.
- Từ manager tạo thủ công.
- Từ agent đề xuất và người dùng xác nhận.
- Từ quy trình kiểm định CLO/PLO.
- Từ data quality check.

### 5.2. Task gồm những gì?

```text
task_id
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
evidence_links
created_at
updated_at
closed_at
```

### 5.3. Task types

| Task type | Người xử lý chính | Ví dụ |
| --- | --- | --- |
| student_intervention | cố vấn/giảng viên | Sinh viên GPA giảm mạnh |
| section_review | giảng viên | Lớp có fail rate cao |
| course_review | trưởng bộ môn/manager | Môn nhiều kỳ liên tiếp có điểm thấp |
| data_quality_fix | admin/data owner | Ngành gán sai khoa |
| outcome_mapping_review | giảng viên/khoa | CLO chưa map điểm thành phần |
| report_request | manager/agent | Tạo báo cáo tuần |

### 5.4. Task lifecycle

```text
open
→ assigned
→ in_progress
→ submitted
→ reviewed
→ closed
```

Quy tắc:

- Task không được đóng nếu chưa có `resolution_note`.
- Task can thiệp sinh viên nên có follow-up sau một khoảng thời gian.
- Task dữ liệu phải ghi rõ đã sửa ở bảng/file nào.
- Task CLO/PLO phải ghi version/mapping liên quan.

## 6. Trải nghiệm khác biệt theo ngày

Màn hình chính nên là **Daily Learning Analytics Brief**, không phải dashboard trắng bắt người dùng tự tìm.

Ví dụ manager nhìn thấy:

```text
Hôm nay có 7 việc cần chú ý:
1. Khoa CNTT có 2 môn tăng fail rate > 15%.
2. Ngành Điện có 34 sinh viên nguy cơ.
3. 5 lớp chưa đủ dữ liệu điểm giữa kỳ.
4. 3 task can thiệp quá hạn.
5. CLO/PLO ngành CNTT còn 12 mapping chưa xác nhận.
```

Mỗi item có nút:

- Xem chi tiết.
- Giao việc.
- Hỏi AI.
- Tạo báo cáo.
- Bỏ qua có lý do.

Đây là phần làm sản phẩm khác biệt so với dashboard thông thường.

## 7. Điều hướng sản phẩm đề xuất

### Manager sidebar

```text
Tổng quan hôm nay
Trường
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

### Lecturer sidebar

```text
Lớp của tôi
Sinh viên cần chú ý
Điểm & minh chứng
CLO môn học
Task được giao
Báo cáo lớp
AI hỗ trợ
```

### Admin sidebar

```text
Data Quality Center
Import dữ liệu
Khoa/Ngành/Môn
Người dùng & Role
Cấu hình kỳ phân tích
Audit log
```

## 8. Actor toolkits, metric explanation và agent tool calling

Mỗi actor không nên nhìn cùng một bộ nút/chức năng. Hệ thống cần setup sẵn **toolkit theo vai trò**, để người dùng làm việc theo luồng tự nhiên:

```text
Actor
→ nhìn chỉ số/cảnh báo phù hợp
→ hover/click để hiểu chỉ số
→ nếu chưa rõ thì hỏi Agent
→ Agent gọi tool để truy vấn sâu
→ tạo task/can thiệp/báo cáo
```

### 8.1. Nguyên tắc thiết kế tool theo actor

1. **Tool xuất hiện theo ngữ cảnh.**
   Ví dụ: ở lớp học phần thì hiện tool xem sinh viên rủi ro, phân phối điểm, tạo can thiệp; không hiện tool quản trị toàn trường.

2. **Tool phải giải thích được dữ liệu nguồn.**
   Khi hover/click chỉ số, người dùng thấy công thức, dữ liệu dùng, scope, học kỳ, số lượng mẫu và độ tin cậy.

3. **Agent chỉ hỏi sâu trên dữ liệu đã có.**
   Agent không tự bịa chỉ số. Agent phải gọi tool/backend function để lấy dữ liệu.

4. **Agent có thể hoàn thành công việc, không chỉ trả lời.**
   Nếu người dùng hỏi "tạo task xử lý lớp này", agent phải gọi tool tạo task sau khi người dùng xác nhận.

5. **Mọi hành động có tác động dữ liệu phải có xác nhận.**
   Agent có thể đề xuất, nhưng các hành động như tạo task, gửi báo cáo, khóa dữ liệu, đổi mapping phải yêu cầu xác nhận.

### 8.2. Cấu trúc metric explanation

Mọi KPI, biểu đồ, bảng cảnh báo cần có `explain payload`.

Ví dụ:

```json
{
  "metric_key": "program_fail_rate",
  "label": "Tỷ lệ trượt ngành",
  "value": 18.4,
  "unit": "%",
  "scope": {
    "level": "program",
    "program_id": 2,
    "semester_id": 6
  },
  "formula": "Số enrollment không đạt / tổng enrollment có kết quả",
  "data_sources": [
    "enrollments",
    "sections",
    "students",
    "semesters"
  ],
  "sample_size": 1240,
  "filters": {
    "department": "Khoa Công nghệ Thông tin",
    "program": "Công nghệ thông tin",
    "semester": "2025-2026 HK1"
  },
  "confidence": "medium",
  "warnings": [
    "12% enrollment chưa có điểm cuối kỳ"
  ],
  "drilldowns": [
    "courses",
    "sections",
    "students"
  ]
}
```

UI cần hỗ trợ:

- Hover: tooltip ngắn gồm công thức và mẫu số.
- Click: mở panel giải thích chi tiết.
- Nút `Hỏi AI về chỉ số này`.
- Nút `Tạo task từ chỉ số này`.
- Nút `Xem drill-down`.

### 8.3. Manager toolkit

Manager cần bộ tool mặc định để điều hành cấp trường/khoa/ngành:

| Tool | Dùng khi nào | Output |
| --- | --- | --- |
| Explain Metric | Không hiểu KPI/cảnh báo | Công thức, nguồn dữ liệu, sample size, cảnh báo dữ liệu |
| Drill Down | Muốn biết nguyên nhân | Khoa → ngành → môn → lớp → sinh viên |
| Compare Periods | So sánh học kỳ/năm | Xu hướng tăng/giảm và mức thay đổi |
| Find Root Causes | Chỉ số xấu bất thường | Top yếu tố đóng góp: môn, lớp, nhóm sinh viên |
| Create Review Task | Cần giao xử lý | Task cho trưởng khoa/giảng viên/admin |
| Generate Brief | Cần báo cáo nhanh | Tóm tắt tình hình theo scope |
| Ask Agent | Cần hỏi sâu | Agent gọi tool phân tích và trả lời có nguồn |

Luồng manager:

```text
Daily Brief
→ click cảnh báo "Khoa CNTT có fail rate tăng"
→ Explain Metric
→ Drill Down thấy 3 môn kéo xuống
→ Find Root Causes
→ Create Review Task cho trưởng khoa
→ Generate Brief gửi ban quản lý
```

### 8.4. Trưởng khoa toolkit

Trưởng khoa cần tool tập trung vào khoa, ngành, môn và giảng viên:

| Tool | Dùng khi nào | Output |
| --- | --- | --- |
| Faculty Health Explain | Xem sức khỏe khoa | Nguồn chỉ số cấp khoa |
| Program Risk Breakdown | Ngành nào rủi ro | Danh sách ngành và yếu tố kéo xuống |
| Course Bottleneck Finder | Môn nào là bottleneck | Môn nhiều sinh viên rớt, điểm thấp, xu hướng xấu |
| Assign Lecturer Task | Giao giảng viên rà soát | Task theo lớp/môn |
| Review Lecturer Response | Duyệt phản hồi | Kết quả xử lý/giải trình |
| Ask Agent | Hỏi nguyên nhân sâu | Trả lời dựa trên dữ liệu khoa |

Luồng trưởng khoa:

```text
Faculty Analytics
→ xem ngành rủi ro
→ mở Course Bottleneck Finder
→ giao task cho giảng viên phụ trách lớp
→ đọc phản hồi
→ đóng task hoặc yêu cầu bổ sung
```

### 8.5. Lecturer toolkit

Giảng viên cần tool rất thực dụng, gắn với lớp mình dạy:

| Tool | Dùng khi nào | Output |
| --- | --- | --- |
| Class Risk Explain | Lớp có cảnh báo | Vì sao lớp bị cảnh báo |
| Student Risk List | Cần danh sách sinh viên yếu | Sinh viên, lý do rủi ro, điểm thành phần thấp |
| Grade Component Breakdown | Soi điểm thành phần | Thành phần nào kéo điểm xuống |
| CLO Evidence Viewer | Nếu môn có CLO | CLO nào yếu, điểm nào đo CLO |
| Add Intervention Note | Sau khi can thiệp | Ghi chú tư vấn/nhắc nhở/hỗ trợ |
| Submit Review | Hoàn tất task | Phản hồi cho trưởng khoa/manager |
| Ask Agent | Cần hỏi cách hiểu | Agent giải thích lớp/môn/sinh viên |

Luồng giảng viên:

```text
My Classes
→ lớp có cảnh báo
→ Class Risk Explain
→ Student Risk List
→ xem điểm thành phần thấp
→ Add Intervention Note
→ Submit Review
```

### 8.6. Cố vấn học tập toolkit

| Tool | Dùng khi nào | Output |
| --- | --- | --- |
| Student Profile Explain | Xem hồ sơ sinh viên | GPA, môn rớt, xu hướng, lý do rủi ro |
| Intervention History | Cần biết đã xử lý gì | Lịch sử tư vấn/can thiệp |
| Recommend Action | Cần gợi ý hành động | Gợi ý nhắc học lại, gặp cố vấn, hỗ trợ môn |
| Schedule Follow-up | Cần theo dõi tiếp | Task follow-up |
| Ask Agent | Hỏi sâu về sinh viên | Agent tổng hợp hồ sơ và gợi ý |

Luồng cố vấn:

```text
Sinh viên được phân công
→ mở risk profile
→ xem lý do rủi ro
→ ghi nhận tư vấn
→ đặt follow-up
```

### 8.7. Admin/Data owner toolkit

| Tool | Dùng khi nào | Output |
| --- | --- | --- |
| Data Quality Explain | Có cảnh báo dữ liệu | Bảng/cột/dòng bị lỗi |
| Fix Assignment | Sửa khoa-ngành-môn | Cập nhật quan hệ dữ liệu |
| Import Validator | Trước khi nạp file | Lỗi format, missing value, duplicate |
| Audit Viewer | Cần kiểm tra thay đổi | Ai sửa gì, lúc nào |
| Lock Dataset | Chốt kỳ dữ liệu | Dataset version đã khóa |
| Ask Agent | Hỏi lỗi dữ liệu | Agent truy vấn data quality và đề xuất sửa |

### 8.8. Agent tool calling design

Agent cần một registry tool rõ ràng, không gọi SQL tùy tiện từ UI.

Nhóm tool phân tích:

```text
get_school_overview(scope)
get_department_health(department_id, semester_id)
get_program_health(program_id, semester_id)
get_course_health(course_id, semester_id)
get_section_health(section_id)
get_student_risk_profile(student_id)
explain_metric(metric_key, scope, filters)
find_root_causes(metric_key, scope, filters)
compare_periods(metric_key, scope, period_a, period_b)
```

Nhóm tool workflow:

```text
create_task(task_type, scope, assignee, reason, priority)
update_task(task_id, status, note)
create_intervention(student_id, note, action_type)
schedule_followup(scope, assignee, due_date)
generate_report(report_type, scope, format)
```

Nhóm tool data quality:

```text
get_data_quality_summary(scope)
list_data_quality_issues(scope)
explain_data_issue(issue_id)
propose_data_fix(issue_id)
```

Nhóm tool CLO/PLO:

```text
get_outcome_readiness(program_id)
trace_plo(plo_id, filters)
trace_clo(clo_id, filters)
explain_outcome_metric(metric_key, scope)
create_outcome_review_task(scope, assignee)
```

### 8.9. Agent interaction pattern

Agent nên hoạt động theo mẫu:

```text
User hỏi
→ Agent xác định intent
→ Agent gọi tool lấy dữ liệu
→ Agent trả lời kèm nguồn
→ Agent đề xuất next action
→ Nếu action thay đổi dữ liệu, hỏi xác nhận
→ Agent gọi workflow tool
```

Ví dụ manager hỏi:

```text
"Vì sao khoa CNTT tuần này bị cảnh báo?"
```

Agent cần:

1. Gọi `get_department_health`.
2. Gọi `compare_periods`.
3. Gọi `find_root_causes`.
4. Trả lời:
   - fail rate tăng bao nhiêu;
   - môn/lớp nào đóng góp nhiều nhất;
   - số sinh viên bị ảnh hưởng;
   - dữ liệu có thiếu gì không;
   - gợi ý tạo task cho ai.

Ví dụ giảng viên hỏi:

```text
"Lớp tôi vì sao bị đánh dấu rủi ro?"
```

Agent cần:

1. Gọi `get_section_health`.
2. Gọi `get_student_risk_profile` cho nhóm sinh viên yếu.
3. Gọi `explain_metric`.
4. Trả lời:
   - lớp rủi ro vì điểm thành phần nào;
   - bao nhiêu sinh viên dưới ngưỡng;
   - sinh viên nào cần can thiệp;
   - có thể tạo intervention note.

### 8.10. UI pattern cho hover/click chỉ số

Mọi chỉ số trong dashboard nên có cùng pattern:

```text
Metric card/chart/table cell
→ hover: tooltip ngắn
→ click: side panel chi tiết
→ actions: Ask Agent, Drill Down, Create Task, Export Evidence
```

Tooltip ngắn:

```text
Tỷ lệ trượt = số lượt học không đạt / tổng lượt học có kết quả.
Mẫu: 1.240 enrollment, HK1 2025-2026.
Click để xem chi tiết.
```

Panel chi tiết:

- Giá trị.
- Công thức.
- Dữ liệu nguồn.
- Scope/filter đang áp dụng.
- Số mẫu.
- Cảnh báo chất lượng dữ liệu.
- Biến động so với kỳ trước.
- Drill-down liên quan.
- Hành động đề xuất.

### 8.11. Permission cho tool

| Tool/action | Manager | Trưởng khoa | Lecturer | Cố vấn | Admin |
| --- | --- | --- | --- | --- | --- |
| Explain metric | yes | yes | yes | yes | yes |
| Drill-down toàn trường | yes | no | no | no | yes |
| Drill-down trong khoa | yes | yes | no | no | yes |
| Xem lớp mình dạy | yes | yes | yes | no | yes |
| Xem student risk | yes | yes | limited | assigned only | yes |
| Create task | yes | yes | no | limited | yes |
| Close task | yes | yes | limited | limited | yes |
| Create intervention | yes | yes | yes | yes | no |
| Lock dataset | no | no | no | no | yes |
| Approve CLO/PLO mapping | yes | yes | limited | no | yes |

## 9. Data model cần bổ sung

### 9.1. Risk và insight

```text
analytics_insights
risk_scores
risk_factors
metric_snapshots
```

Mục tiêu:

- Lưu insight đã phát hiện.
- Không tính lại vô tội vạ mỗi lần mở trang.
- Có lịch sử biến động.

### 9.2. Task workflow

```text
analytics_tasks
task_comments
task_status_history
task_evidence_links
```

### 9.3. Intervention

```text
student_interventions
intervention_followups
intervention_outcomes
```

### 9.4. Outcome assessment

```text
outcome_versions
outcome_review_cycles
outcome_approval_logs
assessment_runs
assessment_run_items
outcome_quality_checks
```

### 9.5. Data quality

```text
data_quality_checks
data_quality_issues
data_quality_resolutions
```

## 10. API định hướng

### Daily brief

```text
GET /api/v1/analytics/brief
GET /api/v1/analytics/insights
POST /api/v1/analytics/insights/{id}/dismiss
POST /api/v1/analytics/insights/{id}/create-task
```

### Drill-down analytics

```text
GET /api/v1/analytics/school
GET /api/v1/analytics/departments/{id}
GET /api/v1/analytics/programs/{id}
GET /api/v1/analytics/courses/{id}
GET /api/v1/analytics/sections/{id}
GET /api/v1/analytics/students/{id}/risk-profile
```

### Task workflow

```text
GET /api/v1/tasks
POST /api/v1/tasks
PATCH /api/v1/tasks/{id}
POST /api/v1/tasks/{id}/comments
POST /api/v1/tasks/{id}/submit
POST /api/v1/tasks/{id}/review
POST /api/v1/tasks/{id}/close
```

### Intervention

```text
GET /api/v1/interventions
POST /api/v1/interventions
PATCH /api/v1/interventions/{id}
GET /api/v1/students/{id}/interventions
```

### CLO/PLO

```text
GET /api/v1/outcomes/readiness
GET /api/v1/outcomes/risks
GET /api/v1/outcomes/plos/{id}/trace
POST /api/v1/outcomes/runs
```

### Agent

```text
POST /api/v1/agent/ask
POST /api/v1/agent/report
POST /api/v1/agent/explain-insight
```

## 11. Roadmap triển khai hợp lý

### Phase 1 - Sửa nền dữ liệu và định nghĩa module

Mục tiêu:

- Chuẩn hóa khoa-ngành-môn.
- Rà soát dữ liệu điểm/lớp/sinh viên.
- Tách rõ module Learning Analytics và Outcome Assessment.

Deliverables:

- Inventory khoa-ngành-môn.
- Inventory CLO/PLO.
- Data quality checks cơ bản.
- Sidebar/module map mới.

### Phase 2 - Daily Brief và Risk Engine MVP

Mục tiêu:

- Hệ thống tự đưa ra danh sách việc cần chú ý.
- Có risk score đơn giản nhưng giải thích được.

Deliverables:

- Daily brief cho manager.
- Risk list: khoa/ngành/môn/lớp/sinh viên.
- Panel giải thích chỉ số.
- Drill-down cơ bản.

### Phase 3 - Task và Intervention Workflow

Mục tiêu:

- Biến insight thành hành động.
- Theo dõi xử lý sau cảnh báo.

Deliverables:

- Task CRUD theo role.
- Assign/review/close.
- Intervention notes cho sinh viên/lớp.
- Follow-up status.

### Phase 4 - Role-specific Dashboards

Mục tiêu:

- Manager, trưởng khoa, giảng viên, cố vấn có màn hình riêng.

Deliverables:

- Manager daily brief.
- Faculty analytics.
- Lecturer my classes.
- Student risk profile.
- Admin data quality center.

### Phase 5 - Outcome Assessment chuẩn hóa

Mục tiêu:

- Làm lại CLO/PLO trên dữ liệu đã xác nhận.

Deliverables:

- PLO/CLO official versioning.
- Mapping approval.
- Assessment runs.
- Evidence trace.
- Báo cáo kiểm định.

### Phase 6 - AI Agent chuyên sâu

Mục tiêu:

- Agent trả lời có nguồn, dựa trên insight/task/run đã có.

Deliverables:

- Explain insight.
- Generate report.
- Ask across metrics.
- Recommend next actions.

Thiết kế chi tiết Report Center nằm ở [Report Center](../16-Report-Center/README.md).

## 12. Việc cần làm ngay

1. Tạm dừng coi CLO/PLO dashboard là module chính.
2. Đổi thiết kế điều hướng theo Learning Analytics modules.
3. Tạo inventory khoa-ngành-môn để sửa dữ liệu nền.
4. Xây Daily Brief MVP cho manager.
5. Xây task workflow MVP.
6. Tách lecturer flow: `Lớp của tôi → Sinh viên rủi ro → Điểm/CLO liên quan`.
7. Đánh dấu dữ liệu CLO/PLO hiện tại là experimental cho đến khi được xác nhận.

## 13. Khoảng thiếu cần build để đúng workflow mới

Các phần hiện còn thiếu so với thiết kế workflow:

| Nhóm thiếu | Hiện trạng | Cần xây |
| --- | --- | --- |
| Metric explanation | Một số màn hình chỉ hiển thị số, chưa giải thích ngay khi hover | Mọi KPI/chart/table cell có tooltip công thức và panel chi tiết |
| Agent context | Chat có thể hỏi chung, nhưng chưa luôn nhận context từ chỉ số | Nút `Hỏi AI` cạnh từng chỉ số, truyền metric/scope/filter sang `/chat?q=` |
| Actor toolkit | Các actor vẫn dùng gần giống nhau | Toolkit riêng cho manager, trưởng khoa, lecturer, cố vấn, admin |
| Task workflow | Chưa có vòng đời task thống nhất | Tạo task từ insight, assign, submit, review, close |
| Daily brief | Dashboard còn bắt người dùng tự tìm vấn đề | Màn hình "việc cần chú ý hôm nay" theo role |
| Data quality | Quan hệ khoa-ngành-môn còn sai | Data Quality Center và inventory sửa dữ liệu nền |
| Evidence trail | Một số chỉ số chưa trace đủ về nguồn | Drill-down chỉ số về khoa/ngành/môn/lớp/sinh viên/điểm thành phần |
| Permission | Tool/action chưa được khóa rõ theo role | Permission matrix áp dụng ở UI và API |

Thứ tự rebuild khuyến nghị:

```text
1. Metric explanation pattern
2. Nút Hỏi AI theo context chỉ số
3. Daily Brief MVP cho manager
4. Task workflow MVP
5. Lecturer flow: lớp của tôi → sinh viên rủi ro → can thiệp
6. Data Quality Center
7. CLO/PLO official workflow sau khi dữ liệu được xác nhận
```

## 14. Kết luận thiết kế

Hệ thống nên được hiểu như một **Learning Analytics Operating System**:

```text
Không chỉ xem dashboard
→ mà phát hiện vấn đề
→ giải thích nguyên nhân
→ giao việc xử lý
→ theo dõi hiệu quả
→ tạo báo cáo bằng AI
```

Đây là hướng khác biệt hơn so với một dashboard học vụ thông thường, đồng thời vẫn giữ CLO/PLO như một module quan trọng khi dữ liệu đã đủ tin.
