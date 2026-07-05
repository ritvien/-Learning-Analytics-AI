# User Feedback Summary — D62

> **Owner:** Hiếu · **Task:** D62 — User feedback 3–5 người  
> **Status:** complete · **Source:** Google Sheets response export, 05/07/2026  
> **Production URL tested:** https://c2-app-056.vercel.app

## Scope

D62 thu thập phản hồi nhanh sau khi người dùng trải nghiệm bản production EduInsight. Mục tiêu là kiểm tra mức dễ hiểu, dễ thao tác, tốc độ, trạng thái loading V65 và mức sẵn sàng Demo Day.

## Respondents

| # | Người phản hồi | Vai trò | Phạm vi đã thử |
|:-:|:---------------|:--------|:---------------|
| 1 | Nguyễn Minh Hiếu | Người xem demo | Toàn bộ luồng chính: login, overview, analytics, tree, reports, chatbot, CRUD, observability |
| 2 | Phạm Văn Hiếu | Người xem demo | Toàn bộ luồng chính: login, overview, analytics, tree, reports, chatbot, CRUD, observability |
| 3 | Phạm Tiến Hưng | Sinh viên | Cây đào tạo, báo cáo học vụ, CRUD |
| 4 | Trần Quang Huy | Người xem demo | Đăng nhập, dashboard tổng quan |
| 5 | Nguyễn Quốc Tiến | Sinh viên | Toàn bộ luồng chính: login, overview, analytics, tree, reports, chatbot, CRUD, observability |
| 6 | Đặng Hữu Nghĩa | Sinh viên | Login, overview, analytics, tree, reports, chatbot |

**Tổng phản hồi hợp lệ:** 6. D62 yêu cầu 3–5 người; nhóm thu được 6 phản hồi nên đủ evidence, dùng toàn bộ để tổng hợp.

## Quantitative summary

| Metric | Average | Notes |
|:-------|:-------:|:------|
| Mức độ dễ hiểu giao diện tổng thể | 4.17 / 5 | 4/6 phản hồi chấm 4–5 |
| Mức độ dễ thao tác | 4.50 / 5 | 5/6 phản hồi chấm 4–5 |
| Tốc độ tải trang và phản hồi | 4.00 / 5 | Có 1 phản hồi chấm 2 do một số màn loading lâu |
| Mức độ sẵn sàng demo trước hội đồng | 4.67 / 5 | 5/6 phản hồi chấm 5 |

## Loading feedback

| Feedback | Count |
|:---------|------:|
| Có, rõ ràng | 5 |
| Có, nhưng vẫn hơi khó nhận biết | 1 |
| Không rõ lắm | 0 |
| Không gặp trạng thái loading | 0 |

Kết luận: loading skeleton/spinner V65 được đa số người dùng nhận biết rõ. Một phản hồi cho thấy vẫn có thể cải thiện độ nổi bật ở một số màn tải lâu.

## Most useful areas

| Theme | Evidence |
|:------|:---------|
| Chatbot AI | Được nhắc trực tiếp bởi Nguyễn Minh Hiếu và Đặng Hữu Nghĩa; Nguyễn Quốc Tiến đánh giá toàn bộ phần demo hữu ích. |
| Dashboard tổng quan toàn trường | Phạm Văn Hiếu chọn là phần hữu ích nhất; Trần Quang Huy cũng thử và ghi nhận màn việc cần xử lý. |
| Cảnh báo sinh viên rủi ro | Phạm Tiến Hưng và Đặng Hữu Nghĩa nhắc tới cảnh báo sinh viên rủi ro. |
| Báo cáo/CRUD/cây đào tạo | Được nhiều người thử trong phạm vi full demo hoặc subset. |

## Issues and improvement requests

| Area | Feedback | Severity | Follow-up |
|:-----|:---------|:--------:|:----------|
| Loading/performance | Một số màn loading lâu như Môn học, Lớp cố vấn. | Medium | Giữ V65 skeleton; ưu tiên tối ưu API/cache sau Demo Day nếu còn thời gian. |
| Navigation context | Sidebar chưa có hover rõ; header/tab luôn hiển thị tên hệ thống nên người dùng chưa biết đang ở màn nào. | Medium | Backlog UX: active nav/route title rõ hơn. |
| Chatbot data/schema handling | Một câu hỏi chatbot trả về lỗi do schema DWH/view không khớp cột (`course_name`, `academic_term`). | Medium | Handoff cho H66/H47: kiểm tra tool SQL/golden/schema mapping. |
| Cảnh báo sinh viên rủi ro | Một phản hồi thấy phần cảnh báo sinh viên rủi ro còn khó hiểu. | Low | Bổ sung copy giải thích badge/risk band sau Demo Day. |

## Readiness conclusion

Manual feedback cho thấy hệ thống **đủ sẵn sàng để demo**:

- Điểm sẵn sàng demo trung bình: **4.67/5**.
- Không có phản hồi nào báo lỗi chặn toàn bộ luồng.
- 3/6 phản hồi không gặp lỗi giao diện; 2/6 gặp lỗi nhỏ nhưng vẫn dùng được; 1/6 không chắc.
- Các vấn đề còn lại chủ yếu là polish UX, performance ở một số màn, và schema/tool handling của chatbot.

## D62 outcome

- **D62 status:** complete.
- **Evidence:** 6 phản hồi production, summary định lượng + định tính đã lưu tại file này.
- **Recommended feed to Demo Day README:** nhấn mạnh feedback tích cực về dashboard tổng quan, chatbot, cảnh báo sinh viên rủi ro và loading V65 rõ ràng.
