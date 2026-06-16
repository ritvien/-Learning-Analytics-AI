# Dashboard Analytics — Role-based README

> **Cập nhật định hướng:** dashboard phải được phân tầng theo đối tượng phân tích. Trang tổng quan chịu trách nhiệm mô tả toàn trường và so sánh ngành; trang ngành chỉ chẩn đoán sâu một ngành được chọn. Routing chuẩn mới dùng `/manager/analytics/programs` thay cho trang so sánh khoa/ngành cũ. Chi tiết hợp đồng UI, metric và giới hạn dữ liệu hiện hành được tóm tắt trong `README.md`.

## 1. Mục tiêu thiết kế

Dashboard Analytics không chỉ dùng để “xem số liệu”, mà phải hỗ trợ từng vai trò ra quyết định.

Luồng phân tích chính:

```text
Executive phát hiện vùng nóng
→ Khoa/Ngành xác định đơn vị hoặc chương trình đang yếu
→ Môn học tìm bottleneck và bất thường qua các kỳ
→ Lớp học phần/Sinh viên xác định đối tượng cần can thiệp
```

Hệ thống gồm 4 trang:

| Route | Trang | Câu hỏi trung tâm | Role chính |
|---|---|---|---|
| `/manager/analytics` | Executive Command Center | Toàn trường đang có vấn đề gì cần xử lý ngay? | Ban giám hiệu, Phòng đào tạo |
| `/manager/analytics/departments` | Department & Program Diagnosis | Khoa/ngành nào yếu, yếu ở đâu? | Trưởng khoa, Trưởng ngành, QA |
| `/manager/analytics/courses` | Course Bottleneck Analysis | Môn nào là nút thắt, vì sao? | Trưởng bộ môn, Trưởng ngành, QA |
| `/manager/analytics/sections` | Section & Student Intervention | Lớp nào và sinh viên nào cần can thiệp? | Giảng viên, Cố vấn học tập, Phòng đào tạo |

---

## 2. Nguyên tắc thiết kế theo role

### 2.1. Ban giám hiệu / Phòng đào tạo

Không cần xem chi tiết từng sinh viên ngay từ đầu. Cần biết:

| Nhu cầu | Dashboard cần trả lời |
|---|---|
| Tình hình toàn trường đang tốt lên hay xấu đi? | Trend pass rate, avg grade, % SV nguy cơ |
| Vấn đề tập trung ở đâu? | Heatmap khoa × học kỳ |
| Vấn đề nào ảnh hưởng nhiều nhất? | Pareto failed enrollments |
| Cần xử lý việc gì trước? | Decision Queue / Action Table |

### 2.2. Trưởng khoa / Trưởng ngành

Cần biết khoa/ngành của mình yếu ở đâu:

| Nhu cầu | Dashboard cần trả lời |
|---|---|
| Khoa/ngành nào có rủi ro cao? | Department performance quadrant |
| Xu hướng khoa/ngành qua các kỳ ra sao? | Heatmap khoa/ngành × học kỳ |
| Môn nào kéo kết quả xuống? | Bottleneck courses table |
| Ngành nào trong khoa cần ưu tiên? | Program drill-down table |

### 2.3. Trưởng bộ môn / QA / Khảo thí

Cần biết môn học có vấn đề do bản chất môn hay do từng lớp:

| Nhu cầu | Dashboard cần trả lời |
|---|---|
| Môn nào là bottleneck? | Course risk matrix |
| Môn đó xấu dần hay chỉ bất thường một kỳ? | Pass rate trend |
| Điểm trung bình có giảm không? | Avg grade trend |
| Có section nào lệch bất thường không? | Section variability + Section detail table |

### 2.4. Giảng viên / Cố vấn học tập

Cần danh sách cụ thể để can thiệp:

| Nhu cầu | Dashboard cần trả lời |
|---|---|
| Lớp nào đang bất thường? | Section finder table |
| Lớp này yếu toàn bộ hay chỉ một nhóm sinh viên? | Grade distribution with risk bands |
| Lớp này thấp hơn trung bình môn bao nhiêu? | Section benchmark |
| Sinh viên nào cần xử lý trước? | Intervention list |

---

## 3. Nguồn dữ liệu

### 3.1. API đang sử dụng

| Endpoint | Mục đích | Trang dùng |
|---|---|---|
| `GET /api/v1/students?limit=500` | Danh sách sinh viên, GPA, trạng thái, chương trình học | 1, 2, 4 |
| `GET /api/v1/grades/enrollments?limit=3000` | Điểm học phần, pass/fail, section_id, student_id | 1, 2, 3, 4 |
| `GET /api/v1/courses?limit=200` | Mã môn, tên môn, số tín chỉ | 1, 2, 3, 4 |
| `GET /api/v1/sections?limit=300` | Lớp học phần, học kỳ, môn học | 1, 2, 3, 4 |
| `GET /api/v1/semesters` | Danh sách học kỳ, kỳ hiện tại | 1, 2, 3, 4 |
| `GET /api/v1/departments?limit=100` | Danh sách khoa | 2 |
| `GET /api/v1/programs?limit=100` | Danh sách ngành/chương trình, mapping khoa | 2, 3 |

### 3.2. Quan hệ dữ liệu cần join

#### Mapping sinh viên → khoa

```text
enrollment.student_id
→ student.id
→ student.program_id
→ program.id
→ program.department_id
→ department.id
```

#### Mapping enrollment → môn học

```text
enrollment.section_id
→ section.id
→ section.course_id
→ course.id
```

#### Mapping enrollment → học kỳ

```text
enrollment.section_id
→ section.id
→ section.semester_id
→ semester.id
```

---

## 4. Định nghĩa metric chuẩn

### 4.1. Valid enrollment

Nếu database có trạng thái enrollment:

```text
valid_enrollment =
final_grade != null
AND enrollment_status NOT IN ('cancelled', 'withdrawn', 'pending')
```

Nếu chưa có trạng thái enrollment:

