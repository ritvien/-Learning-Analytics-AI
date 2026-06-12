# 📋 Project Brief — AI Phân Tích Học Tập

> **Team 056** · AI20K Build Cohort 2 · VinUni × Vingroup  
> **Trưởng nhóm:** Nguyễn Việt Hoàng · **Thành viên:** Phạm Tiến Hưng, Phạm Minh Hiếu  
> **Thời gian:** 28/05/2026 → 09/07/2026 (Demo Day)  
> **Phiên bản:** v1.0 · Ngày tạo: 06/06/2026

---

## 1. Bối cảnh & Động lực

Các trường đại học Việt Nam đang chịu áp lực ngày càng lớn trong việc **đảm bảo và minh chứng chất lượng đào tạo** — đặc biệt khi phải đáp ứng các chuẩn kiểm định quốc tế (ABET, AUN-QA) và yêu cầu từ Bộ GD&ĐT. Tuy nhiên, hầu hết các quy trình phân tích kết quả học tập, đánh giá chuẩn đầu ra, và cải tiến chương trình đào tạo hiện vẫn được thực hiện **thủ công**, phân tán, và phụ thuộc vào kinh nghiệm cá nhân.

### Thực trạng hiện tại

| Vấn đề | Biểu hiện cụ thể |
|:--------|:------------------|
| **Dữ liệu phân tán** | Điểm nằm ở Phòng Đào tạo, file Excel riêng của giảng viên, LMS, Google Classroom — không đồng bộ |
| **Phân tích thủ công** | Giảng viên tự tổng hợp bảng tính Excel, mất 5–20+ giờ/tháng cho báo cáo |
| **Đánh giá CLO/PLO đối phó** | Chỉ thực hiện khi có đoàn kiểm định, kết quả thiếu chính xác |
| **Không có phân tích cross-cohort** | Không so sánh được hiệu quả K17 vs K18 vs K19 một cách hệ thống |
| **Phát hiện bất thường chậm** | Tỷ lệ trượt tăng đột biến chỉ được nhận ra sau khi kết thúc học kỳ |
| **Ra quyết định bằng cảm tính** | Thay đổi CTĐT thiếu minh chứng dữ liệu, không đo lường tác động |

## 2. Vấn đề cốt lõi (Problem Statement)

> **Giảng viên và Ban quản lý đại học** hiện thiếu một hệ thống thống nhất, tự động để phân tích kết quả học tập theo chiều sâu (topic-level), đánh giá mức đạt chuẩn đầu ra (CLO/PLO), và ra quyết định cải tiến chương trình đào tạo dựa trên dữ liệu — dẫn đến **lãng phí thời gian, báo cáo thiếu chính xác, và chất lượng đào tạo không được cải thiện liên tục**.

## 3. Giải pháp đề xuất

Xây dựng **hệ thống AI Phân Tích Học Tập** (AI Learning Analytics Platform) — một nền tảng web tích hợp **AI Agent** có khả năng:

1. **Tự động phân tích** kết quả học tập chi tiết đến cấp độ chủ đề/câu hỏi
2. **Tự động đánh giá** mức đạt chuẩn đầu ra (CLO → PLO) theo đúng chuẩn ABET/AUN
3. **So sánh cross-cohort** hiệu quả CTĐT qua các khóa (K17 vs K18)
4. **Cảnh báo sớm** sinh viên yếu và môn học có vấn đề
5. **Tự động sinh báo cáo** cải tiến, minh chứng kiểm định
6. **Hỗ trợ hỏi đáp thông minh** qua AI Chat (natural language → data insights)

## 4. Đối tượng sử dụng (Target Users)

| Nhóm | Mô tả | Willingness to Pay |
|:------|:-------|:-------------------|
| 🎓 **Giảng viên / Trưởng Bộ môn** | Trực tiếp dạy, cần phân tích điểm môn học, đánh giá CLO, đề xuất cải tiến | 50K–300K VNĐ/tháng (cá nhân) |
| 🏛 **Ban quản lý (Khoa / Phòng ĐT / Phòng ĐBCL)** | Tổng hợp dữ liệu toàn khoa, chuẩn bị kiểm định, ra quyết định CTĐT | 10–100 triệu VNĐ/ngành/năm |

> [!IMPORTANT]
> Scope đã được thu hẹp: **bỏ nhánh Sinh viên**, tập trung hoàn toàn vào Giảng viên và Ban quản lý — theo nguyên tắc *"Scope down sớm tốt hơn scope creep"*.

## 5. Phạm vi MVP (Minimum Viable Product)

### Trong phạm vi (In Scope)

- Dashboard phân tích kết quả học tập (điểm, phổ điểm, tỷ lệ trượt, trend)
- AI Chat Agent hỏi đáp dữ liệu bằng ngôn ngữ tự nhiên
- Đánh giá CLO/PLO tự động từ dữ liệu điểm
- So sánh cross-cohort (K17 vs K18)
- Hệ thống cảnh báo sớm (early warning)
- CRUD quản lý: Sinh viên, Giảng viên, Môn học, Chương trình, Bộ môn, Điểm

### Ngoài phạm vi (Out of Scope — MVP)

- Tích hợp trực tiếp với hệ thống Phòng Đào tạo (LMS)
- Mobile app
- Multi-tenant (nhiều trường cùng lúc)
- Auto-grading (tự chấm bài)
- Phân tích dữ liệu phi cấu trúc (feedback text mining)

## 6. Thước đo thành công (Success Metrics)

| Metric | Target |
|:-------|:-------|
| Thời gian sinh báo cáo CLO | Từ 5–10 giờ → **< 5 phút** |
| Thời gian phân tích môn học | Từ 2–5 giờ → **< 1 phút** (AI Chat) |
| Độ chính xác CLO assessment | ≥ 90% so với tính thủ công |
| AI Agent response time (p95) | < 10 giây |
| User satisfaction (khảo sát) | ≥ 4/5 |

## 7. Bổ sung định vị Analytics

Để đúng với định vị **AI Learning Analytics Platform**, giải pháp cần có hai năng lực nền tảng bên cạnh dashboard và AI Chat:

1. **Data Warehouse:** tách dữ liệu phân tích lịch sử khỏi các bảng CRUD/OLTP, hỗ trợ phân tích đa chiều theo học kỳ, khóa, ngành, môn và CLO/PLO.
2. **Machine Learning dự đoán:** dự đoán xác suất pass/trượt từng môn, sau đó tổng hợp tổng tín chỉ pass/trượt kỳ vọng trước khi kết thúc học kỳ.

AI Agent đóng vai trò hỏi đáp và diễn giải kết quả. Các KPI lịch sử phải đến từ DWH; xác suất rủi ro phải đến từ mô hình ML đã được đánh giá và lưu phiên bản.

Phạm vi MVP ưu tiên DWH dạng star schema và một baseline model có thể giải thích, không xây dựng hệ thống MLOps phức tạp. Xem [ML_DWH_Architecture.md](../10-References/ML_DWH_Architecture.md) và [DatabaseModernizationPlan.md](../10-References/DatabaseModernizationPlan.md).
