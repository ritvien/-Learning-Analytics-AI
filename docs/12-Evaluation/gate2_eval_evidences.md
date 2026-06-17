# Gate G2 Evaluation Evidences

**Ngrok Public URL:** https://spectrum-dullness-ambiguous.ngrok-free.dev
**Testing Date:** 15/06/2026

## Tổng hợp kết quả 10 Test Cases

| TC | Input | Result | Status | Screenshot |
|----|-------|--------|--------|------------|
| TC1 | "Top 5 môn có tỷ lệ trượt cao nhất ngành Công nghệ thông tin?" | Đã xử lý đúng điều kiện ngành CNTT | Pass | Bỏ qua |
| TC2 | "GPA trung bình khóa K21 ngành Công nghệ thông tin là bao nhiêu?" | GPA là ~2.27 (không chia theo status) | Pass | Bỏ qua |
| TC3 | "So sánh tỷ lệ trượt môn Cơ sở dữ liệu của K21 và K22?" | Nhận diện đúng môn học (CSDL -> Cơ sở dữ liệu) | Pass | Bỏ qua |
| TC4 | "Chào bạn, chức năng chính của bạn là gì?" | Phân loại Fast Response thành công | Pass | Bỏ qua |
| TC5 | "CLO nào đạt thấp nhất ở môn Tiếng Anh 1?" | Không tìm thấy dữ liệu (Không rò rỉ schema) | Pass | Bỏ qua |
| TC6 | "Khóa K21 ngành Công nghệ thông tin có bao nhiêu sinh viên?" | Đếm được 100 sinh viên (Không rò rỉ schema) | Pass | Bỏ qua |
| TC7 | "Liệt kê 3 sinh viên có GPA tích lũy cao nhất ngành Trí tuệ nhân tạo." | Trả về 1 SV vì ngành chỉ có 1 bản ghi | Pass | Bỏ qua |
| TC8 | "Tỷ lệ qua môn (pass) của môn Hệ quản trị cơ sở dữ liệu là bao nhiêu?" | Tính được tỷ lệ pass 53.21% | Pass | Bỏ qua |
| TC9 | "Điểm trung bình môn Toán cao cấp 1 của khóa K22 có thấp hơn K21 không?" | Suy luận chính xác: Có | Pass | Bỏ qua |
| TC10 | "Môn nào có số sinh viên đăng ký nhiều nhất ngành Công nghệ kỹ thuật cơ điện tử?" | Môn Toán cao cấp 2 (729 SV) | Pass | Bỏ qua |

## Chi tiết Test Cases

### TC1
- **Input:** "Top 5 môn có tỷ lệ trượt cao nhất ngành Công nghệ thông tin?"
- **Evidence:** 
```text
Thầy/cô muốn “tỷ lệ trượt” theo ngành **Công nghệ thông tin**, tôi tổng hợp theo dữ liệu các lớp học phần có **tổng số lần đăng ký từ 5 trở lên**. Kết quả **Top 5 môn có tỷ lệ trượt cao nhất** như sau:

| STT | Mã học phần | Tên học phần | Số SV/HT (n) | Số trượt | Tỷ lệ trượt (%) |
|---:|---|---|---:|---:|---:|
| 1 | CRS0330 | Những Nguyên lý cơ bản của chủ nghĩa Mác – Lênin 1 | 5 | 4 | 80.00 |
| 2 | CRS0259 | Hành chính điện tử | 20 | 10 | 50.00 |
| 3 | CRS0017 | Vẽ kỹ thuật 1 | 69 | 34 | 49.28 |
| 4 | CRS0101 | Hệ quản trị cơ sở dữ liệu | 109 | 51 | 46.79 |
| 5 | CRS0024 | Toán cao cấp 3 | 64 | 29 | 45.31 |

> 💡 **Nhận xét:** “Hệ quản trị cơ sở dữ liệu” và “Toán cao cấp 3” là các môn có **quy mô đăng ký lớn**, nên tỷ lệ trượt cao của chúng ảnh hưởng đáng kể; nếu thầy/cô cần, tôi có thể báo thêm theo **từng học kỳ** hoặc theo **khoa/lớp tín chỉ/giảng viên** để khoanh vùng nguyên nhân.
```

### TC2
- **Input:** "GPA trung bình khóa K21 ngành Công nghệ thông tin là bao nhiêu?"
- **Evidence:** 
```text
Theo dữ liệu hệ thống, **GPA trung bình của khóa K21 ngành Công nghệ thông tin** là **2.275** (xấp xỉ **2.27**).

> 💡 **Nhận xét:** Nếu thầy/cô muốn, tôi có thể bổ sung thêm số lượng sinh viên K21 ngành CNTT đang có dữ liệu GPA để đối chiếu độ tin cậy.
```

### TC3
- **Input:** "So sánh tỷ lệ trượt môn Cơ sở dữ liệu của K21 và K22?"
- **Evidence:** 
```text
Thầy/cô yêu cầu so sánh tỷ lệ trượt học phần **Cơ sở dữ liệu** giữa **K21** và **K22**. Theo dữ liệu hệ thống (chỉ tính ghi nhận hoàn thành), kết quả như sau:

| Khóa | Sĩ số (hoàn thành) | Số trượt | Tỷ lệ trượt |
|---|---:|---:|---:|
| K21 | 207 | 66 | 31.88% |
| K22 | 109 | 34 | 31.19% |

**So sánh nhanh:** K21 trượt **cao hơn khoảng 0.69 điểm %** so với K22.

> 💡 **Nhận xét:** Tỷ lệ trượt của K21 và K22 đối với nhóm “Cơ sở dữ liệu” là khá tương đồng; chênh lệch nhỏ (< 1%). Nếu thầy/cô muốn, tôi có thể tách theo **từng học kỳ** hoặc **từng học phần con** (ví dụ “Hệ quản trị CSDL” và “Cơ sở dữ liệu”).
```

