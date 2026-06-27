# UX Simplification Review

> Ngày review: 25/06/2026  
> Vai trò review: chuyên gia UX/UI, mục tiêu đơn giản hóa việc sử dụng cho manager, lecturer, admin và demo viewer.  
> Phạm vi đã đối chiếu code: `frontend/src/app/(dashboard)`, sidebar, preload, analytics dashboard, report center, chat shell, RBAC surface.

## 1. Kết luận nhanh

Sản phẩm đã có nền tảng dữ liệu tốt: academic tree, dashboard DWH aggregate, analytics theo ngành/môn/lớp/sinh viên, report center và chat AI. Vấn đề chính không phải thiếu tính năng, mà là **quá nhiều điểm vào ngang hàng**, **filter nặng**, và **một số trang kéo raw data lớn trên frontend**.

Quyết định UX để làm hệ thống dễ dùng hơn:

| Hạng mục | Quyết định UX | Lý do |
|---|---|---|
| Landing sau login | Nên vào `Tổng quan`, không vào `Cơ cấu đào tạo` | Người dùng cần biết ngay "đang ổn không, cần xử lý gì" |
| Academic tree | Giữ như màn drill-down, đổi tên thành `Cây đào tạo` | Tree có giá trị khám phá cấu trúc, nhưng không phải dashboard điều hành |
| Sidebar analytics | Giảm từ 5 mục ngang hàng xuống 2-3 mục chính | Giảm rối và bắt đầu từ việc cần làm |
| Student analytics | Ẩn khỏi sidebar mặc định, mở từ search/drill-down | Select 1000 SV không phù hợp việc sử dụng hằng ngày |
| Department analytics | Ẩn khỏi sidebar mặc định, giữ route nội bộ | Trùng với tổng quan và chi tiết ngành |
| Course/section analytics | Giữ vì có giá trị hành động cao, nhưng cần aggregate API | Hiện tại còn tải raw enrollment lớn |
| Date range | Đưa vào `Bộ lọc nâng cao` | Người dùng thường chọn học kỳ, không chọn ngày raw |
| Report Center | Giữ và tổ chức actor-first: `Cần xử lý`, `Thư viện`, `Lịch tự động` | Báo cáo nên bắt đầu từ hành động |
| Chat AI | Giữ global chat + full chat, nhưng prompt phải theo context trang | Tránh chat chung chung và lặp entry point |

## 2. Trạng thái code frontend đã kiểm chứng

Những điểm dưới đây được đối chiếu trực tiếp với frontend ngày 25/06/2026.

| Khu vực | Trạng thái hiện tại | Tác động UX |
|---|---|---|
| Sidebar | Vẫn chia `Quản lý chung / Phân tích / Đào tạo / Hệ thống`; `Cơ cấu đào tạo` đứng đầu; `Sinh viên` analytics vẫn hiện trong sidebar | Chưa actor-first, người mới dễ bị dẫn vào nhiều dashboard con |
| Dashboard preloader | Vẫn preload `sections 5000`, `students 1000`, `courses 1000`, `enrollments 50000`, `gradeComponents 10000` | Rủi ro chậm sau login, đặc biệt khi demo qua Ngrok |
| Tổng quan | Dùng aggregate `/analytics/dashboard/overview`, nhưng date filter vẫn nằm ngang hàng và title bảng còn là `Program Overview Table` | Nên polish P0 vì đây là màn hình chính |
| Departments analytics | Route còn tồn tại, có date filter ngang hàng | Nên giữ deep-link, ẩn khỏi sidebar |
| Programs analytics | Dùng aggregate `/analytics/dashboard/programs/{id}`, nhưng label `Course Performance in Program` còn tiếng Anh | Nên giữ, cần search ngành và polish copy |
| Courses analytics | Gọi `getEnrollments limit 50000`, `getSections limit 5000`, health batch | Cần aggregate API trước khi xem là production-ready |
| Sections analytics | Gọi `getEnrollments limit 50000`, `getSections limit 5000`, `getStudents limit 1000` | Trang có giá trị cao nhưng đang nặng |
| Students analytics | Gọi `getStudents limit 1000`, `getSections limit 5000`, sau đó detail enrollment; còn label `Credit progress`, `Risk Explanation`, `Student Transcript Table` | Nên chuyển thành detail route/search, không để sidebar |
| Report Center | Đã có workspace `Cần xử lý` và `Thư viện báo cáo`, dialog tạo báo cáo có search môn/lớp | Hướng đúng; cần thêm tab/section `Lịch tự động` rõ hơn và giảm độ dài page |
| RBAC UI | Layout guard mới chặn `/manager/users` và `/manager/programs`; sidebar ẩn item theo role riêng 2 route này | Chưa có route policy tập trung cho tất cả path/scope |
| Header role | Vẫn hiện raw role (`superadmin`, `admin`, `manager`...) | Cần Việt hóa role label |

