# Gate G2 Evaluation Evidences

**Ngrok Public URL:** https://spectrum-dullness-ambiguous.ngrok-free.dev
**Testing Date:** 15/06/2026

## Tổng hợp kết quả 10 Test Cases

| TC | Input | Result | Status | Screenshot |
|----|-------|--------|--------|------------|
| TC1 | "Top 5 môn có tỷ lệ trượt cao nhất ngành Công nghệ thông tin?" | Lỗi HTTP 500 (Internal Server Error) | Fail | Bỏ qua |
| TC2 | "GPA trung bình khóa K21 ngành Công nghệ thông tin là bao nhiêu?" | GPA là 2.275 | Pass | Bỏ qua |
| TC3 | "So sánh tỷ lệ trượt môn Cơ sở dữ liệu của K21 và K22?" | Tỷ lệ trượt K21 (31.88%) cao hơn K22 (31.19%) | Pass | Bỏ qua |
| TC4 | "Chào bạn, chức năng chính của bạn là gì?" | Phân loại Fast Response thành công | Pass | Bỏ qua |
| TC5 | "CLO nào đạt thấp nhất ở môn Tiếng Anh 1?" | Không tìm thấy dữ liệu CLO (xử lý graceful) | Pass | Bỏ qua |
| TC6 | "Khóa K21 ngành Công nghệ thông tin có bao nhiêu sinh viên?" | Đếm được 100 sinh viên | Pass | Bỏ qua |
| TC7 | "Liệt kê 3 sinh viên có GPA tích lũy cao nhất ngành Trí tuệ nhân tạo." | Trả về 1 SV vì ngành chỉ có 1 bản ghi | Pass | Bỏ qua |
| TC8 | "Tỷ lệ qua môn (pass) của môn Hệ quản trị cơ sở dữ liệu là bao nhiêu?" | Tính được tỷ lệ pass 53.21% | Pass | Bỏ qua |
| TC9 | "Điểm trung bình môn Toán cao cấp 1 của khóa K22 có thấp hơn K21 không?" | Suy luận chính xác: Có (K22 2.03 < K21 2.85) | Pass | Bỏ qua |
| TC10 | "Môn nào có số sinh viên đăng ký nhiều nhất ngành Công nghệ kỹ thuật cơ điện tử?" | Môn Hệ thống sản xuất tự động (3 SV) | Pass | Bỏ qua |

## Chi tiết Test Cases

### TC1: Lọc + Aggregation
- **Input:** "Top 5 môn có tỷ lệ trượt cao nhất ngành Công nghệ thông tin?"
- **Kỳ vọng:** Trả về danh sách 5 môn với % trượt.
- **Evidence:** `Lỗi HTTP 500 (Internal Server Error) từ Agent API.`

### TC2: Cohort + Aggregation
- **Input:** "GPA trung bình khóa K21 ngành Công nghệ thông tin là bao nhiêu?"
- **Kỳ vọng:** Trả về con số GPA chính xác.
- **Evidence:** 
```text
Thầy/cô hỏi **GPA trung bình khóa K21 ngành Công nghệ thông tin**. Kết quả từ dữ liệu hiện có cho thấy:

| Khóa | Ngành (chương trình) | GPA trung bình (cumulative) |
|---|---|---:|
| K21 | Công nghệ thông tin | 2.275 |

> 💡 **Nhận xét:** GPA trung bình khóa K21 ngành Công nghệ thông tin hiện ở mức khoảng **2.275**. Nếu thầy/cô muốn, tôi có thể tách theo **học kỳ** hoặc theo **lớp (class_code)** để nhìn rõ hơn.
```

### TC3: So sánh 2 đối tượng
- **Input:** "So sánh tỷ lệ trượt môn Cơ sở dữ liệu của K21 và K22?"
- **Kỳ vọng:** Có 2 số liệu so sánh + nhận xét xu hướng.
- **Evidence:** 
```text
Thầy/cô yêu cầu so sánh tỷ lệ trượt **môn Cơ sở dữ liệu** giữa **K21** và **K22**. Tôi lấy trên các **enrollments có `status = 'completed'`**.

| Khóa | Số SV trượt (fail_count) | Tổng đăng ký (enrollment_count) | Tỷ lệ trượt (%) |
|---|---:|---:|---:|
| K21 | 66 | 207 | 31.88% |
| K22 | 34 | 109 | 31.19% |

**So sánh nhanh:** Tỷ lệ trượt K21 cao hơn K22 khoảng **0.69 điểm %**.

> 💡 **Nhận xét:** Hai khóa có tỷ lệ trượt gần như tương đương (~31%), chênh lệch không lớn. Nếu thầy/cô muốn, tôi có thể tách theo **học kỳ** hoặc theo **từng lớp/phần giảng (section)** để tìm nguyên nhân chênh lệch.
```

### TC4: Fast response
- **Input:** "Chào bạn, chức năng chính của bạn là gì?"
- **Kỳ vọng:** Trả lời nhanh, không gọi SQL.
- **Evidence:** 
```text
Chào bạn! Tôi là EduInsight AI của EPU, hỗ trợ phân tích học vụ và trả lời các câu hỏi giao tiếp đơn giản. Nếu bạn cần, tôi có thể giúp bạn diễn giải thông tin học tập theo hướng dẫn chung và gợi ý cách đặt câu hỏi để tìm đúng dữ liệu. Bạn muốn hỏi về vấn đề học vụ nào cụ thể (ví dụ điểm, môn học, đăng ký, học phí, kế hoạch học)?
```

