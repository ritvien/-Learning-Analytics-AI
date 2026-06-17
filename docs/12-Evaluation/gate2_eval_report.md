# 📊 Báo cáo Đánh giá Gate G2 (10 Test Cases)
**Ngày thực hiện:** 15/06/2026
**Mục tiêu:** Phân tích kết quả chạy thực tế của Agent trên Streamlit, định vị lỗi (Problems) và đưa ra giải pháp cải thiện (Proposals).

---

## 1. Phân tích chi tiết từng Test Case

### TC1: Top 5 môn có tỷ lệ trượt cao nhất ngành CNTT?
* **Kết quả:** Trả về 5 môn với tỷ lệ trượt 100% và sĩ số chỉ có 1 sinh viên.
* **Problem:** Agent truy vấn `vw_course_stats` và sắp xếp theo `fail_rate_avg` giảm dần. Tuy nhiên, view này chia dữ liệu theo từng học kỳ (`semester_id`). Do dữ liệu mock phân bổ ngẫu nhiên, có những lớp/kỳ chỉ có đúng 1 sinh viên và rớt (100%), tạo ra nhiễu (outliers) đẩy các môn này lên top đầu.
* **Đề xuất:** Cập nhật **System Prompt** yêu cầu Agent: *"Khi tính tỷ lệ/Top, phải gộp nhóm bằng `SUM(fail_count)/SUM(total_students)` nếu người dùng không hỏi từng kỳ, HOẶC lọc bỏ các môn có `total_students < 5` để loại bỏ nhiễu."*

### TC2: GPA trung bình khóa K21 ngành CNTT?
* **Kết quả:** 7.22. Nhưng view `vw_program_stats` lặp theo học kỳ và báo cáo nhận xét không tự tin.
* **Problem:** Các view thống kê (`vw_program_stats`, `vw_course_stats`) **KHÔNG CHỨA** dữ liệu về khóa học (`cohort_id`). Agent đã tính nhầm hoặc bỏ qua điều kiện khóa K21 do không tìm thấy cột tương ứng trong view.
* **Đề xuất:** Bổ sung rule vào **System Prompt**: *"Các View thống kê hiện tại KHÔNG có dữ liệu về khóa (Cohort). Nếu câu hỏi có liên quan đến Khóa (vd K21, K22), bắt buộc phải truy vấn từ bảng gốc (`students`, `enrollments`, `sections`, v.v.) thay vì dùng View."* (Hoặc update schema để thêm `cohort_id` vào View).

### TC3: So sánh tỷ lệ trượt môn CSDL K21 vs K22?
* **Kết quả:** Trả về 0.3583 cho CẢ HAI khóa K21 và K22.
* **Problem:** Tương tự TC2. Agent dùng `vw_course_stats` (không có cột cohort) nên đã bỏ qua điều kiện lọc khóa, dẫn đến việc lấy tỷ lệ trượt trung bình chung của toàn bộ môn CSDL gán cho cả K21 và K22.
* **Đề xuất:** Xử lý giống TC2 (Ép dùng bảng gốc khi có điều kiện về khóa học).

### TC4: Chào bạn, chức năng chính của bạn là gì?
* **Kết quả:** Router phân luồng sang Fast Response, trả lời tự nhiên.
* **Problem:** Không có. Logic hoạt động hoàn hảo.
* **Đề xuất:** Pass.

### TC5: CLO nào đạt thấp nhất môn Tiếng Anh 1?
* **Kết quả:** Không tìm thấy dữ liệu.
* **Problem:** Seed data hiện tại chỉ sinh điểm thành phần (grades) nhưng **chưa sinh dữ liệu** cho bảng `student_clo_achievements`.
* **Đề xuất:** Bổ sung mock data cho bảng `student_clo_achievements` vào file seed, hoặc cấu hình Metric Engine chạy ngầm để map điểm thành phần sang tỷ lệ đạt CLO trước khi test.

### TC6: K21 CNTT có bao nhiêu sinh viên?
* **Kết quả:** 100 sinh viên.
* **Problem:** Không có. (Agent query từ bảng `students` thành công).
* **Đề xuất:** Pass.

### TC7: 3 sinh viên GPA cao nhất ngành TTNT?
* **Kết quả:** Trả về đúng 1 sinh viên thay vì 3.
* **Problem:** Dữ liệu mock phân bổ ngẫu nhiên khiến ngành TTNT chỉ có đúng 1 sinh viên trong Database. Agent đã query đúng, vấn đề nằm ở độ phủ của data.
* **Đề xuất:** Pass (Agent làm đúng). Có thể tăng số lượng record trong script crawl/seed nếu muốn test UI hiển thị danh sách dài.

### TC8: Tỷ lệ qua môn Hệ quản trị CSDL?
* **Kết quả:** Liệt kê tỷ lệ theo từng học kỳ.
* **Problem:** Agent không tự gộp dữ liệu thành 1 con số tỷ lệ pass chung (Overall) mà bê nguyên danh sách GROUP BY `semester_id` ra.
* **Đề xuất:** Cập nhật **System Prompt**: *"Nếu người dùng không yêu cầu phân tách theo học kỳ, Agent cần tự động dùng SUM để tính một con số tỷ lệ tổng hợp duy nhất."*

### TC9: Điểm trung bình Toán K22 vs K21?
* **Kết quả:** API 500 Internal Server Error.
* **Problem:** Đây không phải lỗi SQL, mà là lỗi kết nối với nhà cung cấp LLM (OpenAI/Gemini bị timeout, rate limit, hoặc lỗi internal server của chính LLM API).
* **Đề xuất:** Cập nhật Retry mechanism ở tầng API gọi LLM. Bắt các lỗi `APIError`/`500` và trả về fallback thân thiện hơn lên UI Streamlit (ví dụ: *"Hệ thống AI đang quá tải, vui lòng thử lại sau"*).

### TC10: Môn đăng ký nhiều nhất Cơ điện tử?
* **Kết quả:** Hệ thống sản xuất tự động (3 SV).
* **Problem:** Không có (Tuy số lượng SV nhỏ do data mock, nhưng SQL logic đếm số lượng là đúng).
* **Đề xuất:** Pass.

---

## 2. Kế hoạch Action (Next Steps)

Từ những phân tích trên, để Agent thông minh và chính xác hơn, chúng ta cần làm 3 việc chính:

1. **Cập nhật File Prompts (`backend/app/agent/prompts.py`)**:
   - Thêm quy định: *"Các View thống kê hiện tại KHÔNG có dữ liệu Khóa (Cohort). Phải dùng JOIN các bảng gốc (`students`, `enrollments`, ...) nếu có điều kiện Khóa."*
   - Thêm quy định: *"Cần tổng hợp gộp (SUM/AVG) các học kỳ nếu user không chỉ định học kỳ."*
   - Thêm quy định: *"Loại bỏ các lớp có sĩ số < 5 khi hỏi về tỷ lệ (để chống nhiễu)."*

2. **Fix Dữ liệu CLO**:
   - Viết/chạy script để sinh thêm dữ liệu mock cho bảng `student_clo_achievements`.

3. **Error Handling**:
   - Bắt thêm exception 500 từ LLM API trong LangGraph để tránh sập app.