```text
valid_enrollment = final_grade != null
```

Không nên tính các bản ghi chưa có điểm vào pass rate, vì sẽ làm tỷ lệ qua môn bị sai.

---

### 4.2. Pass rate

```text
pass_rate = passed_enrollments / valid_enrollments
```

Trong đó:

```text
passed_enrollments = count(enrollment where is_passed = true)
```

---

### 4.3. Fail rate

```text
fail_rate = failed_enrollments / valid_enrollments
```

Trong đó:

```text
failed_enrollments = count(enrollment where is_passed = false)
```

Hoặc:

```text
fail_rate = 1 - pass_rate
```

---

### 4.4. Active students

```text
active_students = count(student where status = 'active')
```

---

### 4.5. Academic risk student

MVP:

```text
academic_risk_student = student.gpa_cumulative < 2.0
```

Bản tốt hơn:

```text
academic_risk_student =
gpa_cumulative < 2.0
OR failed_courses_current_semester >= 2
OR any final_grade < 4.0 in current semester
```

---

### 4.6. Section anomaly

Một lớp học phần được coi là bất thường nếu:

```text
section_pass_rate < course_avg_pass_rate - 15 percentage points
```

Ví dụ:

```text
Pass rate lớp CT101-02 = 58%
Pass rate trung bình môn CT101 = 76%
Chênh lệch = -18 điểm %
→ Section bất thường
```

---

### 4.7. Course impact score

MVP nên dùng:

```text
course_impact = failed_enrollments
```

Lý do: số lượt trượt phản ánh quy mô ảnh hưởng thật.

Bản nâng cao:

```text
course_impact_score =
0.5 × normalized_failed_enrollments
+ 0.3 × normalized_fail_rate
+ 0.2 × negative_trend_score
```

---

### 4.8. Student risk level

| Risk level | Điều kiện MVP | Ý nghĩa |
|---|---|---|
| 🔴 High | `final_grade < 4.0` hoặc `gpa_cumulative < 2.0` | Rủi ro học vụ cao |
| 🟠 Medium | `4.0 <= final_grade < 5.0` | Cận trượt, cần can thiệp |
| 🟡 Watch | `5.0 <= final_grade < 5.5` | Qua nhưng yếu, cần theo dõi |
| 🟢 Normal | `final_grade >= 5.5` | Tạm ổn |

---

# 5. Trang 1 — Executive Command Center

## 5.1. Route

```text
/manager/analytics
```

## 5.2. Role sử dụng

| Role | Cần gì từ trang này |
|---|---|
| Ban giám hiệu | Nắm tình hình toàn trường, ưu tiên vấn đề lớn |
| Phòng đào tạo | Theo dõi cảnh báo học vụ, phát hiện môn/lớp bất thường |
| QA | Theo dõi xu hướng chất lượng đào tạo |

## 5.3. Câu hỏi trung tâm

```text
Toàn trường đang có vấn đề gì nghiêm trọng nhất, ở đâu, và cần xử lý cái gì trước?
```

---

## 5.4. Filters

| Filter | Kiểu | Mặc định | Tác động | Ghi chú |
|---|---|---|---|---|
| Học kỳ | Dropdown | Kỳ hiện tại | Lọc toàn bộ KPI, chart, table | Nếu chọn “Tất cả” thì KPI cần ghi rõ là tổng hợp |
| So sánh với | Dropdown | Kỳ trước | Tính delta KPI | Có thể thêm “cùng kỳ năm trước” |
| Khoa | Dropdown | Tất cả | Lọc dữ liệu theo khoa | Cho phép lãnh đạo drill-down nhanh |
| Min enrollment | Number input | 20 | Loại môn/lớp quá ít SV | Tránh cảnh báo nhiễu |
| Trạng thái SV | Dropdown | Active | Lọc sinh viên | Mặc định không tính nghỉ học/bảo lưu |

---

## 5.5. KPI Cards

| KPI | Cách hiển thị | Công thức | Cảnh báo | Ý nghĩa |
|---|---|---|---|---|
| Active students | `1,245 SV` | Count SV `status = active` | Không cảnh báo | Quy mô hiện tại |
| Pass rate kỳ hiện tại | `72.4% ↓ 5.2%` | Passed / valid enrollments trong kỳ | Đỏ nếu `< 70%` | Kết quả đào tạo kỳ hiện tại |
| Avg final grade | `6.8 / 10 ↓ 0.4` | Avg `final_grade` valid enrollments | Đỏ nếu `< 5.5` | Chất lượng điểm học phần |
| Academic risk students | `86 SV ↑ 12` | Count SV GPA `< 2.0` | Đỏ nếu `> 0` | Rủi ro học vụ |
| High-risk courses/sections | `14 cảnh báo` | Count môn/lớp vượt rule cảnh báo | Đỏ nếu `> 0` | Khối lượng vấn đề cần xử lý |

Lưu ý: không gọi `avg final_grade` là GPA. GPA và final grade là hai hệ thang đo khác nhau.

---

## 5.6. Chart 1 — Executive Health Trend

### Loại chart

Small multiple line chart gồm 3 biểu đồ nhỏ:

| Small chart | Trục X | Trục Y | Đường tham chiếu |
|---|---|---|---|
| Pass rate trend | Học kỳ | Pass rate % | 70% |
| Avg final grade trend | Học kỳ | Điểm TB thang 10 | 5.5 hoặc 6.5 |
| Risk student rate trend | Học kỳ | % SV nguy cơ | Target nội bộ |

### Mục đích

Cho lãnh đạo thấy toàn trường đang tốt lên hay xấu đi.

### Tooltip

| Field | Nội dung |
|---|---|
| Học kỳ | `HK1 2024` |
| Pass rate | `72.4%` |
| Passed / Total | `2,314 / 3,196` |
| Delta | `↓ 5.2% so với HK trước` |

### Insight cần hiện ra

