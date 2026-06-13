# 👥 User Personas & User Stories — AI Phân Tích Học Tập

## 1. User Personas

### Persona 1: Thầy Minh — Giảng viên Bộ môn Công nghệ Phần mềm

| Attribute | Detail |
|:----------|:-------|
| **Tuổi** | 38 |
| **Kinh nghiệm** | 10 năm giảng dạy |
| **Đặc điểm** | Dạy 3 môn/kỳ, mỗi môn ~60 SV. Quen dùng Excel |
| **Pain points** | Mất 8h/tháng tổng hợp điểm; tính CLO thủ công bằng Excel mỗi kỳ kiểm định; không biết SV yếu chương nào cho đến khi thi cuối kỳ; muốn so sánh K17 vs K18 nhưng không có công cụ |
| **Goal** | Biết ngay SV đang yếu ở đâu, CLO nào chưa đạt, không phải "cày" Excel nữa |
| **Quote** | *"Tôi biết sinh viên khóa này kém hơn khóa trước, nhưng không chứng minh được bằng số liệu."* |

### Persona 2: Chị Lan — Trưởng phòng Đảm bảo Chất lượng

| Attribute | Detail |
|:----------|:-------|
| **Tuổi** | 45 |
| **Kinh nghiệm** | 15 năm quản lý đào tạo |
| **Đặc điểm** | Quản lý 12 ngành đào tạo, chuẩn bị kiểm định AUN-QA cho 3 ngành |
| **Pain points** | Thu thập minh chứng CLO/PLO từ 50+ giảng viên rất chậm (vài tuần); dữ liệu gửi lên không đồng nhất format; không có dashboard tổng quan; thay đổi CTĐT dựa trên cảm tính |
| **Goal** | Dashboard realtime, thu thập dữ liệu 1 nơi, tự động map CLO→PLO, sẵn sàng kiểm định mọi lúc |
| **Quote** | *"Mỗi đợt kiểm định, cả phòng phải gom bảng tính từ từng thầy cô, mất 3 tuần mới xong."* |

---

## 2. User Stories & Acceptance Criteria

### Epic 1: Tương tác Hỏi đáp với dữ liệu (AI Chat)

**User Story 1.1:**
> **Là một** Giảng viên,  
> **Tôi muốn** hỏi AI: "Sinh viên K18 môn Cấu trúc dữ liệu yếu ở chương nào nhất?"  
> **Để** tôi có thể điều chỉnh giáo trình tập trung vào phần đó ở học kỳ tới.

**Acceptance Criteria:**
- Hệ thống phân tích dữ liệu điểm thành phần (chuyên cần, giữa kỳ, cuối kỳ) và link với topic/chương.
- Trả về câu trả lời chỉ ra rõ chương/phần kiến thức có điểm thấp nhất.
- Kèm theo biểu đồ minh hoạ (vd: bar chart điểm theo chương).
- Thời gian phản hồi dưới 10s.
- Có trích dẫn rõ ràng số liệu được dùng.

---

**User Story 1.2:**
> **Là một** Ban quản lý (Trưởng khoa),  
> **Tôi muốn** hỏi AI: "CTĐT K18 cải thiện những gì so với K17 về mức độ đạt PLO?"  
> **Để** tôi có minh chứng báo cáo lên hội đồng khoa học.

**Acceptance Criteria:**
- Hệ thống so sánh mức độ hoàn thành các PLO của K17 và K18.
- Nêu rõ các thay đổi/cải thiện lớn (vd: PLO 1 tăng 15%, môn X giảm tỷ lệ trượt 10%).
- Sinh ra định dạng bảng biểu để dễ dàng copy vào báo cáo.
- Câu trả lời mạch lạc, ngôn ngữ báo cáo.

---

### Epic 2: Dashboard Tổng quan

**User Story 2.1:**
> **Là một** Ban quản lý,  
> **Tôi muốn** xem Dashboard hiển thị tỷ lệ sinh viên trượt, GPA trung bình và top môn học có kết quả thấp.  
> **Để** nắm bắt nhanh tình hình học tập toàn khoa trong học kỳ hiện tại.

**Acceptance Criteria:**
- Hiển thị các KPI cards: Tổng SV, GPA trung bình, Tỷ lệ trượt, Tổng môn.
- Biểu đồ GPA trend chart (line chart qua các học kỳ).
- Bảng Top Failed Courses.
- Có khả năng filter theo khóa (K17, K18...), ngành học.

---

### Epic 3: Tính toán Chuẩn đầu ra (CLO/PLO)

**User Story 3.1:**
> **Là một** Giảng viên,  
> **Tôi muốn** hệ thống tự động tính toán mức đạt CLO dựa trên ma trận đề thi và điểm số tôi nhập vào.  
> **Để** tôi không phải làm bằng Excel thủ công.

**Acceptance Criteria:**
- Hỗ trợ tải lên file điểm/ma trận hoặc nhập điểm.
- Tự động map tỷ trọng câu hỏi vào CLO.
- Tính ra tỷ lệ phần trăm sinh viên đạt từng CLO.
- Cho phép xuất file PDF/Word làm minh chứng kiểm định.

---

### Epic 4: Predictive Analytics và Cảnh báo sớm bằng ML

**User Story 4.1:**
> **Là một** Giảng viên, tôi muốn xem xác suất pass/trượt từng môn và tổng tín chỉ pass/trượt kỳ vọng của sinh viên trước khi kết thúc học kỳ,
> **Để** tôi biết sinh viên cần hỗ trợ ở môn nào và mức độ ảnh hưởng đến tiến độ học tập.

**Acceptance Criteria:**
- Hiển thị xác suất pass/trượt của từng môn, prediction cutoff và thời điểm dự đoán.
- Hiển thị expected passed credits, expected failed credits và high-risk failed credits theo học kỳ.
- Mỗi prediction có các yếu tố giải thích chính, ví dụ GPA lịch sử thấp hoặc điểm giữa kỳ giảm.
- Không sử dụng điểm cuối kỳ hoặc trạng thái đậu/trượt làm feature tại thời điểm dự đoán.
- Cho phép lọc theo môn, lớp học phần và mức rủi ro.
- Cảnh báo ghi rõ đây là thông tin hỗ trợ quyết định, không phải kết luận tự động.

---

### Epic 5: Data Warehouse cho phân tích lịch sử

**User Story 5.1:**
> **Là một** Ban quản lý, tôi muốn xem và so sánh KPI theo học kỳ, khóa, ngành và môn học từ một nguồn dữ liệu phân tích thống nhất,
> **Để** báo cáo không phụ thuộc vào các truy vấn thủ công trên dữ liệu vận hành.

**Acceptance Criteria:**
- Dashboard đọc KPI lịch sử từ DWH theo star schema.
- Có thể drill-down từ ngành đến môn và lớp học phần.
- Dữ liệu DWH được refresh theo lịch, theo thay đổi dữ liệu hoặc bằng thao tác admin.
- Có kiểm tra đối soát để KPI quan trọng khớp với dữ liệu OLTP.
- Hiển thị thời điểm refresh gần nhất.

---

Tham khảo thiết kế chi tiết tại [ML_DWH_Architecture.md](../10-References/ML_DWH_Architecture.md).