## 3. Actor-first information architecture

### 3.1 Sidebar đề xuất

Sidebar không nên phân chia theo database entity trước. Nên phân chia theo việc người dùng muốn làm.

| Nhóm | Mục | Role hiện |
|---|---|---|
| Điều hành | Tổng quan | Tất cả user có dashboard |
| Điều hành | Cây đào tạo | Admin, manager, viewer demo |
| Theo dõi | Lớp & SV cần chú ý | Manager, lecturer |
| Theo dõi | Môn bottleneck | Manager, lecturer |
| Báo cáo | Báo cáo | Manager, lecturer, admin |
| Dữ liệu | Sinh viên, Giảng viên, Khoa & Ngành, Môn học, Điểm số | Theo role/scope |
| Hệ thống | Chat AI, Tài khoản & phân quyền, Tài liệu CTĐT, Quan sát hệ thống | Chat cho tất cả; còn lại theo role |

Tên cần đổi:

| Hiện tại | Đề xuất |
|---|---|
| `Cơ cấu đào tạo` | `Cây đào tạo` |
| `Tổng quan toàn trường` | `Tổng quan` |
| `Ngành đào tạo` trong Phân tích | `Chi tiết ngành` |
| `Lớp học phần` | `Lớp & SV cần chú ý` |
| `Upload CTĐT` | `Tài liệu CTĐT` |

Những mục nên ẩn khỏi sidebar mặc định:

- `/manager/analytics/departments`: giữ route nội bộ, mở từ click khoa trên tổng quan.
- `/manager/analytics/students`: giữ route detail/search, mở từ danh sách SV cần chú ý hoặc global search.

### 3.2 Landing theo actor

| Actor | Landing nên thấy | Việc tiếp theo rõ nhất |
|---|---|---|
| Superadmin/Admin | Tổng quan + cảnh báo hệ thống/cấp trường | Quản lý tài khoản, kiểm tra observability khi lỗi |
| Manager khoa | Tổng quan đã scope theo khoa | Mở ngành/môn/lớp đang đỏ |
| Trưởng ngành | Chi tiết ngành theo scope | Mở môn bottleneck, tạo báo cáo ngành |
| Lecturer | Lớp & SV cần chú ý | Mở lớp của mình, tạo report lớp, hỏi AI |
| Demo viewer | Tổng quan có KPI + 3 cảnh báo + 1 CTA | Theo luồng demo trong 30 giây |

## 4. Thiết kế từng page

### 4.1 `/manager/analytics` - Tổng quan

Vai trò: màn hình điều hành chính.

Cần thiết kế:

- First screen gồm 4-5 KPI, 3 cảnh báo ưu tiên, bảng `Cần xử lý trước`.
- Filter mặc định chỉ hiện: `Học kỳ gần nhất`, `Khoa` theo scope.
- `Từ ngày / Đến ngày` đưa vào `Bộ lọc nâng cao`.
- Active chip chỉ hiện khi filter khác mặc định.
- Đổi `Program Overview Table` thành `Tổng quan ngành`.
- Trong bảng ngành, thêm action gắn ngữ cảnh: `Xem ngành`, `Xem môn rủi ro`, `Tạo báo cáo`.
- Heatmap đặt sau bảng cảnh báo, vì đây là phần điều tra, không phải việc đầu tiên.

DoD page:

- Người dùng vào trang biết ngay: tỷ lệ đạt, điểm TB, đơn vị rủi ro nhất, việc cần làm tiếp theo.
- Không tải raw enrollment trên frontend.

### 4.2 `/manager` - Cây đào tạo

Vai trò: drill-down cấu trúc trường -> khoa -> ngành/chuyên ngành.

Cần thiết kế:

- Đổi title từ `Cơ cấu tổ chức đào tạo` thành `Cây đào tạo`.
- Đặt link phụ trong sidebar sau `Tổng quan`.
- Khi click khoa/ngành, panel bên dưới cần có CTA: `Mở dashboard`, `Mở môn bottleneck`, `Hỏi AI`.
- Các prompt AI trong dropdown nên ngắn và theo dữ liệu hiện có; tránh hỏi CTĐT/RAG nếu RAG chưa sẵn sàng.
- Trên mobile, tree cần có chế độ list/accordion để tránh node quá nhỏ.