| Pattern | Diễn giải |
|---|---|
| Pass rate giảm, avg grade giảm | Chất lượng học tập/kỳ thi đang xấu đi |
| Pass rate giảm, avg grade ổn | Có thể nhiều SV sát ngưỡng qua môn |
| Pass rate ổn, risk students tăng | GPA tích lũy xấu dần, cần cảnh báo học vụ |
| Avg grade tăng nhưng pass rate không tăng | Điểm tăng ở nhóm khá/giỏi, chưa giúp nhóm yếu |

---

## 5.7. Chart 2 — Risk Heatmap: Khoa × Học kỳ

### Loại chart

Heatmap.

| Thành phần | Giá trị |
|---|---|
| Rows | Khoa |
| Columns | Học kỳ |
| Cell value | Risk score hoặc fail rate |
| Color | Xanh = thấp, vàng = trung bình, đỏ = cao |

### Metric MVP

```text
risk_value = fail_rate
```

### Metric nâng cao

```text
risk_score =
0.4 × fail_rate_normalized
+ 0.3 × risk_student_rate_normalized
+ 0.2 × avg_grade_drop_normalized
+ 0.1 × section_anomaly_rate_normalized
```

### Tooltip

| Field | Nội dung |
|---|---|
| Khoa | Tên khoa |
| Học kỳ | Mã học kỳ |
| Pass rate | `%` |
| Fail rate | `%` |
| Avg grade | Điểm TB |
| SV nguy cơ | Số lượng + % |
| Section anomaly | Số section bất thường |

### Mục đích

Phát hiện khoa nào đang xấu dần theo thời gian.

---

## 5.8. Chart 3 — Pareto: Top contributors to failed enrollments

### Loại chart

Bar ngang, có thể thêm cumulative line.

### Không nên xếp theo fail rate đơn thuần

Vì một môn có fail rate 70% nhưng chỉ 10 sinh viên học thì không quan trọng bằng môn fail rate 25% nhưng 800 sinh viên học.

### Cột dữ liệu cần có

| Field | Ý nghĩa |
|---|---|
| Course name / Department name | Đơn vị gây ảnh hưởng |
| Failed enrollments | Số lượt trượt |
| Total enrollments | Tổng lượt học |
| Fail rate | Tỷ lệ trượt |
| Contribution % | Tỷ trọng số lượt trượt trên toàn trường |

### Tooltip

```text
Môn: Cơ sở dữ liệu
Trượt: 180 / 620
Fail rate: 29.0%
Đóng góp: 12.5% tổng lượt trượt toàn trường
```

### Mục đích

Trả lời câu hỏi:

```text
Nếu chỉ xử lý 5 vấn đề đầu tiên, nên xử lý cái gì để giảm nhiều lượt trượt nhất?
```

---

## 5.9. Table 1 — Decision Queue / Action Table

Đây là table quan trọng nhất của Trang 1.

### Mục đích

Biến số liệu thành danh sách việc cần xử lý.

### Table phải thể hiện gì?

| Cột | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| Priority | Badge | Mức ưu tiên xử lý | `🔴 P1`, `🟡 P2`, `🟢 P3` |
| Issue type | Text/Badge | Loại vấn đề | `Course bottleneck`, `Section anomaly`, `GPA drop`, `Student risk` |
| Đơn vị | Text + link | Khoa/môn/lớp liên quan | `Khoa Điện`, `CT101-02` |
| Vấn đề | Text ngắn | Mô tả vấn đề chính | `Fail rate tăng 3 kỳ liên tiếp` |
| Evidence | Text/Metric | Bằng chứng định lượng | `28% → 35% → 42%` |
| Impact | Number | Quy mô ảnh hưởng | `180 lượt trượt`, `72 SV cận trượt` |
| Suggested action | Text | Gợi ý xử lý | `Rà soát đề thi`, `Gửi cố vấn học tập` |
| Owner | Text/Select | Đơn vị chịu trách nhiệm | `Trưởng khoa`, `Phòng ĐT` |
| Status | Badge | Trạng thái xử lý | `New`, `In review`, `Resolved` |
| Drill-down | Button/link | Điều hướng sang trang chi tiết | `View course`, `View section` |

### Rule sinh priority

| Priority | Điều kiện |
|---|---|
| 🔴 P1 | Fail rate > 40%, hoặc section anomaly < -15 điểm %, hoặc GPA khoa giảm > 0.3 |
| 🟡 P2 | Cận trượt > 15% lớp, hoặc fail rate tăng 2 kỳ liên tiếp |
| 🟢 P3 | Có dấu hiệu nhẹ, cần theo dõi |

### Sort mặc định

```text
Priority DESC
→ Impact DESC
→ Fail rate DESC
```

### Filter trong table

| Filter | Giá trị |
|---|---|
| Priority | P1 / P2 / P3 |
| Issue type | Course / Section / Department / Student |
| Owner | Phòng ĐT / Khoa / Giảng viên |
| Status | New / In review / Resolved |

### Row action

| Action | Ý nghĩa |
|---|---|
| `View department` | Sang Trang 2, truyền department_id |
| `View course` | Sang Trang 3, truyền course_id |
| `View section` | Sang Trang 4, truyền section_id |
| `Export` | Xuất danh sách cảnh báo |
| `Assign owner` | Gán đơn vị xử lý nếu có workflow |

---

# 6. Trang 2 — Department & Program Diagnosis

## 6.1. Route

```text
/manager/analytics/departments
```

## 6.2. Role sử dụng

| Role | Cần gì từ trang này |
|---|---|
| Trưởng khoa | Biết khoa/ngành nào yếu |
| Trưởng ngành | Biết chương trình nào có môn nút thắt |
| Phòng đào tạo | So sánh hiệu quả đào tạo giữa các khoa |
| QA | Tìm đơn vị có xu hướng suy giảm |

## 6.3. Câu hỏi trung tâm

```text
Khoa/ngành nào đang yếu, yếu ở đâu, và vấn đề đến từ môn nào?
```

---

## 6.4. Filters

