# Dashboard Analytics — Phân tích 4 trang

Mỗi trang trả lời một câu hỏi ở cấp độ khác nhau, từ tổng quan đến cảnh báo cá nhân.

---

## Trang 1 — Executive Overview / Toàn trường

**Mục tiêu:** Ban quản lý nhìn nhanh tình hình toàn trường, phát hiện vấn đề cần xử lý ngay.

**Route:** `/manager/analytics`

---

### 5 KPI Cards

| Card | Giá trị | Cảnh báo đỏ khi |
|---|---|---|
| Tổng SV đang học | Đếm `status = active` | — |
| Pass rate kỳ hiện tại | % `is_passed = true` trong kỳ `is_current = true` | < 70% |
| GPA trung bình | Avg `gpa_cumulative` của SV active | < 2.5 |
| SV nguy cơ | Số SV `gpa_cumulative < 2.0` | > 0 |
| Môn / lớp cảnh báo | Số section có fail rate > 40% | > 0 |

---

### 2 Biểu đồ (2 cột song song)

**Biểu đồ 1 — Line: "Trend pass rate theo học kỳ"**
- Trục X: Mã học kỳ (HK1 2022 → HK2 2024)
- Trục Y: Tỷ lệ qua môn (%)
- Đường tham chiếu ngang ở 70% (ngưỡng cảnh báo)
- Hiển thị toàn bộ lịch sử — cho thấy xu hướng cải thiện hay suy giảm

**Biểu đồ 2 — Line: "Trend GPA theo học kỳ"**
- Trục X: Mã học kỳ
- Trục Y: Điểm trung bình (thang 10)
- Cùng row với biểu đồ 1 để so sánh hai xu hướng song song

> Trang 1 chỉ giữ 2 line charts + Action Table. Chi tiết môn / lớp bất thường chuyển sang **Trang 2** để xem theo góc nhìn khoa.

---

### Action Table — "Vấn đề cần xử lý ngay"

Bảng tổng hợp tất cả cảnh báo được phát hiện tự động từ dữ liệu:

| Mức độ | Đơn vị | Vấn đề | Gợi ý xử lý |
|---|---|---|---|
| 🔴 Cao | Môn A | Fail rate 45% | Review đề thi / tăng cường hỗ trợ học tập |
| 🔴 Cao | Khoa B | GPA giảm 0.4 so kỳ trước | Kiểm tra nhóm môn nền tảng |
| 🟡 TB | Lớp C | 20 SV cận trượt (4.5–5.0) | Gửi cảnh báo đến cố vấn học tập |
| 🟡 TB | Môn D | Fail rate tăng 3 kỳ liên tiếp | Rà soát nội dung + đề kiểm tra |

**Logic sinh cảnh báo tự động:**
- Cao: fail rate > 40% **hoặc** GPA khoa giảm > 0.3 so kỳ trước
- Trung bình: SV có `final_grade` trong khoảng 4.5–5.0 (cận trượt) > 15% lớp
- Cần xử lý: môn có fail rate tăng liên tiếp ≥ 3 kỳ

---

## Trang 2 — Department / Program Analytics

**Mục tiêu:** So sánh hiệu quả đào tạo giữa các khoa và ngành theo thời gian.

**Route:** `/manager/analytics/departments`

---

### Filters
| Filter | Giá trị | Ảnh hưởng |
|---|---|---|
| Học kỳ | Multi-select hoặc range | Lọc dữ liệu enrollments |
| Khoa | Dropdown | Drill-down vào 1 khoa |
| Ngành | Dropdown (phụ thuộc khoa) | Drill-down vào 1 ngành |

---

### 4 KPI Cards (thay đổi theo filter)

| Card | Hiển thị |
|---|---|
| Số khoa / ngành | Tổng số đơn vị đang lọc |
| Tổng SV | Tổng SV trong filter |
| Pass rate TB | Weighted average qua tất cả đơn vị |
| GPA TB | Weighted average GPA |

---

### 6 Biểu đồ / Bảng (chia 2 phần: So sánh khoa & Drill-down vấn đề)

#### Phần A — So sánh tất cả khoa

**Biểu đồ 1 — Bar dọc: "Pass rate theo khoa"**
- Mỗi cột = 1 khoa
- Màu: xanh ≥ 75% | vàng 60–74% | đỏ < 60%

**Biểu đồ 2 — Bar dọc: "GPA trung bình theo khoa"**
- Thang 0–4.0 (GPA tích lũy)
- So sánh trực tiếp năng lực học tập giữa các khoa

