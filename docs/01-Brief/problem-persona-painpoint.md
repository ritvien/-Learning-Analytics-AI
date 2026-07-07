# Problem Statement · Persona · Painpoint (từ khảo sát thầy cô)

> **Nguồn:** [Kết quả khảo sát AI Phân tích học tập — Giảng viên & Quản lý](../21-Release-Readiness/Kết%20quả%20khảo%20sát%20AI%20Phân%20tích%20học%20tập%20-%20Giảng%20viên%20&%20Quản%20lý%20-%20Form%20Responses%201.csv) · [Google Sheet](https://docs.google.com/spreadsheets/d/1q4TyfUCYb7XAwzuJeNOLNbufFsqj1Amr72lV3xyctE0/edit?gid=1675836548#gid=1675836548)
> **Task:** P1 (Sprint 4 — Demo Day Phase 2) · **Dùng cho:** Pitch Deck slide #2 (Problem) / #3 (Solution) + README §1.
> **Mẫu hiện có:** 5 phản hồi, **100% nhóm Giảng viên / Trưởng–Phó bộ môn**. Nhóm Quản lý (khoa/trường) chưa có phản hồi — xem [§5 Khoảng trống dữ liệu](#5-khoảng-trống-dữ-liệu-cần-lưu-ý-khi-pitch).

---

## 1. Problem Statement

> Giảng viên và trưởng bộ môn **không có công cụ tự phân tích** kết quả học tập: dữ liệu chỉ là **điểm tổng kết** nằm rải rác ở hệ thống phòng đào tạo và file Excel cá nhân, **phải xin qua giáo vụ**, **không so sánh được giữa học kỳ/khóa**, và **không phát hiện sớm được sinh viên yếu** cho tới khi đã có điểm thi. Việc đo lường CLO/PLO phục vụ kiểm định vẫn làm thủ công bằng Excel (hoặc **không làm được**), tiêu tốn **10–20+ giờ/tháng** cho tổng hợp và báo cáo thủ công.

Bằng chứng định lượng (n=5):

| Chỉ số | Kết quả |
|:--|:--|
| Thấy **"Xác định sớm SV nguy cơ trượt"** là *Rất khó* với công cụ hiện tại | **3/5** |
| Không đo lường được / chưa từng làm **đánh giá CLO** (còn lại map bằng Excel >10h/kỳ) | **3/5** (2/5 tốn >10h) |
| Lãng phí **≥10 giờ/tháng** cho tổng hợp & báo cáo thủ công | **4/5** (1 người >20h) |
| Đánh giá tính năng **hỏi tiếng Việt + biểu đồ tự động** là hữu ích | **5/5** (2 "rất", 3 "khá") |
| Thấy **cây phân cấp Khoa→Ngành→Môn + đèn sức khỏe** trực quan | **4/5** |
| Sẵn sàng chi trả cá nhân | **4/5** chỉ dùng nếu **trường mua cấp free**; 1 người 50–100k/tháng |

---

## 2. Persona chính

### Persona A — Giảng viên bộ môn ("Cô Lan")
- **Bối cảnh:** dạy 2–4 lớp/kỳ; theo dõi điểm qua hệ thống phòng đào tạo + Excel cá nhân.
- **Mục tiêu:** biết **sinh viên nào đang yếu** để can thiệp *trước* kỳ thi; biết lớp/môn mình đạt/trượt thế nào.
- **Painpoint:** "Hệ thống chỉ có điểm tổng kết, không có dữ liệu chi tiết theo bài/chủ đề"; "Khó biết SV nào yếu cho đến khi đã có điểm thi"; "Mất thời gian xin dữ liệu từ giáo vụ".
- **Muốn thấy đầu tiên khi mở hệ thống:** danh sách sinh viên + cảnh báo rủi ro.
- **EduInsight đáp ứng:** dashboard lớp/môn, **ML cảnh báo sớm dropout/at-risk**, luồng liên hệ SV.

### Persona B — Trưởng / Phó bộ môn ("Thầy Hùng")
- **Bối cảnh:** >10 năm kinh nghiệm; tham gia **rà soát/cải tiến CTĐT** và **kiểm định (ABET/AUN/MOET)**.
- **Mục tiêu:** so sánh **hiệu quả CTĐT qua các khóa** (K17 vs K18…), tìm **điểm nghẽn** chương trình, làm **minh chứng CLO/PLO**.
- **Painpoint:** so sánh kết quả qua các khóa / đánh giá môn tiên quyết / đo PLO toàn chương trình đều *Rất khó*; quyết định cải tiến CTĐT chủ yếu dựa **kinh nghiệm cá nhân**, thiếu dữ liệu.
- **EduInsight đáp ứng:** **Academic Tree 5 cấp + health score**, analytics theo khóa/ngành, CTĐT RAG Q&A, Report Center với evidence.

---

## 3. Painpoint xếp theo mức độ (để chọn thứ tự kể trong pitch)

| # | Painpoint (nguyên văn khảo sát) | Mức độ | EduInsight giải quyết |
|:-:|:--|:--|:--|
| 1 | Phát hiện SV yếu **quá muộn** — chỉ biết khi đã có điểm thi | 3/5 *Rất khó* | ML early-warning + at-risk list |
| 2 | **Không so sánh được** qua học kỳ/khóa | phổ biến | Analytics đa cấp theo khóa/kỳ, drill-down |
| 3 | **Đo CLO/PLO thủ công bằng Excel** hoặc bỏ trống | 3/5 không làm được | Materialize CLO/PLO + Report evidence |
| 4 | **Xin dữ liệu qua giáo vụ**, dữ liệu rời rạc | phổ biến | Một nguồn DWH thống nhất |
| 5 | Cải tiến CTĐT dựa **cảm tính/kinh nghiệm** | Persona B | CTĐT RAG + phân tích bottleneck |
| 6 | **Lãng phí 10–20+ giờ/tháng** báo cáo thủ công | 4/5 | Báo cáo tự động, snapshot có version |

**Nguyên nhân gốc (câu 5.2):** dữ liệu thiếu/không chuẩn, công cụ không hỗ trợ, quy trình rườm rà, thiếu kỹ năng phân tích — đúng định vị "biến dữ liệu rời rạc thành thông tin hành động" của EduInsight.

---

## 4. Thông điệp pitch rút ra

- **Hook:** "Thầy cô đang mất **10–20 giờ mỗi tháng** chỉ để tổng hợp điểm thủ công, và vẫn **không biết sinh viên nào sắp trượt** cho tới khi quá muộn."
- **Validation tính năng:** **5/5** muốn hỏi tiếng Việt ra biểu đồ; **4/5** thấy cây phân cấp + đèn sức khỏe trực quan → đúng 2 tính năng lõi (Chat AI + Academic Tree).
- **Go-to-market:** người dùng cuối kỳ vọng **nhà trường/khoa mua cấp tài khoản** (4/5) → bán B2B theo ngành/khoa, không bán lẻ cá nhân.

---

## 5. Khoảng trống dữ liệu (cần lưu ý khi pitch)

- **n=5, chỉ nhóm giảng viên/bộ môn** — chưa có phản hồi cấp **Quản lý khoa/trường** (toàn bộ cột phần Quản lý trong form đang trống). Con số cấp trường (thời gian/kỳ, mức chi trả theo ngành/năm) **chưa có bằng chứng khảo sát** — nếu nêu trong slide phải ghi rõ là *ước tính*, không trích như số liệu khảo sát.
- Mẫu nhỏ → trình bày dạng **định tính + xu hướng**, tránh "%" tuyệt đối gây hiểu nhầm ngoại suy.