DoD page:

- Tree dùng để chọn scope và drill-down, không bị hiểu nhầm là dashboard chính.

### 4.3 `/manager/analytics/departments` - Phân tích khoa/ngành

Vai trò: route nội bộ cho điều tra khoa, không nên là entry sidebar.

Cần thiết kế:

- Ẩn khỏi sidebar.
- Mở từ row khoa trong `Tổng quan`.
- Nếu giữ page riêng, title nên là `Chi tiết khoa`.
- Filter chính: `Học kỳ`, `Khoa`; `Ngành`, date range vào advanced.
- Biểu đồ/top môn/lớp bất thường phải có action sang course/section/report.

DoD page:

- Không trùng lặp với `Tổng quan`; mỗi chart phải trả lời một câu hỏi hành động.

### 4.4 `/manager/analytics/programs` - Chi tiết ngành

Vai trò: phân tích sức khỏe ngành/chuyên ngành.

Cần thiết kế:

- Đổi title `Ngành đào tạo` thành `Chi tiết ngành`.
- Select ngành thành combobox search theo mã/tên ngành.
- Khi vào từ query param `program`, auto chọn đúng ngành.
- Đổi `Course Performance in Program` thành `Môn kéo kết quả ngành xuống`.
- `Khóa nhập học`, `Từ ngày`, `Đến ngày` đưa vào advanced.
- Bảng môn cần có action: `Mở môn`, `Mở lớp yếu`, `Tạo báo cáo ngành`.

DoD page:

- Trả lời rõ: ngành này có ổn không, khóa sinh viên nào đang yếu, môn nào cần đào sâu.

### 4.5 `/manager/analytics/courses` - Môn bottleneck / Chi tiết môn

Vai trò: tìm môn học đang kéo kết quả xuống và đào sâu một môn.

Cần thiết kế:

- Tách hai mode trong cùng route:
  - `Môn cần chú ý`: bảng aggregate top/bottom course, search môn.
  - `Chi tiết môn`: mở khi có `course_id`.
- Không gọi `getEnrollments limit 50000` để render mặc định. Cần backend aggregate `/analytics/dashboard/courses`.
- Filter chính: `Học kỳ`, `Tìm môn`.
- Advanced: `Khoa`, `Ngành`, date range.
- Bảng lớp trong môn có action: `Mở lớp`, `Tạo báo cáo môn`, `Hỏi AI về môn`.

DoD page:

- Default page load nhanh và không cần user chọn filter trước mới có insight.

### 4.6 `/manager/analytics/sections` - Lớp & SV cần chú ý

Vai trò: màn hình hành động cao nhất cho lecturer/cố vấn/manager.

Cần thiết kế:

- Đổi nav/title thành `Lớp & SV cần chú ý`.
- Lecturer mặc định chỉ thấy lớp của mình.
- Cho search lớp trực tiếp theo mã lớp/mã môn, không bắt buộc chọn môn trước.
- Filter chính: `Học kỳ`, `Tìm lớp`.
- Advanced: `Môn`, `Giảng viên`, date range.
- Bảng lớp có action: `Mở lớp`, `Tạo báo cáo lớp`, `Hỏi AI`.
- Detail lớp cần tách 2 vùng:
  - `Cần can thiệp`: SV thiếu điểm, trượt, cận trượt, điểm quá yếu.
  - `Roster đầy đủ`: danh sách lớp, có search MSSV/họ tên.
- Cần aggregate API `/analytics/dashboard/sections` để thay raw enrollment/students.

DoD page:

- Giảng viên vào trang thấy ngay lớp nào và sinh viên nào cần xử lý trong hôm nay.

### 4.7 `/manager/analytics/students` - Hồ sơ sinh viên

Vai trò: detail hồ sơ, không phải dashboard sidebar.

Cần thiết kế:

- Ẩn khỏi sidebar.
- Mở từ row SV cần chú ý, roster lớp, CRUD sinh viên, hoặc global search.
- Thay select 1000 SV bằng combobox search MSSV/họ tên/lớp.
- Đổi label:
  - `Credit progress` -> `Tiến độ tín chỉ`
  - `Risk Explanation` -> `Lý do cần theo dõi`
  - `Student Transcript Table` -> `Bảng điểm học phần`
  - `Risk level` -> `Mức theo dõi`