**Biểu đồ 3 — Bar dọc: "Số SV nguy cơ theo khoa"**
- Đếm SV `gpa_cumulative < 2.0` theo từng khoa
- Màu đỏ nhấn mạnh — đây là đơn vị cần ưu tiên can thiệp

**Heatmap — "Pass rate: Khoa × Học kỳ"**

```
             HK1-22  HK2-22  HK1-23  HK2-23  HK1-24
Khoa CNTT     82%     79%     85%     81%     78%
Khoa Điện     71%     68%     65%     62%     60%   ← đang xấu dần
Khoa Kinh tế  74%     76%     75%     73%     72%
```

- Rows: Khoa | Columns: Học kỳ | Value: Pass rate (%)
- Màu: gradient xanh → đỏ theo giá trị
- **Biểu đồ quan trọng nhất phần này**: phát hiện khoa nào đang suy giảm dần theo thời gian mà tổng hợp pass rate không thấy được

#### Phần B — Drill-down vào khoa đang chọn (filter Khoa)

Khi user chọn 1 khoa ở filter, 2 biểu đồ này hiển thị vấn đề cụ thể bên trong khoa đó:

**Biểu đồ 5 — Bar ngang: "Top 10 môn trượt cao nhất trong khoa"**
- Chỉ lấy môn thuộc khoa đang chọn (qua `program_courses` và `program.department_id`)
- Sorted giảm dần theo fail rate
- Màu theo mức: ≥ 40% đỏ | 25–40% cam | < 25% vàng
- Tooltip: Tên đầy đủ | Trượt N/M (X%)
- Trả lời: *"Môn nào đang kéo kết quả khoa xuống?"*

**Biểu đồ 6 — Bar ngang: "Top 10 lớp học phần bất thường trong khoa"**
- Lọc section thuộc khoa đang chọn có fail rate vượt TB môn đó ≥ 15 điểm phần trăm
- Hiển thị: Mã lớp | Tên môn | Fail rate | Chênh so với TB môn
- Màu đỏ toàn bộ — đây là danh sách cần can thiệp trực tiếp
- Trả lời: *"Lớp nào đang dạy kém hơn các lớp khác cùng môn?"*

> Khi chưa chọn khoa cụ thể ("Tất cả"), biểu đồ 5 & 6 hiển thị toàn trường.

**Mối liên kết dữ liệu:**
```
enrollment.student_id → student.program_id → program.department_id → department
```

---

## Trang 3 — Course Analytics

**Mục tiêu:** Phân tích sâu 1 môn học qua nhiều học kỳ — trả lời câu hỏi: môn này có đang là "nút thắt" của chương trình không?

**Route:** `/manager/analytics/courses`

---

### Filters
| Filter | Thứ tự chọn | Giá trị |
|---|---|---|
| Khoa | 1 | Dropdown |
| Ngành | 2 (phụ thuộc khoa) | Dropdown |
| Môn học | 3 | Dropdown — `{code} — {tên môn}` |

---

### 5 KPI Cards

| Card | Hiển thị | Ghi chú |
|---|---|---|
| Tổng lượt học | Tổng enrollments qua tất cả kỳ | |
| Pass rate tổng hợp | % passed / tổng valid | |
| Avg grade | Avg `final_grade` thang 10 | |
| Số lớp học phần | Số section tồn tại | |
| Fail rate cao nhất | Max fail rate trong 1 học kỳ bất kỳ | Badge đỏ nếu > 40% |

---

### 4 Biểu đồ

**Biểu đồ 1 — Line: "Trend pass rate theo học kỳ"**
- Trục X: Mã học kỳ | Trục Y: Pass rate (%)
- Nếu đường đi xuống liên tục → môn đang trở thành nút thắt

**Biểu đồ 2 — Line: "Trend avg grade theo học kỳ"**
- Trục X: Mã học kỳ | Trục Y: Điểm TB (thang 10)
- Kết hợp với biểu đồ 1 để phân biệt: SV yếu hơn hay đề thi khó hơn?

**Biểu đồ 3 — Bar dọc: "Distribution điểm (tổng hợp)"**
- 6 khoảng: `0–4 | 4–5 | 5–6 | 6–7 | 7–8 | 8–10`
- Màu gradient đỏ → xanh
- Hình dạng phân phối: lệch trái = môn khó | lệch phải = môn dễ

**Bảng — "Chi tiết các section của môn"**