| Filter | Kiểu | Mặc định | Tác động |
|---|---|---|---|
| Học kỳ range | Multi-select/range | 3 kỳ gần nhất | Lọc enrollments |
| Khoa | Dropdown | Tất cả | Nếu chọn khoa, drill-down xuống ngành |
| Ngành | Dropdown phụ thuộc khoa | Tất cả | Lọc theo program |
| Khóa SV | Dropdown | Tất cả | Phân tích theo cohort |
| Min enrollment | Number | 20 | Loại đơn vị quá nhỏ |

---

## 6.5. KPI Cards

| KPI | Cách tính | Cách hiển thị | Ý nghĩa |
|---|---|---|---|
| Active students | Count SV active trong filter | `520 SV` | Quy mô |
| Weighted pass rate | Passed / valid enrollments | `74.2%` | Kết quả thật có trọng số |
| Avg GPA cumulative | Avg GPA SV active | `2.71 / 4.0` | Năng lực tích lũy |
| Risk student rate | SV GPA < 2.0 / active SV | `8.4%` | Tỷ lệ SV nguy cơ |
| Bottleneck courses | Count môn đạt rule bottleneck | `7 môn` | Số điểm nghẽn |

---

## 6.6. Chart 1 — Department Performance Quadrant

### Loại chart

Bubble scatter.

| Thành phần | Giá trị |
|---|---|
| X-axis | Total valid enrollments hoặc số SV |
| Y-axis | Pass rate |
| Bubble size | Số SV nguy cơ |
| Color | Risk level hoặc GPA trung bình |

### Vùng diễn giải

| Vùng | Điều kiện | Diễn giải |
|---|---|---|
| High impact risk | Quy mô lớn + pass rate thấp | Ưu tiên xử lý ngay |
| Stable large unit | Quy mô lớn + pass rate cao | Đơn vị ổn định |
| Localized risk | Quy mô nhỏ + pass rate thấp | Vấn đề cục bộ |
| Low priority | Quy mô nhỏ + pass rate cao | Không ưu tiên |

### Tooltip

| Field | Nội dung |
|---|---|
| Khoa/ngành | Tên |
| SV active | Số lượng |
| Valid enrollments | Số lượt học |
| Pass rate | `%` |
| Avg GPA | `/4.0` |
| SV nguy cơ | Số lượng + % |
| Bottleneck courses | Số môn |

---

## 6.7. Chart 2 — Heatmap: Department/Program × Semester

### Khi chưa chọn khoa

| Thành phần | Giá trị |
|---|---|
| Rows | Khoa |
| Columns | Học kỳ |
| Value | Pass rate hoặc risk score |

### Khi đã chọn khoa

| Thành phần | Giá trị |
|---|---|
| Rows | Ngành thuộc khoa |
| Columns | Học kỳ |
| Value | Pass rate hoặc risk score |

### Mục đích

Phát hiện đơn vị có xu hướng suy giảm liên tục.

### Tooltip

```text
Khoa: CNTT
Học kỳ: HK1 2024
Pass rate: 68.5%
Fail rate: 31.5%
Avg grade: 6.1
SV nguy cơ: 42
So với kỳ trước: ↓ 6.2 điểm %
```

---

## 6.8. Chart 3 — 100% Stacked Grade Band

### Loại chart

100% stacked bar.

### Band điểm

| Band | Điều kiện | Ý nghĩa |
|---|---|---|
| Trượt | `< 5.0` | Không đạt |
| Qua yếu | `5.0–6.49` | Qua nhưng chất lượng thấp |
| Khá | `6.5–7.99` | Mức trung bình khá |
| Giỏi | `8.0–8.99` | Mức tốt |
| Xuất sắc | `>= 9.0` | Mức rất tốt |

### Vì sao dùng chart này?

Pass rate chỉ nói qua/trượt. Stacked grade band cho biết chất lượng bên trong.

Ví dụ hai khoa đều pass rate 80%, nhưng:

```text
Khoa A: nhiều SV 8–9 điểm
Khoa B: đa số chỉ 5–6 điểm
```

Kết luận quản trị khác nhau.

---

## 6.9. Chart 4 — Top Bottleneck Courses by Impact

### Loại chart

Bar ngang hoặc ranking table.

### Cách xếp hạng

Ưu tiên dùng:

```text
impact = failed_enrollments
```

Không nên chỉ xếp theo fail rate.

### Field cần có

| Field | Mô tả |
|---|---|
| Course code | Mã môn |
| Course name | Tên môn |
| Department/program | Khoa/ngành liên quan |
| Total enrollments | Tổng lượt học |
| Failed enrollments | Số lượt trượt |
| Fail rate | Tỷ lệ trượt |
| Impact rank | Xếp hạng ảnh hưởng |
| Trend | Tăng/giảm/ổn định qua kỳ |

### Tooltip

```text
Môn: CTDL & GT
Ngành: CNTT
Enrollments: 430
Failed: 126
Fail rate: 29.3%
Trend: tăng 3 kỳ liên tiếp
```

---

## 6.10. Table 2 — Program Drill-down Table

### Mục đích

Cho trưởng khoa biết ngành nào cần ưu tiên, và ngành đó đang bị kéo xuống bởi môn nào.

### Table phải thể hiện gì?

| Cột | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| Program | Text + link | Tên ngành/chương trình | `Hệ thống TMĐT` |
| Department | Text | Khoa quản lý | `Khoa CNTT` |
| Active students | Number | Số SV đang học | `420` |
| Valid enrollments | Number | Tổng lượt học hợp lệ trong filter | `1,850` |
| Pass rate | % + badge | Tỷ lệ qua môn | `72.1% 🟡` |
| Avg GPA | Number | GPA tích lũy TB | `2.68` |
| Risk students | Number + % | SV GPA < 2.0 | `38 (9.0%)` |
| Bottleneck courses | List badge | 3–5 môn ảnh hưởng lớn nhất | `CSDL`, `Toán`, `Python` |
| Trend | Sparkline/badge | Xu hướng pass rate | `↓ 3 kỳ` |
| Action | Button | Điều hướng xem môn/lớp | `View courses` |