- Khi có dropout-risk API, hiện badge `Nguy cơ bỏ học` với xác suất đọc từ schema `ml`; UI chỉ giải thích, không tự tính xác suất.

DoD page:

- Người dùng tìm được sinh viên trong 1-2 thao tác và biết vì sao cần theo dõi.

### 4.8 `/manager/reports` - Báo cáo

Vai trò: biến insight thành artifact và action plan.

Trang hiện đã đi đúng hướng với `Cần xử lý` và `Thư viện báo cáo`. Cần tiếp tục:

- Tách rõ 3 workspace:
  - `Cần xử lý`: mặc định, chỉ báo cáo có rủi ro/watchlist.
  - `Thư viện`: tất cả snapshot trong scope.
  - `Lịch tự động`: scheduled reports, không trộn với đọc báo cáo hằng ngày.
- Dialog tạo báo cáo dùng wizard 3 bước:
  - Chọn mục tiêu: Toàn trường/Khoa/Ngành/Môn/Lớp.
  - Chọn phạm vi và học kỳ.
  - Xem trước/Tạo báo cáo.
- Report Agent chỉ mở đầy đủ khi đã chọn report. Khi chưa có report, hiện quick starts.
- Search môn/lớp trong dialog đang có, giữ lại.

DoD page:

- User mới biết nên mở báo cáo có sẵn hay tạo báo cáo mới trong vòng 10 giây.

### 4.9 `/chat` và global chat shell

Vai trò: hỏi đáp và giải thích theo ngữ cảnh.

Cần thiết kế:

- Global chat label thành `Hỏi nhanh`.
- Full chat page dùng cho session/history.
- Prompt gợi ý phải theo route:
  - Tổng quan: "Đơn vị nào cần xử lý trước?"
  - Ngành: "Môn nào kéo kết quả ngành xuống?"
  - Lớp: "SV nào cần liên hệ trước?"
  - Báo cáo: "Viết action plan cho báo cáo này."
- Nếu prompt cần ML dropout, phải đọc từ API/schema `ml`, không để LLM tạo probability.

DoD page:

- Chat không phải hộp chat chung chung; nó biết ngữ cảnh page hiện tại.

### 4.10 CRUD và RBAC

Vai trò: vận hành dữ liệu và quản trị quyền.

Cần thiết kế:

- Header Việt hóa role: `Superadmin`, `Quản trị`, `Quản lý`, `Giảng viên`, `Người xem`.
- Tạo policy map route UI tập trung thay vì hard-code từng route trong layout.
- CRUD data nằm sau nhóm `Theo dõi/Báo cáo` trong sidebar.
- Form CRUD mặc định scope theo role, tránh manager chọn nhầm khoa ngoài quyền.
- Sau khi tạo/sửa entity, nếu có analytics liên quan thì có link `Xem phân tích`.

DoD page:

- Sidebar ẩn đúng, route guard chặn đúng, API vẫn là lớp chấp hành cuối cùng.

## 5. Filter model chung

Nguyên tắc:

- Default chỉ hiện filter người dùng dùng 80% thời gian.
- Date range là advanced.
- Select dài phải là combobox search.
- Filter phụ thuộc nhau: Khoa -> Ngành -> Môn -> Lớp.
- Active chip chỉ hiện khi khác default.
- Luôn có `Đặt lại`.

Mẫu filter:

```text
[Học kỳ: Gần nhất] [Phạm vi: Theo quyền] [Tìm môn/lớp/SV...]

Bộ lọc nâng cao
  [Khoa] [Ngành] [Môn] [Lớp] [Từ ngày] [Đến ngày] [Đặt lại]

Đang lọc: Học kỳ 2024-2025 HK2 · Khoa CNTT · 2 filter
```

Convention query params:

```text
semester_code
department_id
program_id
course_id
section_id
student_id
date_from
date_to
```

Nên tạo sau demo:

- `DashboardFilterBar` dùng chung.
- Helper `dateStartIso/dateEndIso` dùng chung.
- Combobox search dùng chung cho ngành/môn/lớp/SV.

## 6. P0 cần sửa trước demo/polish gần nhất