### TC4
- **Input:** "Chào bạn, chức năng chính của bạn là gì?"
- **Evidence:** 
```text
Chào bạn! Tôi là EduInsight AI của EPU, có nhiệm vụ hỗ trợ bạn bằng các câu trả lời/giải thích học vụ theo cách ngắn gọn, rõ ràng—ví dụ hướng dẫn cách đặt câu hỏi, giải thích khái niệm hoặc gợi ý cách tìm thông tin liên quan học tập. Bạn muốn hỏi về mảng nào: chương trình học, môn học, hay quy trình đăng ký?
```

### TC5
- **Input:** "CLO nào đạt thấp nhất ở môn Tiếng Anh 1?"
- **Evidence:** 
```text
Thầy/cô vui lòng kiểm tra lại giúp tôi: trong dữ liệu hiện có **không tìm thấy bản ghi CLO gắn với kết quả học phần “Tiếng Anh 1”** (ít nhất không đủ để xác định CLO đạt thấp nhất theo điểm achievement).

Trong “Tiếng Anh 1” có **688** lượt hoàn thành, nhưng phần **CLO/Phiếu minh chứng ([dữ liệu hệ thống])** chưa cho ra kết quả phù hợp để xếp hạng CLO.

> 💡 **Nhận xét:** Nếu thầy/cô cho tôi thêm tên biến thể môn (ví dụ “English 1” hay mã học phần), hoặc xác nhận “Tiếng Anh 1” đang được hệ thống đặt đúng chính xác tên đó, tôi sẽ truy xuất lại để tìm CLO đạt thấp nhất.
```

### TC6
- **Input:** "Khóa K21 ngành Công nghệ thông tin có bao nhiêu sinh viên?"
- **Evidence:** 
```text
Theo dữ liệu hệ thống, **khóa K21 ngành Công nghệ thông tin** có **100 sinh viên**.

> 💡 **Nhận xét:** Nếu thầy/cô cần thêm cơ cấu theo **trạng thái** (đang học/ thôi học/ bảo lưu…) hoặc theo **lớp** (class_code), tôi có thể thống kê tiếp.
```

### TC7
- **Input:** "Liệt kê 3 sinh viên có GPA tích lũy cao nhất ngành Trí tuệ nhân tạo."
- **Evidence:** 
```text
Thầy/cô yêu cầu danh sách **3 sinh viên có GPA tích lũy cao nhất** thuộc **ngành Trí tuệ nhân tạo**. Theo dữ liệu hiện có, **chỉ tìm thấy 1 sinh viên** phù hợp, nên tôi liệt kê được 1/3 như sau:

| STT | Mã SV | Họ và tên | Lớp | GPA tích lũy |
|---:|---|---|---|---:|
| 1 | 25810460057 | AN VIẾT TÙNG | D20TTNTTNL | 2.68 |

> 💡 **Nhận xét:** Hiện hệ thống chỉ có dữ liệu sinh viên gắn với ngành “Trí tuệ nhân tạo” thỏa điều kiện tìm kiếm, nên chưa đủ để lấy top 3. Nếu thầy/cô muốn, tôi có thể kiểm tra lại theo các biến thể tên ngành (ví dụ “AI”, “Trí tuệ nhân tạo”, hoặc tên chương trình gần tương tự) để mở rộng phạm vi.
```

### TC8
- **Input:** "Tỷ lệ qua môn (pass) của môn Hệ quản trị cơ sở dữ liệu là bao nhiêu?"
- **Evidence:** 
```text
Theo dữ liệu hiện có, **tỷ lệ qua môn (pass)** của học phần **“Hệ quản trị cơ sở dữ liệu”** là:

- **Pass rate:** **53.21%**

> 💡 **Nhận xét:** Nếu thầy/cô muốn, tôi có thể tách thêm **theo từng học kỳ** để xem pass rate biến động ra sao.
```

### TC9
- **Input:** "Điểm trung bình môn Toán cao cấp 1 của khóa K22 có thấp hơn K21 không?"
- **Evidence:** 
```text
Thưa thầy/cô, theo dữ liệu hệ thống, **điểm trung bình môn “Toán cao cấp 1” của khóa K22 thấp hơn K21**.

| Khóa | Điểm trung bình (gộp theo môn, hệ số theo grade_4) |
|---|---:|
| K21 | 2.856 |
| K22 | 2.031 |

Kết luận: **K22 (2.031) < K21 (2.856)**.

> 💡 **Nhận xét:** Chênh lệch trung bình khoảng **0.825 điểm**, cho thấy K22 học môn này đạt mức thấp hơn đáng kể so với K21.
```

### TC10
- **Input:** "Môn nào có số sinh viên đăng ký nhiều nhất ngành Công nghệ kỹ thuật cơ điện tử?"
- **Evidence:** 
```text
Thầy/cô hỏi: **môn nào có số sinh viên đăng ký nhiều nhất** thuộc **ngành Công nghệ kỹ thuật cơ điện tử**.

Kết quả theo dữ liệu hệ thống:
| Mã môn | Tên môn | Số SV đăng ký (tổng cộng) |
|---|---|---:|
| CRS0013 | Toán cao cấp 2 | 729 |

> 💡 **Nhận xét:** “Toán cao cấp 2” đang là học phần có quy mô đăng ký lớn nhất trong chương trình ngành Công nghệ kỹ thuật cơ điện tử theo số liệu hiện có. Nếu thầy/cô muốn, tôi có thể thống kê thêm Top 5 học phần có số đăng ký cao nhất.
```

