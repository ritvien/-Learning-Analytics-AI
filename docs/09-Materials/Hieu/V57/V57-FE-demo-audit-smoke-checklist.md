# Báo cáo Audit Giao diện Demo & Checklist Smoke Test (Task V57)

Tài liệu này ghi nhận kết quả rà soát (audit) các route frontend phục vụ Demo Day và thiết lập checklist chạy thử (smoke test) bằng Playwright để đảm bảo độ tin cậy của hệ thống.

## 1. Kết quả Rà soát các Route Demo (Audit)

Sau khi rà soát toàn bộ các trang frontend trong thư mục `frontend/src/app/(dashboard)` và `components/`, chúng tôi phát hiện một số điểm nghẽn và vấn đề cần tối ưu hóa:

| Route | Tên trang | Trạng thái hiện tại | Vấn đề phát hiện | Giải pháp đề xuất |
|---|---|---|---|---|
| `/login` | Đăng nhập | Hoạt động tốt | Không có chuyển hướng phân vai (actor-first), mặc định đẩy về `/manager`. | Cập nhật logic chuyển hướng theo vai trò sau khi đăng nhập thành công. |
| `/manager` | Cây đào tạo | Tải chậm | Gọi `DashboardPreloader` để tải trước hàng ngàn bản ghi thô (sections, courses, students) gây nghẽn luồng. | Loại bỏ các preload thô nặng trong `DashboardPreloader`. Đổi tên thành "Cây đào tạo". |
| `/manager/analytics` | Tổng quan | Hoạt động tốt | Một số nhãn cột bảng và tiêu đề biểu đồ vẫn hiển thị tiếng Anh (ví dụ: `Program Overview Table`). | Sẽ Việt hóa triệt để trong task VUX-2. |
| `/manager/analytics/departments` | Phân tích Khoa | Đang tải chậm | Route này tồn tại trên sidebar nhưng dữ liệu thưa thớt, dễ gây loãng luồng demo. | Ẩn khỏi sidebar mặc định (vẫn giữ route để click từ Tổng quan xuống). |
| `/manager/analytics/programs` | Chi tiết Ngành | Hoạt động tốt | Một số nhãn biểu đồ hiển thị tiếng Anh. | Sẽ Việt hóa trong task VUX-2. |
| `/manager/analytics/sections` | Lớp học phần | Tải rất nặng | Gọi `getEnrollments` với limit `50000` và `getSections` với limit `5000`. | Áp dụng pagination hoặc summary API từ backend. |
| `/manager/analytics/students` | Hồ sơ Sinh viên | Tải nặng | Sidebar mặc định hiển thị trang này với hộp chọn 1000 sinh viên. | Ẩn khỏi sidebar, chuyển thành trang xem chi tiết khi click từ danh sách lớp hoặc tìm kiếm. |
| `/manager/reports` | Báo cáo | Hoạt động tốt | Giao diện dài, cần phân chia phân vùng rõ hơn. | Sắp xếp lại bố cục (phân vùng cần xử lý, lịch tự động). |
| `/chat` | Chat AI | Hoạt động tốt | Hộp thoại gợi ý prompt còn chung chung, chưa nhận diện ngữ cảnh trang. | Cập nhật context-aware prompt sau Demo Day. |

---

## 2. Checklist Chạy thử tự động (Playwright Smoke Checklist)

Dưới đây là kịch bản chạy thử tự động (Smoke Test) được tích hợp trong file test [app.spec.ts](file:///c:/Users/ADMIN/C2-App-056/frontend/e2e/app.spec.ts):

### Kịch bản 1: Luồng người dùng đầy đủ (Manager/Admin)
- [x] Truy cập `/login` thành công và kiểm tra tiêu đề "Đăng nhập hệ thống" hiển thị.
- [x] Đăng nhập bằng tài khoản `superadmin@epu.edu.vn` / mật khẩu `123456`.
- [x] Hệ thống tự động chuyển hướng về trang `/manager` (hoặc `/manager/analytics` sau khi cập nhật).
- [x] Đóng hộp thoại hướng dẫn (onboarding tour) bằng phím `Escape`.
- [x] Đợi tải dữ liệu học thuật kết thúc (ẩn màn hình loading).
- [x] Kiểm tra phần tử Cây đào tạo (`#academic-tree-view`) hiển thị đầy đủ các nút khoa và chuyên ngành.
- [x] Bấm thử vào nút khoa `CNTT` trên cây đào tạo và kiểm tra xem panel chi tiết bên dưới có hiển thị "Insight chính".
- [x] Di chuyển tới trang `/chat` và kiểm tra tiêu đề chat "EPU AI Analytics".
- [x] Bấm vào một prompt gợi ý (ví dụ: "Môn nào có tỷ lệ trượt...") hoặc nhập câu hỏi và gửi đi.
- [x] Kiểm tra phần tử "Xem tiến trình" (Thinking Status) có thể mở rộng và thu gọn bình thường.
- [x] Di chuyển tới trang báo cáo `/manager/reports` và kiểm tra trang tải thành công.

### Kịch bản 2: Kiểm tra khả năng tương thích trên thiết bị di động (Responsive Viewport)
- [x] Thay đổi kích thước màn hình về kích thước di động chuẩn (375x667).
- [x] Truy cập trang `/login` và kiểm tra các ô nhập email, mật khẩu hiển thị đầy đủ, không bị tràn màn hình.