| ID | Việc | File liên quan | Kết quả mong muốn |
|---|---|---|---|
| UX22-01 | Cắt preload raw lớn | `frontend/src/components/layout/dashboard-preloader.tsx` | Sau login không gọi enrollment 50k/grade 10k/sections 5k |
| UX22-02 | Dọn sidebar theo actor-first | `frontend/src/components/layout/app-sidebar.tsx` | `Tổng quan` là entry đầu; ẩn department/student analytics |
| UX22-03 | Đưa date range vào advanced trên dashboard chính | `analytics/page.tsx`, `programs`, `courses`, `sections`, `students`, `departments` | Filter ngắn, dễ hiểu |
| UX22-04 | Việt hóa label còn sót | `Program Overview Table`, `Course Performance in Program`, `Credit progress`, `Risk Explanation`, `Student Transcript Table`, `Risk level` | Demo chuyên nghiệp hơn |
| UX22-05 | Header role label | `frontend/src/app/(dashboard)/layout.tsx` | Không hiện raw role |
| UX22-06 | Reset filter cho từng dashboard | Các page analytics | User không bị kẹt trong filter |
| UX22-07 | Route guard map tập trung | Dashboard layout/sidebar | Role/scope dễ kiểm soát hơn |

## 7. P1 sau demo

| ID | Việc | Lý do |
|---|---|---|
| UX22-08 | Aggregate API cho course analytics | Bỏ `getEnrollments limit 50000` trên course page |
| UX22-09 | Aggregate API cho section analytics | Bỏ raw enrollment/students trên section page |
| UX22-10 | Student detail/search route | Thay select 1000 SV |
| UX22-11 | Combobox search cho ngành/môn/lớp/SV | Data lớn vẫn tìm nhanh |
| UX22-12 | Report Center wizard 3 bước | Giảm cognitive load khi tạo báo cáo |
| UX22-13 | Context-aware chat prompts | Chat hữu ích hơn theo page |
| UX22-14 | Observability UI superadmin | Hoàn thiện T53 khi API sẵn sàng |

## 8. Luồng người dùng mục tiêu

### Manager

```text
Login
-> Tổng quan
-> Mở khoa/ngành có cảnh báo
-> Chi tiết ngành
-> Môn bottleneck
-> Lớp/SV cần chú ý
-> Tạo báo cáo
-> Hỏi AI để viết action plan
```

### Lecturer / Cố vấn

```text
Login
-> Lớp & SV cần chú ý
-> Mở lớp của mình
-> Xem hàng đợi cần can thiệp
-> Tạo báo cáo lớp
-> Hỏi AI về kế hoạch hỗ trợ
```

### Superadmin

```text
Login
-> Tổng quan
-> Nếu cần: Tài khoản & phân quyền
-> Nếu có lỗi: Quan sát hệ thống
-> Drill session/event
```

### Demo 3 phút

```text
Login
-> Tổng quan: KPI + cảnh báo
-> Chi tiết ngành: môn kéo xuống
-> Lớp & SV cần chú ý: danh sách cần can thiệp
-> Báo cáo: tạo/mở report
-> Chat AI: hỏi action plan theo report
```

## 9. Definition of Done

- [ ] Sidebar actor-first, `Tổng quan` là entry đầu.
- [ ] Department/student analytics không còn là item sidebar mặc định.
- [ ] Preloader không gọi raw data lớn sau login.
- [ ] Date range nằm trong advanced filter.
- [ ] Mỗi dashboard có `Đặt lại`.
- [ ] Các title tiếng Anh còn sót được Việt hóa.
- [ ] Select danh sách dài dùng combobox search.
- [ ] Course/section/student analytics không tải 50k enrollment về frontend.
- [ ] Header và sidebar hiện role/scope bằng tiếng Việt.
- [ ] Drill-down liền mạch: overview -> detail -> report -> chat.

## 10. Ghi chú biên giới ML/AI

- UI được phép hiện `dropout risk`/xác suất nếu đọc từ API backend và schema `ml`.
- LLM/Chat chỉ giải thích prediction đã có, không tự sinh xác suất pass/dropout.
- Không suy diễn chuyên ngành từ tên lớp/tên môn trong frontend.
- Dashboard analytics dùng DWH/aggregate API; không xem CRUD tables như DWH.

## 11. Review bổ sung 26/06 — Tương tác biểu đồ và điều hướng liên page

### 11.1. Vấn đề cần làm rõ

Các analytics page hiện đã có dữ liệu và biểu đồ, nhưng trải nghiệm vẫn giống dashboard tĩnh. Người dùng nhìn thấy một khoa/ngành/môn/lớp bất thường nhưng phải tự đoán bước tiếp theo, tự đổi filter hoặc tự tìm page tương ứng trong sidebar.

Có hai lớp tương tác cần chuẩn hóa:

| Lớp tương tác | Ý nghĩa | Ví dụ |
|---|---|---|
| Trong cùng page | Click chart/table/heatmap để đổi selection, highlight dữ liệu liên quan, cập nhật panel chi tiết ngay trên page | Click bar `Pass rate theo khoa` -> chọn khoa đó, cập nhật drill-down top môn/lớp bất thường |
| Giữa các page | Click một entity để mở page phân tích sâu hơn, giữ nguyên ngữ cảnh bằng query params | Click khoa ở tổng quan -> `/manager/analytics/departments?department_id=...&semester_code=...` |

Mục tiêu UX: mọi điểm dữ liệu quan trọng phải trả lời được câu hỏi tiếp theo: **"Bấm vào đâu để hiểu nguyên nhân?"**

### 11.2. Nguyên tắc interaction contract

| Thành phần | Click chính | Secondary action | Kết quả mong muốn |
|---|---|---|---|
| KPI card | Mở danh sách entity tạo ra KPI | Hỏi AI về KPI | Không chỉ là số tĩnh |
| Bar/line/scatter point | Chọn dimension tương ứng | Double click/open icon để drill-down page | Chart điều khiển filter hoặc route |
| Heatmap cell | Chọn cả row entity và semester | Link mở detail với semester | Cell không chỉ hiển thị màu |
| Pie slice | Lọc bảng bên dưới theo bucket | Xem danh sách bản ghi thuộc bucket | Distribution phải dẫn đến evidence |
| Table row | Chọn row hoặc mở detail | Action menu: xem sâu, tạo báo cáo, hỏi AI | Table là trung tâm drill-down |
| Badge cảnh báo | Lọc nhóm rủi ro | Tạo report/watchlist | Cảnh báo dẫn tới hành động |

Không nên biến toàn bộ card thành link nếu trong card có nhiều control. Với chart, ưu tiên:

1. Single click = chọn/highlight trong page.
2. Link/button rõ ràng = mở page sâu hơn.
3. Tooltip chỉ giải thích số liệu, không thay thế hành động.

### 11.3. Query params chuẩn cho cross-page drill-down

Dùng một bộ query params thống nhất để page nhận context từ page khác:

```text
semester_code=2022-2
department_id=1
program_id=10
course_id=25
section_id=300
student_id=1200
bucket=failed|near_fail|pass|excellent
source=overview|departments|programs|courses|sections|students|reports
```

Alias cũ như `program`, `course`, `section`, `student` có thể tiếp tục đọc để backward-compatible, nhưng link mới nên dùng tên chuẩn có hậu tố `_id`.

Khi page nhận query param:

- Auto chọn đúng filter/entity.
- Giữ `semester_code` nếu có.
- Hiển thị chip nguồn: `Từ Tổng quan`, `Từ Chi tiết ngành`, hoặc `Từ Lớp`.
- Có link `Quay lại` dựa theo `source` nếu route trước rõ ràng.

### 11.4. Review hiện trạng theo page

| Page | Hiện trạng tương tác | Thiếu chính | Ưu tiên |
|---|---|---|---|
| `/manager/analytics` Tổng quan | Bảng ngành có link `Xem ngành`; chart/heatmap/pie/bar chủ yếu tooltip | Click khoa chưa mở hoặc chọn phân tích khoa; heatmap ngành x học kỳ chưa drill vào ngành + kỳ; pie chưa lọc table | P0 |
| `/manager/analytics/departments` Khoa/ngành | Có filter khoa/ngành; có link quay lại tổng quan; chart và heatmap chưa click | Bar khoa nên chọn khoa; top môn/lớp bất thường phải mở course/section; heatmap cell cần drill theo khoa + kỳ | P0 |
| `/manager/analytics/programs` Chi tiết ngành | Nhận query `program`; bảng môn có link `Xem môn` | Trend point/heatmap cohort chưa lọc học kỳ/khóa; nhóm tín chỉ/pie chưa lọc bảng môn; action thiếu `Mở lớp yếu`, `Tạo báo cáo` | P0 |
| `/manager/analytics/courses` Môn | Nhận query course/program/department; scatter và top/bottom chưa click | Click scatter/top/bottom phải chọn môn; bảng lớp trong môn cần mở section; filter chưa có semester chuẩn | P1 |
| `/manager/analytics/sections` Lớp | Bảng lớp click được để mở detail cùng page; nhận query section/course | Chart lớp yếu chưa click; SV cần chú ý chưa link sang hồ sơ sinh viên; cần link tạo báo cáo lớp | P0 |
| `/manager/analytics/students` Sinh viên | Nhận query student; charts chỉ xem | Row môn trong transcript nên mở môn/lớp; risk factor nên lọc transcript; cần mở từ sections/CRUD/search thay vì sidebar | P1 |
| `/manager/reports` Báo cáo | Có report context và report agent | Insight/report nên có link về analytics scope gốc; analytics page cần action tạo report theo scope | P1 |
| Global chat | Có page context trong shell | Prompt/action từ chart chưa truyền entity đang chọn | P1 |