### TC5: JOIN phức tạp (CLO)
- **Input:** "CLO nào đạt thấp nhất ở môn Tiếng Anh 1?"
- **Kỳ vọng:** Trả về CLO cụ thể từ CSDL.
- **Evidence:** 
```text
Thầy/cô ơi, tôi vừa truy vấn nhưng **không tìm thấy dữ liệu CLO/PLO gắn với môn “Tiếng Anh 1”** trong hệ thống (kết quả rỗng).  

Gợi ý thầy/cô kiểm tra giúp:
- Tên môn trong dữ liệu có thể **không đúng “Tiếng Anh 1”** (ví dụ: “English 1”, “Tiếng Anh 1 (….)”, hoặc mã môn khác).
- Hoặc dữ liệu **`student_clo_achievements`** chưa được ghi cho lớp/môn này.

Nếu thầy/cô cho tôi **mã môn** hoặc **tên chính xác** theo dữ liệu, tôi sẽ truy xuất lại và xác định **CLO đạt thấp nhất** ngay.  

> 💡 **Nhận xét:** Hiện không có bản ghi CLO achievement cho “Tiếng Anh 1” (dữ liệu truy vấn trả về rỗng), nên chưa thể kết luận CLO thấp nhất.
```

### TC6: Hàm COUNT
- **Input:** "Khóa K21 ngành Công nghệ thông tin có bao nhiêu sinh viên?"
- **Kỳ vọng:** Đếm số lượng sinh viên chính xác.
- **Evidence:** 
```text
Thầy/cô hỏi **Khóa K21 – Ngành Công nghệ thông tin** có **100 sinh viên**.

> 💡 **Nhận xét:** Con số được tính theo **COUNT(DISTINCT s.id)** trên bảng `students` với điều kiện `cohorts.code = 'K21'` và `programs.name ILIKE '%Công nghệ thông tin%'`.
```

### TC7: Top N + ORDER BY
- **Input:** "Liệt kê 3 sinh viên có GPA tích lũy cao nhất ngành Trí tuệ nhân tạo."
- **Kỳ vọng:** Trả về 3 sinh viên cùng thông tin GPA.
- **Evidence:** 
```text
Thầy/cô yêu cầu 3 sinh viên có GPA tích lũy cao nhất ngành **Trí tuệ nhân tạo**. Hiện dữ liệu trong hệ thống chỉ tìm thấy **1 sinh viên** thuộc ngành này, nên tôi liệt kê toàn bộ 1 sinh viên có GPA cao nhất.

| STT | Mã SV | Họ tên | Lớp | GPA tích lũy |
|---:|---|---|---|---:|
| 1 | 25810460057 | AN VIẾT TÙNG | D20TTNTTNL | 2.68 |

> 💡 **Nhận xét:** Do `students` trong ngành *Trí tuệ nhân tạo* chỉ có 1 bản ghi, hệ thống không đủ dữ liệu để lấy “Top 3”. Nếu thầy/cô muốn, tôi có thể kiểm tra thêm theo **tên chương trình/tiêu đề ngành** gần đúng khác (ví dụ có thể được lưu là “AI”/“Trí tuệ nhân tạo ứng dụng”…).
```

### TC8: Tính tỷ lệ boolean/enum
- **Input:** "Tỷ lệ qua môn (pass) của môn Hệ quản trị cơ sở dữ liệu là bao nhiêu?"
- **Kỳ vọng:** Tính toán % dựa trên field status.
- **Evidence:** 
```text
Thầy/cô hỏi tỷ lệ qua môn (pass) của môn **Hệ quản trị cơ sở dữ liệu**. Kết quả trên dữ liệu enrollment đã hoàn thành cho thấy:

| Mã môn | Tên môn | Tín chỉ | Sĩ số (completed) | Số qua môn | Tỷ lệ pass |
|---|---|---:|---:|---:|---:|
| CRS0101 | Hệ quản trị cơ sở dữ liệu | 3 | 109 | 58 | **53.21%** |

> 💡 **Nhận xét:** Tỷ lệ pass của môn này là **53.21%** (58/109) trên các lần đăng ký có trạng thái **completed**.
```

### TC9: Suy luận Yes/No
- **Input:** "Điểm trung bình môn Toán cao cấp 1 của khóa K22 có thấp hơn K21 không?"
- **Kỳ vọng:** So sánh 2 điểm và trả lời Yes/No kèm số liệu.
- **Evidence:** 
```text
Dạ thầy/cô, có.

| Khóa | Điểm trung bình (grade_4) của *Toán cao cấp 1* |
|---|---:|
| K21 | 2.8558 |
| K22 | 2.0314 |

=> So với K21, **khóa K22 thấp hơn** (giảm khoảng **0.8244** điểm grade_4).

> 💡 **Nhận xét:** Kết quả cho thấy chất lượng học phần *Toán cao cấp 1* của K22 thấp hơn K21 rõ rệt.
```

### TC10: Đếm theo Enrollment
- **Input:** "Môn nào có số sinh viên đăng ký nhiều nhất ngành Công nghệ kỹ thuật cơ điện tử?"
- **Kỳ vọng:** Query join với bảng enrollment để lấy max count.
- **Evidence:** 
```text
Thầy/cô hỏi: *“Môn nào có số sinh viên đăng ký nhiều nhất ngành Công nghệ kỹ thuật cơ điện tử?”*.

Kết quả:  

| Mã môn | Tên môn | Tổng số sinh viên (theo thống kê trong các học kỳ) |
|---|---|---:|
| CRS0056 | Hệ thống sản xuất tự động | 3 |

> 💡 **Nhận xét:** Môn có tổng số sinh viên đăng ký cao nhất trong ngành *Công nghệ kỹ thuật cơ điện tử* là **Hệ thống sản xuất tự động (CRS0056)** với **3 sinh viên**. Nếu thầy/cô muốn “theo từng học kỳ” hoặc “lấy theo năm/cohort”, tôi có thể truy xuất chi tiết thêm.
```