### Badge pass rate

| Điều kiện | Badge |
|---|---|
| `>= 75%` | Xanh |
| `60–74.9%` | Vàng |
| `< 60%` | Đỏ |

### Sort mặc định

```text
Risk students DESC
→ Failed enrollments DESC
→ Pass rate ASC
```

### Expand row

Khi expand một ngành, hiển thị top môn trong ngành:

| Course | Enrollments | Failed | Fail rate | Trend | Action |
|---|---:|---:|---:|---|---|
| Cơ sở dữ liệu | 220 | 65 | 29.5% | ↑ | View course |
| Toán rời rạc | 180 | 58 | 32.2% | → | View course |

---

# 7. Trang 3 — Course Bottleneck Analysis

## 7.1. Route

```text
/manager/analytics/courses
```

## 7.2. Role sử dụng

| Role | Cần gì từ trang này |
|---|---|
| Trưởng ngành | Biết môn nào là nút thắt chương trình |
| Trưởng bộ môn | Rà soát nội dung, đề thi, cách tổ chức lớp |
| QA/Khảo thí | Kiểm tra bất thường về phân phối điểm |
| Phòng đào tạo | Theo dõi môn học có nhiều lượt trượt |

## 7.3. Câu hỏi trung tâm

```text
Môn nào là bottleneck và vấn đề đến từ bản thân môn, từng học kỳ hay từng section?
```

---

## 7.4. Filters

| Filter | Kiểu | Mặc định | Tác động |
|---|---|---|---|
| Khoa | Dropdown | Tất cả | Lọc theo khoa/ngành |
| Ngành | Dropdown phụ thuộc khoa | Tất cả | Lọc môn theo chương trình |
| Môn học | Searchable dropdown | Chưa chọn | Khi chọn thì vào detail |
| Học kỳ range | Multi-select/range | Tất cả hoặc 5 kỳ gần nhất | Lọc trend |
| Min section size | Number | 15 | Loại section quá nhỏ |
| Chỉ môn cảnh báo | Toggle | Off | Chỉ hiện bottleneck/anomaly |

Trang này nên có 2 mode:

| Mode | Khi nào dùng | Thành phần chính |
|---|---|---|
| Ranking mode | Chưa chọn môn | Course risk matrix + bottleneck table |
| Detail mode | Đã chọn môn | Trend + section variability + distribution + section table |

---

## 7.5. Ranking Mode — Course Risk Matrix

### Loại chart

Bubble scatter.

| Thành phần | Giá trị |
|---|---|
| X-axis | Total enrollments |
| Y-axis | Fail rate |
| Bubble size | Failed enrollments |
| Color | Trend status: tăng / giảm / ổn định |

### Vùng diễn giải

| Vùng | Điều kiện | Ý nghĩa |
|---|---|---|
| High-impact bottleneck | Enrollment cao + fail rate cao | Ưu tiên xử lý |
| Hidden risk | Enrollment thấp + fail rate cao | Theo dõi, có thể là môn chuyên sâu |
| Mass stable course | Enrollment cao + fail rate thấp | Môn lớn nhưng ổn |
| Low priority | Enrollment thấp + fail rate thấp | Không ưu tiên |

### Tooltip

```text
Môn: Cơ sở dữ liệu
Enrollments: 620
Failed: 180
Fail rate: 29.0%
Trend: tăng 3 kỳ liên tiếp
Section anomaly: 2 lớp
```

---

## 7.6. Table 3 — Course Bottleneck Ranking Table

### Mục đích

Cho người dùng danh sách môn cần rà soát, sắp xếp theo tác động thật.

### Table phải thể hiện gì?

| Cột | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| Rank | Number | Thứ hạng theo impact | `1` |
| Course | Text + link | Mã + tên môn | `CT101 — Cơ sở dữ liệu` |
| Department/Program | Text | Khoa/ngành liên quan | `CNTT / HTTT` |
| Total enrollments | Number | Tổng lượt học hợp lệ | `620` |
| Failed enrollments | Number | Số lượt trượt | `180` |
| Fail rate | % + badge | Tỷ lệ trượt | `29.0% 🟠` |
| Avg grade | Number | Điểm TB | `5.8` |
| Trend | Badge | Xu hướng fail/pass | `↑ 3 kỳ` |
| Section anomalies | Number | Số section lệch bất thường | `2` |
| Impact score | Number | Điểm ảnh hưởng | `180` |
| Action | Button | Xem chi tiết môn | `Analyze` |

### Badge fail rate

| Điều kiện | Badge |
|---|---|
| `< 15%` | Xanh |
| `15–24.9%` | Vàng |
| `25–39.9%` | Cam |
| `>= 40%` | Đỏ |

### Sort mặc định

```text
Impact score DESC
→ Fail rate DESC
→ Trend severity DESC
```

### Filter trong table

| Filter | Giá trị |
|---|---|
| Risk level | Low / Medium / High |
| Trend | Tăng / Giảm / Ổn định |
| Department | Khoa |
| Program | Ngành |
| Has anomaly | Có / Không |

---

## 7.7. Detail Mode — KPI Cards

Sau khi chọn một môn:

| KPI | Cách tính | Hiển thị | Ý nghĩa |
|---|---|---|---|
| Total enrollments | Count valid enrollments của môn | `620` | Quy mô môn |
| Pass rate | Passed / valid | `71.0%` | Hiệu quả tổng hợp |
| Avg final grade | Avg `final_grade` | `5.8 / 10` | Mặt bằng điểm |
| Failed enrollments | Count failed | `180` | Quy mô rủi ro |
| Section variance | Max section pass rate - min section pass rate | `28 điểm %` | Chênh lệch giữa các lớp |

---

## 7.8. Chart — Pass Rate Trend with Target Line

| Thành phần | Giá trị |
|---|---|
| X-axis | Học kỳ |
| Y-axis | Pass rate |
| Target line | 70% hoặc 75% |
| Marker đỏ | Kỳ có fail rate > 40% |