| Mã lớp | Học kỳ | SV đăng ký | Pass rate | So với TB |
|---|---|---|---|---|
| CT001-01 | HK1 2022 | 45 | 82% | +5% |
| CT001-02 | HK1 2022 | 38 | 61% | -16% ⚠️ |

- Cột "So với TB": so pass rate lớp với pass rate TB của môn đó
- Badge đỏ nếu lệch âm > 15% → lớp đó cần điều tra

---

## Trang 4 — Section & Student Risk Analytics

**Mục tiêu:** Xác định lớp học phần nào và sinh viên nào cần can thiệp ngay.

**Route:** `/manager/analytics/sections`

---

### Filters
| Filter | Thứ tự | Giá trị |
|---|---|---|
| Học kỳ | 1 | Dropdown |
| Môn học | 2 | Dropdown (lọc theo HK) |
| Lớp học phần | 3 | Dropdown — `{section_code}` |

---

### 5 KPI Cards

| Card | Hiển thị | Cảnh báo |
|---|---|---|
| SV trong lớp | Số enrollment | — |
| Pass rate | % passed | Đỏ < 70% |
| Avg grade | Avg `final_grade` | — |
| SV trượt | Số `is_passed = false` | Badge đỏ |
| SV cận trượt | Số SV `final_grade` trong 4.5–5.0 | Badge vàng |

---

### 3 Biểu đồ / Bảng

**Biểu đồ 1 — Bar dọc: "Phân bổ điểm lớp này"**
- 6 khoảng điểm: `0–4 | 4–5 | 5–6 | 6–7 | 7–8 | 8–10`
- Màu gradient đỏ → xanh

**Biểu đồ 2 — Bar so sánh: "Lớp này vs trung bình môn"**
- 2 đường / 2 cột grouped: Lớp đang chọn vs Avg tất cả lớp cùng môn
- Cho thấy ngay lớp này đang ở đâu so với mặt bằng chung

**Bảng — "Danh sách SV cần chú ý"**

| MSSV | Họ tên | Điểm | Trạng thái | Mức cảnh báo |
|---|---|---|---|---|
| SV001 | Nguyễn A | 3.8 | Trượt | 🔴 Cao |
| SV002 | Trần B | 4.7 | Cận trượt | 🟡 Trung bình |
| SV003 | Lê C | 5.1 | Qua — nguy cơ | 🟡 Trung bình |

- **Trượt**: `is_passed = false`
- **Cận trượt**: `final_grade` trong khoảng 4.5–5.0
- **Qua — nguy cơ**: `final_grade` trong 5.0–5.5 (qua nhưng rất sát ngưỡng)
- Sorted: Trượt trước → Cận trượt → Nguy cơ → còn lại
- Có thể export danh sách để gửi cố vấn học tập

---

## Routing & Navigation

```
/manager/analytics                  → Trang 1: Executive Overview
/manager/analytics/departments      → Trang 2: Department / Program
/manager/analytics/courses          → Trang 3: Course Analytics
/manager/analytics/sections         → Trang 4: Section & Student Risk
```

Sidebar group "Phân tích" gồm 4 mục tương ứng.

---

## Nguồn dữ liệu

| Endpoint | Trang sử dụng |
|---|---|
| `GET /api/v1/students?limit=500` | 1, 2 |
| `GET /api/v1/grades/enrollments?limit=3000` | 1, 2, 3, 4 |
| `GET /api/v1/courses?limit=200` | 1, 3, 4 |
| `GET /api/v1/sections?limit=300` | 1, 3, 4 |
| `GET /api/v1/semesters` | 1, 2, 3, 4 |
| `GET /api/v1/departments?limit=100` | 2 |
| `GET /api/v1/programs?limit=100` | 2, 3 |

Tất cả analytics tính trên **frontend từ OLTP** — không phụ thuộc DWH.

---

## Lý do chọn chart type

| Chart | Dùng khi | Không dùng khi |
|---|---|---|
| **Bar ngang** | So sánh nhiều môn — tên dài | > 15 items, dùng table thay |
| **Bar dọc** | So sánh ít thực thể (khoa, khoảng điểm) | Tên label dài |
| **Line** | Xu hướng theo thứ tự thời gian | Dữ liệu không có thứ tự |
| **Donut/Pie** | Tỷ trọng trong tổng (≤ 6 phần) | > 6 phần, dùng bar thay |
| **Heatmap** | Ma trận 2 chiều (khoa × kỳ) — thấy pattern qua thời gian | Quá nhiều rows/cols |
| **Table** | Drill-down cụ thể, cần hành động (action table) | Muốn thấy trend |