### 11.5. Navigation map đề xuất

```text
Tổng quan
  click khoa/bar khoa
    -> /manager/analytics/departments?department_id=...&semester_code=...&source=overview
  click ngành/table row
    -> /manager/analytics/programs?program_id=...&semester_code=...&source=overview
  click heatmap ngành x học kỳ
    -> /manager/analytics/programs?program_id=...&semester_code=...&source=overview

Chi tiết khoa
  click top môn trượt
    -> /manager/analytics/courses?course_id=...&department_id=...&semester_code=...&source=departments
  click lớp bất thường
    -> /manager/analytics/sections?section_id=...&semester_code=...&source=departments
  click ngành trong khoa
    -> /manager/analytics/programs?program_id=...&semester_code=...&source=departments

Chi tiết ngành
  click môn trong bảng
    -> /manager/analytics/courses?course_id=...&program_id=...&semester_code=...&source=programs
  click cohort heatmap cell
    -> filter in-page cohort + semester, optional open sections list
  click môn bottleneck
    -> courses page with course selected

Chi tiết môn
  click lớp trong bảng
    -> /manager/analytics/sections?section_id=...&course_id=...&semester_code=...&source=courses
  click trend point
    -> filter same course by semester

Lớp & SV cần chú ý
  click lớp table/chart
    -> select section in-page
  click sinh viên cần chú ý
    -> /manager/analytics/students?student_id=...&section_id=...&source=sections

Hồ sơ sinh viên
  click môn trong transcript
    -> /manager/analytics/courses?course_id=...&student_id=...&source=students
  click lớp trong transcript
    -> /manager/analytics/sections?section_id=...&student_id=...&source=students
```

### 11.6. Spec page-by-page

#### Tổng quan `/manager/analytics`

P0 cần bổ sung:

- `Pass rate theo khoa`: click bar hoặc Y-axis label mở `/manager/analytics/departments?department_id=...`.
- `Program Overview Table`: cả row hoặc tên ngành mở detail ngành; action hiện rõ `Xem ngành`, `Mở môn rủi ro`, `Tạo báo cáo`.
- `Heatmap ngành × học kỳ`: click cell mở program page với `program_id` và `semester_code`.
- `Phân bố kết quả học phần`: click slice lọc `Program Overview Table` hoặc mở bảng evidence bên dưới theo bucket.
- Hai trend chart: click point đặt `semester_code` cho KPI/table nhưng trend vẫn giữ full series.

DoD: từ Tổng quan đi được xuống Khoa, Ngành, Môn, Report mà không cần dùng sidebar.

#### Khoa/ngành `/manager/analytics/departments`

P0 cần bổ sung:

- Khi vào bằng `department_id`, page auto chọn khoa và mở vùng drill-down.
- Click bar trong 3 biểu đồ khoa cập nhật `selDept` thay vì chỉ tooltip.
- Click heatmap cell chọn `selDept` + `selSem`.
- Top 10 môn trượt có action `Xem môn`.
- Top lớp bất thường có action `Xem lớp`.

DoD: click một khoa bất kỳ sẽ thấy ngay top môn/lớp cần xử lý và mở được detail.

#### Chi tiết ngành `/manager/analytics/programs`

P0 cần bổ sung:

- Trend point click: set semester filter cho KPI/bảng, đồng thời giữ chart multi-semester nếu có thể.
- Heatmap khóa × học kỳ cell click: set `cohort` + `semester`.
- Bar `Pass rate theo nhóm tín chỉ`: click group lọc bảng môn theo group.
- Pie slice `Phân bố kết quả`: click bucket lọc bảng môn hoặc mở evidence list.
- Bảng môn thêm actions: `Xem môn`, `Xem lớp yếu`, `Tạo báo cáo ngành`.

DoD: ngành -> môn -> lớp là một luồng liên tục.

#### Môn `/manager/analytics/courses`

P1 cần bổ sung:

- Scatter point click chọn môn tương ứng.
- Top/bottom course table row click chọn môn.
- Trend point click lọc semester cho detail môn.
- Section table row click mở `/manager/analytics/sections?section_id=...`.
- Thêm action `Tạo báo cáo môn`, `Hỏi AI về môn`.

Lưu ý backend: page này hiện còn phụ thuộc raw enrollment lớn; cần aggregate API trước khi mở rộng interaction quá nhiều.

#### Lớp `/manager/analytics/sections`

P0 cần bổ sung:

- Bar `Lớp có pass rate thấp nhất` click chọn lớp giống table đang làm.
- Risk student row click mở `/manager/analytics/students?student_id=...&section_id=...`.
- Detail lớp thêm action `Tạo báo cáo lớp`, `Hỏi AI về lớp`.
- Nếu mở từ course/department, giữ chip nguồn và nút quay lại đúng scope.

DoD: lecturer/manager đi từ lớp yếu tới danh sách SV và hồ sơ từng SV trong 1 click.

#### Sinh viên `/manager/analytics/students`

P1 cần bổ sung:

- Transcript row click mở course hoặc section detail.
- Risk factor row click lọc transcript theo nhóm liên quan.
- Bar điểm môn click highlight transcript row tương ứng.
- GPA trend point click lọc transcript theo semester.
- Nếu có `section_id` từ query, chip context hiển thị lớp nguồn.

DoD: hồ sơ sinh viên không chỉ là kết thúc luồng, mà còn trace ngược về môn/lớp gây rủi ro.

### 11.7. Component/hook nên tạo

| Tên | Mục đích | Dùng ở |
|---|---|---|
| `buildAnalyticsHref(scope)` | Tạo URL drill-down chuẩn, tránh mỗi page tự nối query string | Tất cả analytics pages |
| `useAnalyticsContext()` | Đọc query params chuẩn + source + back link | Các page detail |
| `DrilldownActions` | Action menu nhỏ: xem sâu, tạo báo cáo, hỏi AI | Table/chart rows |
| `InteractiveChartContainer` | Chuẩn hóa selected state, cursor, empty state, click behavior | Chart Recharts |
| `EvidenceDrawer` | Hiển thị bản ghi/evidence sau khi click chart slice/bar | Pie/bar/risk bucket |

Không cần tạo abstraction quá sớm cho mọi chart. Nên bắt đầu bằng `buildAnalyticsHref` và `DrilldownActions`, vì hai phần này giảm lỗi route nhiều nhất.

### 11.8. Acceptance criteria cho UX tương tác

- [ ] Từ `/manager/analytics`, click được ít nhất một khoa để mở page khoa đúng filter.
- [ ] Từ `/manager/analytics`, click được một ngành để mở page ngành đúng filter.
- [ ] Từ page ngành, click được một môn để mở page môn đúng context.
- [ ] Từ page môn, click được một lớp để mở page lớp đúng context.
- [ ] Từ page lớp, click được một sinh viên để mở hồ sơ sinh viên.
- [ ] Click chart trong cùng page có phản hồi rõ: selected style, chip filter, hoặc panel detail thay đổi.
- [ ] URL sau drill-down có query params đủ để reload/deep-link vẫn giữ đúng context.
- [ ] Mỗi page detail có cách quay lại page nguồn hoặc scope trước.
- [ ] Tooltip không phải là nơi duy nhất chứa thông tin quan trọng.
- [ ] Các action không phá RBAC; route có thể ẩn link nhưng backend vẫn enforce quyền.

### 11.9. Thứ tự triển khai đề xuất

| ID | Việc | File chính | Lý do |
|---|---|---|---|
| UX22-15 | Tạo helper URL drill-down analytics | `frontend/src/lib/...` | Nền cho liên page, ít rủi ro |
| UX22-16 | Tổng quan -> khoa/ngành/heatmap click | `analytics/page.tsx` | Luồng demo và manager entry chính |
| UX22-17 | Khoa -> môn/lớp click | `analytics/departments/page.tsx` | Hoàn thiện ví dụ người dùng nêu |
| UX22-18 | Ngành -> môn/lọc chart | `analytics/programs/page.tsx` | Luồng chẩn đoán quan trọng |
| UX22-19 | Môn -> lớp click | `analytics/courses/page.tsx` | Nối xuống mức can thiệp |
| UX22-20 | Lớp -> sinh viên click | `analytics/sections/page.tsx` | Nối tới hành động với SV |
| UX22-21 | Student trace ngược môn/lớp | `analytics/students/page.tsx` | Hoàn thiện vòng evidence |