Tooltip:

```text
HK1 2024
Pass rate: 68.2%
Passed: 150 / 220
So với kỳ trước: ↓ 7.5 điểm %
```

---

## 7.9. Chart — Avg Grade Trend

| Thành phần | Giá trị |
|---|---|
| X-axis | Học kỳ |
| Y-axis | Avg final_grade |
| Reference line | 5.0 hoặc target 6.5 |

Diễn giải kết hợp với pass rate:

| Pattern | Diễn giải |
|---|---|
| Pass rate giảm + avg grade giảm | Môn/kỳ đang khó hơn hoặc SV yếu hơn |
| Pass rate giảm + avg grade ổn | Nhiều SV sát ngưỡng 5.0 |
| Pass rate tăng + avg grade giảm | Có khả năng nới ngưỡng/điểm sát qua tăng |
| Pass rate ổn + avg grade giảm | Chất lượng chung suy giảm |

---

## 7.10. Chart — Section Variability Dot Plot

### Loại chart

Dot plot hoặc bar benchmark.

| Thành phần | Giá trị |
|---|---|
| X-axis | Section code |
| Y-axis | Section pass rate |
| Reference line | Course average pass rate |
| Color | Đỏ nếu thấp hơn TB môn > 15 điểm % |

### Mục đích

Phát hiện section bất thường.

Tooltip:

```text
Section: CT101-02
Pass rate: 58%
Course avg: 76%
Difference: -18 điểm %
SV: 45
Giảng viên: nếu có dữ liệu
```

---

## 7.11. Chart — Grade Distribution

### Khoảng điểm đề xuất

| Band | Điều kiện | Ý nghĩa |
|---|---|---|
| Rất yếu | `0–4.0` | Trượt nặng |
| Cận trượt | `4.0–5.0` | Có thể can thiệp |
| Qua yếu | `5.0–6.5` | Qua nhưng nền yếu |
| Khá | `6.5–8.0` | Ổn |
| Giỏi | `8.0–9.0` | Tốt |
| Xuất sắc | `9.0–10` | Rất tốt |

---

## 7.12. Table 4 — Course Section Detail Table

### Mục đích

So sánh tất cả section của cùng một môn để tìm lớp bất thường.

### Table phải thể hiện gì?

| Cột | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| Section | Text + link | Mã lớp học phần | `CT101-02` |
| Semester | Text | Học kỳ | `HK1 2024` |
| Students | Number | Số SV trong lớp | `45` |
| Valid grades | Number | Số SV có điểm hợp lệ | `43` |
| Pass rate | % + badge | Tỷ lệ qua | `58% 🔴` |
| Course avg | % | Pass rate trung bình môn cùng kỳ hoặc toàn kỳ | `76%` |
| Difference | điểm % + badge | Section - course avg | `-18 điểm % ⚠️` |
| Avg grade | Number | Điểm TB lớp | `5.4` |
| Median grade | Number | Trung vị điểm | `5.1` |
| Failed students | Number | Số SV trượt | `18` |
| Near-fail students | Number | Số SV 4.0–5.0 | `9` |
| Status | Badge | Normal / Warning / Anomaly | `Anomaly` |
| Action | Button | Xem lớp | `View section` |

### Sort mặc định

```text
Status severity DESC
→ Difference ASC
→ Failed students DESC
```

### Điều kiện status

| Status | Điều kiện |
|---|---|
| Anomaly | Difference <= -15 điểm % |
| Warning | Pass rate < 70% hoặc near-fail > 15% |
| Normal | Không vi phạm rule |

---

# 8. Trang 4 — Section & Student Intervention

## 8.1. Route

```text
/manager/analytics/sections
```

## 8.2. Role sử dụng

| Role | Cần gì từ trang này |
|---|---|
| Giảng viên | Biết lớp mình có vấn đề gì |
| Cố vấn học tập | Lấy danh sách SV cần hỗ trợ |
| Phòng đào tạo | Theo dõi lớp học phần bất thường |
| Trưởng bộ môn | So sánh section với mặt bằng môn |

## 8.3. Câu hỏi trung tâm

```text
Lớp nào đang cần can thiệp, sinh viên nào cần xử lý trước, và vì sao?
```

---

## 8.4. Filters

| Filter | Kiểu | Mặc định | Tác động |
|---|---|---|---|
| Học kỳ | Dropdown | Kỳ hiện tại | Lọc section |
| Khoa | Dropdown | Tất cả | Lọc theo khoa |
| Ngành | Dropdown phụ thuộc khoa | Tất cả | Lọc theo program |
| Môn học | Searchable dropdown | Tất cả | Lọc section theo môn |
| Section | Searchable dropdown | Chưa chọn | Chọn lớp để xem detail |
| Risk level | Multi-select | High + Medium | Lọc danh sách sinh viên |
| Student status | Multi-select | Trượt + Cận trượt + Qua yếu | Lọc intervention list |

---

## 8.5. Table 5 — Section Finder Table

Đây là bảng cần có trước khi người dùng chọn section.

### Mục đích

Không bắt người dùng phải biết trước lớp nào có vấn đề. Dashboard phải tự gợi ý lớp cần xem.

### Table phải thể hiện gì?

| Cột | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| Risk | Badge | Mức cảnh báo của section | `🔴 High` |
| Section | Text + link | Mã lớp học phần | `CT101-02` |
| Course | Text | Môn học | `Cơ sở dữ liệu` |
| Department/Program | Text | Khoa/ngành chính | `CNTT / HTTT` |
| Semester | Text | Học kỳ | `HK1 2024` |
| Students | Number | Sĩ số lớp | `45` |
| Pass rate | % + badge | Tỷ lệ qua | `58% 🔴` |
| Course benchmark | % | Pass rate TB môn | `76%` |
| Difference | điểm % | Lệch so với TB môn | `-18 điểm %` |
| Avg grade | Number | Điểm TB lớp | `5.4` |
| Failed students | Number | SV trượt | `18` |
| Near-fail students | Number | SV 4.0–5.0 | `9` |
| Watch students | Number | SV 5.0–5.5 | `6` |
| Suggested action | Text | Gợi ý xử lý | `Kiểm tra lớp + gửi cố vấn` |
| Action | Button | Xem chi tiết | `Open` |

### Risk rule

| Risk | Điều kiện |
|---|---|
| 🔴 High | Difference <= -15 điểm % hoặc fail rate >= 40% |
| 🟠 Medium | Pass rate < 70% hoặc near-fail students > 15% |
| 🟡 Watch | Watch students > 20% |
| 🟢 Normal | Không có cảnh báo |

### Sort mặc định

```text
Risk severity DESC
→ Difference ASC
→ Failed students DESC
→ Near-fail students DESC
```

### Filter trong table

| Filter | Giá trị |
|---|---|
| Risk | High / Medium / Watch / Normal |
| Course | Môn học |
| Department | Khoa |
| Semester | Học kỳ |
| Has anomaly | Có / Không |

---

## 8.6. Section Detail KPI Cards

Sau khi chọn section:

| KPI | Công thức | Hiển thị | Cảnh báo |
|---|---|---|---|
| Students | Count enrollments section | `45 SV` | Không |
| Pass rate | Passed / valid | `58%` | Đỏ nếu `< 70%` |
| Avg grade | Avg final_grade | `5.4 / 10` | Đỏ nếu `< 5.0` |
| Median grade | Median final_grade | `5.1 / 10` | Cảnh báo nếu `< 5.0` |
| Failed students | Count final_grade < 5.0 | `18` | Đỏ nếu `> 0` |
| Near-fail students | Count 4.0–5.0 | `9` | Vàng nếu `> 15% lớp` |

---

## 8.7. Chart — Grade Distribution with Risk Bands

### Loại chart

Histogram/bar theo band điểm.

| Band | Điều kiện | Màu logic | Ý nghĩa |
|---|---|---|---|
| 0–4.0 | Trượt nặng | Đỏ đậm | Cần can thiệp mạnh |
| 4.0–5.0 | Cận trượt | Cam | Có thể cứu bằng phụ đạo |
| 5.0–5.5 | Qua yếu | Vàng | Cần theo dõi |
| 5.5–6.5 | Trung bình | Xám/xanh nhạt | Tạm ổn |
| 6.5–8.0 | Khá | Xanh |
| 8.0–10 | Tốt | Xanh đậm |

### Tooltip

```text
Band: 4.0–5.0
Số SV: 9
Tỷ trọng lớp: 20%
Ý nghĩa: Cận trượt, nên ưu tiên hỗ trợ
```

---

## 8.8. Chart — Section vs Course Benchmark

### Loại chart

Benchmark table/chart hoặc bullet chart.

### Metric cần so sánh

| Metric | Section | Course same semester avg | Course all-time avg | Target |
|---|---:|---:|---:|---:|
| Pass rate | 58% | 76% | 74% | 70% |
| Avg grade | 5.4 | 6.3 | 6.4 | 6.5 |
| Median grade | 5.1 | 6.1 | 6.2 | 6.0 |
| Near-fail rate | 20% | 11% | 12% | < 15% |
| Failed students | 18 | — | — | — |

### Mục đích

Trả lời:

```text
Lớp này yếu vì môn vốn khó, hay vì section này bất thường?
```

---

## 8.9. Chart — Student Risk Funnel / Status Stack

### Option A: Funnel

```text
Tổng SV trong lớp
→ Có điểm hợp lệ
→ Qua môn
→ Qua nhưng yếu
→ Cận trượt
→ Trượt
```

### Option B: Stacked status bar

| Segment | Điều kiện |
|---|---|
| Trượt nặng | `< 4.0` |
| Cận trượt | `4.0–5.0` |
| Qua yếu | `5.0–5.5` |
| Qua ổn | `5.5–8.0` |
| Tốt | `>= 8.0` |

Nếu thư viện chart hạn chế, dùng stacked bar dễ hơn funnel.

---

## 8.10. Table 6 — Intervention List

Đây là bảng quan trọng nhất của Trang 4.

### Mục đích

Tạo danh sách sinh viên cần xử lý ngay.

### Table phải thể hiện gì?

| Cột | Kiểu | Mô tả | Ví dụ |
|---|---|---|---|
| Priority | Badge | Mức ưu tiên xử lý | `🔴 P1` |
| MSSV | Text + link | Mã sinh viên | `2021601234` |
| Họ tên | Text | Tên sinh viên | `Nguyễn Văn A` |
| Program/Class | Text | Ngành/lớp hành chính nếu có | `HTTT / D17HTTMDT` |
| Final grade | Number | Điểm cuối kỳ | `4.6` |
| Status | Badge | Trượt / Cận trượt / Qua yếu / Bình thường | `Cận trượt` |
| GPA cumulative | Number | GPA tích lũy | `1.92` |
| Failed courses this semester | Number | Số môn trượt kỳ này | `2` |
| Risk reason | Text | Vì sao bị cảnh báo | `GPA < 2.0 + final 4.6` |
| Suggested action | Text | Hành động đề xuất | `Gửi cố vấn + phụ đạo` |
| Owner | Text | Người/đơn vị xử lý | `Cố vấn học tập` |
| Contact status | Badge | Đã/Chưa liên hệ | `Not contacted` |
| Action | Button | Thao tác | `Mark contacted`, `Export` |

### Priority rule

| Priority | Điều kiện |
|---|---|
| 🔴 P1 | `final_grade < 4.0` hoặc `gpa_cumulative < 2.0` hoặc trượt >= 2 môn/kỳ |
| 🟠 P2 | `4.0 <= final_grade < 5.0` |
| 🟡 P3 | `5.0 <= final_grade < 5.5` |
| 🟢 Normal | `final_grade >= 5.5` và GPA ổn |

### Sort mặc định

```text
Priority DESC
→ Final grade ASC
→ GPA cumulative ASC
→ Failed courses this semester DESC
```

### Filter trong table

| Filter | Giá trị |
|---|---|
| Priority | P1 / P2 / P3 |
| Status | Trượt / Cận trượt / Qua yếu |
| GPA risk | GPA < 2.0 / GPA >= 2.0 |
| Contact status | Not contacted / Contacted / Resolved |

### Row action

| Action | Ý nghĩa |
|---|---|
| `Mark contacted` | Đánh dấu đã liên hệ |
| `Export selected` | Xuất danh sách gửi cố vấn |
| `View student` | Mở trang chi tiết sinh viên nếu có |
| `Add note` | Ghi chú xử lý nếu có workflow |

---

# 9. Empty states và data quality

## 9.1. Empty state

| Tình huống | Message nên hiển thị |
|---|---|
| Không có enrollment | `Chưa có dữ liệu điểm học phần cho bộ lọc này.` |
| Chưa chọn môn | `Chọn một môn học hoặc xem danh sách môn có rủi ro cao bên dưới.` |
| Chưa chọn section | `Chọn một lớp học phần hoặc mở lớp từ Section Finder.` |
| Dữ liệu quá ít | `Dữ liệu dưới ngưỡng tối thiểu, kết quả có thể không đại diện.` |

## 9.2. Data quality warning

Nên có warning nhỏ ở đầu dashboard nếu:

| Điều kiện | Warning |
|---|---|
| Nhiều final_grade null | `Một phần dữ liệu chưa có điểm cuối kỳ.` |
| Enrollment thấp hơn min threshold | `Một số môn/lớp bị loại khỏi cảnh báo do sĩ số thấp.` |
| Không có mapping program/department | `Một số sinh viên chưa được gắn ngành/khoa.` |
| Không có current semester | `Chưa xác định học kỳ hiện tại.` |

---

# 10. Tổng hợp tables cần có

| Trang | Table | Vai trò chính | Bắt buộc? |
|---|---|---|---|
| Trang 1 | Decision Queue / Action Table | Chuyển insight thành hành động | Bắt buộc |
| Trang 2 | Program Drill-down Table | So sánh ngành trong khoa | Bắt buộc |
| Trang 3 | Course Bottleneck Ranking Table | Xếp hạng môn có vấn đề | Bắt buộc |
| Trang 3 | Course Section Detail Table | So sánh section cùng môn | Bắt buộc |
| Trang 4 | Section Finder Table | Tìm lớp bất thường trước khi chọn | Bắt buộc |
| Trang 4 | Intervention List | Danh sách SV cần can thiệp | Bắt buộc |

---

# 11. Gợi ý layout tổng thể

## Trang 1

```text
[Filters]

[KPI] [KPI] [KPI] [KPI] [KPI]

[Executive Health Trend - full width]

[Risk Heatmap 60%] [Pareto 40%]

[Decision Queue - full width]
```

## Trang 2

```text
[Filters]

[KPI] [KPI] [KPI] [KPI] [KPI]

[Performance Quadrant 50%] [Heatmap 50%]

[Stacked Grade Band - full width]

[Program Drill-down Table - full width]
```

## Trang 3

```text
[Filters]

Nếu chưa chọn môn:
[Course Risk Matrix]
[Course Bottleneck Ranking Table]

Nếu đã chọn môn:
[KPI] [KPI] [KPI] [KPI] [KPI]

[Pass Rate Trend 50%] [Avg Grade Trend 50%]

[Section Variability 50%] [Grade Distribution 50%]

[Course Section Detail Table]
```

## Trang 4

```text
[Filters]

[Section Finder Table]

Nếu đã chọn section:
[KPI] [KPI] [KPI] [KPI] [KPI] [KPI]

[Grade Distribution 40%] [Benchmark 60%]

[Student Risk Funnel / Stack]

[Intervention List]
```

---

# 12. Lưu ý kỹ thuật

## 12.1. Frontend tính analytics từ OLTP

MVP có thể làm:

```text
Frontend fetch raw data
→ join trong memory
→ aggregate
→ render charts/tables
```

Nhưng cần cảnh báo:

| Vấn đề | Rủi ro |
|---|---|
| `limit=3000` enrollments | Có thể thiếu dữ liệu |
| Join nhiều bảng ở frontend | Code phức tạp, dễ sai |
| Metric tính ở nhiều component | Không nhất quán |
| Dữ liệu lớn | Dashboard chậm |

## 12.2. Khuyến nghị bước tiếp theo

Sau MVP nên tạo analytics endpoints:

```text
GET /api/v1/analytics/overview
GET /api/v1/analytics/departments
GET /api/v1/analytics/courses
GET /api/v1/analytics/courses/{course_id}
GET /api/v1/analytics/sections
GET /api/v1/analytics/sections/{section_id}
GET /api/v1/analytics/risk-students
```

Frontend chỉ render và drill-down, không tự gánh toàn bộ metric logic.

---

# 13. Kết luận thiết kế

Dashboard này nên được hiểu là hệ thống phân tích theo luồng hành động:

```text
Tổng quan điều hành
→ Chẩn đoán khoa/ngành
→ Phân tích môn học nút thắt
→ Can thiệp lớp học phần và sinh viên
```

Điểm khác biệt quan trọng so với dashboard mô tả thông thường:

| Dashboard mô tả | Dashboard đề xuất |
|---|---|
| Vẽ pass rate, GPA, distribution | Tạo risk score, anomaly, impact |
| Người dùng tự tìm vấn đề | Dashboard gợi ý vấn đề cần xử lý |
| Bar/line rời rạc | Heatmap, matrix, benchmark, action table |
| Xem số liệu | Ra quyết định và drill-down |
| Tập trung chart | Tập trung table hành động |

Trọng tâm cuối cùng:

```text
Không phải “có bao nhiêu biểu đồ”.
Mà là “người dùng nhìn xong biết phải xử lý việc gì, ở đâu, với ai”.
```
