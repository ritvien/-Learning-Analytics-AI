# Teacher Account & Section Assignment

> Ngày tạo: 26/06/2026  
> Phạm vi: luồng cấp tài khoản giảng viên và phân công lớp học phần cho giảng viên.  
> Code đã rà: `frontend/src/app/(dashboard)/manager/teachers/page.tsx`, `frontend/src/app/(dashboard)/manager/grades/page.tsx`, `frontend/src/lib/api.ts`, `backend/app/api/v1/endpoints/teachers.py`, `backend/app/api/v1/endpoints/sections.py`.

## 1. Kết luận nhanh

Frontend hiện **đã có cấp/reset tài khoản lecturer cho Teacher**, nhưng **chưa có UI để gán lớp học phần cho giảng viên**.

Điểm quan trọng về mô hình dữ liệu:

```text
User account
  role = lecturer
  dùng để đăng nhập

Teacher
  user_id -> User.id
  là hồ sơ giảng viên trong dữ liệu học vụ

Section
  teacher_id -> Teacher.id
  là phân công lớp học phần cho giảng viên
```

Vì vậy không nên hiểu là "gán lớp cho user". Luồng đúng là:

```text
Tạo Teacher
-> Cấp account lecturer cho Teacher
-> Gán Section.teacher_id cho Teacher
-> Lecturer đăng nhập chỉ thấy section của mình
```

## 2. Hiện trạng code

### 2.1 Đã có

| Khả năng | Trạng thái | Nơi đang có |
|---|---|---|
| Danh sách giảng viên | Đã có | `frontend/src/app/(dashboard)/manager/teachers/page.tsx` |
| Tạo/sửa/xóa Teacher | Đã có | `teachers/page.tsx`, `api.createTeacher`, `api.updateTeacher`, `api.deleteTeacher` |
| Cấp account lecturer ngay khi tạo Teacher | Đã có | `create_account`, `login_password` trong `api.createTeacher` |
| Cấp/reset account cho Teacher có sẵn | Đã có | `api.provisionTeacherAccount`, `POST /api/v1/teachers/{id}/account` |
| Backend section có `teacher_id` | Đã có | `backend/app/schemas/teaching.py` |
| Backend update section nhận `teacher_id` | Đã có | `PATCH /api/v1/sections/{section_id}` |
| Lecturer scope theo lớp mình dạy | Đã có ở nhiều endpoint | `can_access_section`, `list_sections`, `list_students`, `grades` |

### 2.2 Chưa có

| Thiếu | Tác động |
|---|---|
| Frontend API client `createSection`, `updateSection`, `deleteSection` | UI không gọi được `PATCH /sections/{id}` để đổi `teacher_id` |
| Page quản lý lớp học phần dạng CRUD | Admin/manager không có màn hình phân công lớp cho giảng viên |
| Action "Phân lớp" trong trang giảng viên | Không thể chọn nhiều section rồi gán cho một Teacher |
| Hiển thị số lớp đang phụ trách trên bảng Teacher | Người quản lý không biết GV đã được phân công chưa |
| Filter section theo teacher trong UI quản trị | Khó kiểm tra lớp của từng GV |
| RBAC write scope cho update/delete section cần siết lại | Backend hiện có `require_write_access`, nhưng cần bảo đảm manager không sửa section ngoài khoa |

## 3. User stories cần bổ sung

### TA-01 — Cấp tài khoản giảng viên từ hồ sơ Teacher

Là admin/manager, tôi muốn tạo hồ sơ giảng viên và cấp tài khoản đăng nhập role `lecturer`, để giảng viên có thể đăng nhập hệ thống.

Hiện trạng: gần như đã xong.

Acceptance criteria:

- Tạo Teacher có email và mật khẩu thì backend tạo User role `lecturer`.
- Teacher nhận `user_id`.
- Bảng Teacher hiển thị `Đã cấp` hoặc `Chưa cấp`.
- Reset account đổi email/password cho User đã linked.

### TA-02 — Phân công lớp học phần cho giảng viên

Là admin/manager, tôi muốn chọn một hoặc nhiều lớp học phần và gán cho giảng viên, để lecturer đăng nhập chỉ thấy lớp của mình.

Acceptance criteria:

- Từ trang Teacher có action `Phân lớp`.
- Dialog hiển thị danh sách sections trong phạm vi khoa/quyền hiện tại.
- Có filter `Học kỳ`, `Môn`, `Chưa phân công`, `Đang thuộc giảng viên này`.
- Chọn nhiều lớp rồi lưu.
- Backend cập nhật `sections.teacher_id`.
- Lecturer đăng nhập thấy các lớp vừa được gán ở analytics sections, reports, grades.

### TA-03 — Quản lý lớp học phần trực tiếp

Là admin/manager, tôi muốn mở trang quản lý lớp học phần để tạo/sửa lớp, đổi giảng viên phụ trách, phòng học, lịch học và sĩ số tối đa.

Acceptance criteria:

- Có route quản trị, ví dụ `/manager/sections`.
- Bảng section có cột `Mã lớp`, `Môn`, `Học kỳ`, `Giảng viên`, `Phòng`, `Lịch`, `Sĩ số tối đa`.
- Form tạo/sửa section có select `Môn`, `Học kỳ`, `Giảng viên`.
- Select giảng viên chỉ hiện teacher trong khoa phù hợp hoặc trong scope hiện tại.
- Sửa `teacher_id` refresh lại bảng và không làm mất dữ liệu điểm/enrollment.

## 4. UX flow đề xuất

### 4.1 Flow chính từ trang Giảng viên

```text
/manager/teachers
-> click action "Phân lớp" trên một giảng viên
-> mở dialog "Phân lớp học phần"
-> chọn học kỳ
-> tick các lớp cần giao
-> Lưu phân công
-> bảng Teacher cập nhật số lớp đang phụ trách
```

Nên ưu tiên flow này trước vì đúng câu hỏi vận hành: "Tạo tài khoản xong phân lớp cho giáo viên thế nào?"

### 4.2 Flow phụ từ trang Lớp học phần

```text
/manager/sections
-> chọn hoặc tạo section
-> field "Giảng viên phụ trách"
-> chọn teacher
-> Lưu
```

Flow này cần khi phòng đào tạo quản trị lớp theo học kỳ.

### 4.3 Flow kiểm tra sau khi phân công

```text
Login bằng account lecturer
-> /manager/analytics/sections
-> chỉ thấy lớp của teacher đó
-> /manager/grades
-> chỉ thấy enrollment/điểm trong lớp của teacher đó
-> /manager/reports
-> tạo report section trong scope lớp của mình
```

## 5. Frontend cần bổ sung

### 5.1 API client

Thêm vào `frontend/src/lib/api.ts`:

```ts
createSection(body: {
  course_id: number
  semester_id: number
  section_code: string
  teacher_id?: number | null
  room?: string | null
  schedule?: string | null
  max_students?: number | null
  is_active?: boolean
})

updateSection(id: number, body: Partial<{
  teacher_id: number | null
  room: string | null
  schedule: string | null
  max_students: number | null
  is_active: boolean
}>)

deleteSection(id: number)
```

### 5.2 Trang Teacher

File chính: `frontend/src/app/(dashboard)/manager/teachers/page.tsx`

Cần thêm:

- Cột `Số lớp phụ trách`.
- Action icon `Phân lớp`.
- Dialog `AssignSectionsDialog`.
- Load thêm `sections`, `courses`, `semesters`.
- Trong dialog:
  - Filter học kỳ.
  - Search theo mã lớp/mã môn/tên môn.
  - Toggle `Chỉ lớp chưa phân công`.
  - Checkbox nhiều lớp.
  - Badge lớp đã thuộc giảng viên khác.
  - Button `Lưu phân công`.

Hành vi khi lưu:

- Với section được tick mới: gọi `api.updateSection(section.id, { teacher_id: teacher.id })`.
- Với section bỏ tick nếu đang thuộc teacher này: gọi `api.updateSection(section.id, { teacher_id: null })`.
- Không tự động gỡ lớp đang thuộc giảng viên khác nếu user chưa xác nhận.

### 5.3 Trang Sections CRUD

File đề xuất: `frontend/src/app/(dashboard)/manager/sections/page.tsx`

Cần có nếu muốn quản trị đầy đủ:

- Bảng section.
- Form tạo/sửa section.
- Select `course_id`, `semester_id`, `teacher_id`.
- Filter học kỳ, khoa/ngành, môn, giảng viên.
- Link sang analytics: `/manager/analytics/sections?section_id=...`.

Sidebar đề xuất:

- Nhóm `Đào tạo`: thêm `Lớp học phần`.
- Không nhầm với analytics route `/manager/analytics/sections` đang là `Lớp & SV cần chú ý`.

### 5.4 Trang Grades

File chính: `frontend/src/app/(dashboard)/manager/grades/page.tsx`

Không cần biến trang này thành nơi phân công lớp. Chỉ nên bổ sung nhẹ:

- Hiển thị giảng viên phụ trách của lớp trong dropdown/filter.
- Với admin/manager, có link nhanh `Quản lý phân công lớp`.
- Với lecturer, copy nên nói rõ `Bạn đang xem các lớp được phân công`.

## 6. Backend cần kiểm tra hoặc bổ sung

### 6.1 Scope khi cập nhật section

Hiện `PATCH /api/v1/sections/{section_id}` dùng `require_write_access`, nhưng cần kiểm tra chặt:

- Manager chỉ sửa section thuộc khoa mình.
- Manager chỉ gán teacher thuộc khoa mình.
- Lecturer không được tự phân lớp.
- Admin/superadmin được toàn quyền.

Logic đề xuất:

```text
update_section(section_id, payload, current_user)
  load section
  if manager:
    ensure can_access_section(section_id)
    if payload.teacher_id:
      ensure teacher.department_id in manager department scope
  if lecturer:
    reject 403
```

### 6.2 Endpoint bulk assignment

Có thể dùng nhiều lần `PATCH /sections/{id}` cho MVP. Sau đó nên thêm endpoint bulk để UI nhanh và transaction an toàn:

```text
POST /api/v1/teachers/{teacher_id}/sections
{
  "section_ids": [1, 2, 3],
  "mode": "replace" | "append"
}
```

Quy tắc:

- `replace`: danh sách section của teacher trong học kỳ/filter hiện tại được thay bằng danh sách mới.
- `append`: chỉ thêm section mới, không gỡ section cũ.

MVP nên dùng `append` hoặc nhiều `PATCH` để giảm rủi ro gỡ nhầm.

## 7. RBAC kỳ vọng sau khi hoàn thiện

| Role | Tạo Teacher | Cấp account | Gán section | Xem lớp | Nhập điểm |
|---|---:|---:|---:|---:|---:|
| superadmin | Có | Có | Mọi khoa | Mọi lớp | Mọi lớp |
| admin | Có | Có | Mọi khoa | Mọi lớp | Mọi lớp |
| manager | Trong khoa | Trong khoa | Section/teacher trong khoa | Trong khoa | Trong khoa |
| lecturer | Không | Không | Không | Lớp mình dạy | Lớp mình dạy |
| viewer | Không | Không | Không | Theo scope đọc nếu có | Không |

Lưu ý: frontend chỉ ẩn/hiện UI. Backend vẫn phải enforce.

## 8. Data states cần hiển thị rõ

| State | UI nên hiển thị |
|---|---|
| Teacher chưa có account | Badge `Chưa cấp tài khoản`, action `Cấp tài khoản` |
| Teacher có account | Badge `Đã cấp`, action `Reset tài khoản` |
| Teacher chưa có section | Badge `0 lớp`, CTA `Phân lớp` |
| Section chưa có teacher | Badge `Chưa phân công` |
| Section thuộc teacher khác | Hiển thị tên teacher hiện tại, cần xác nhận nếu muốn đổi |
| Lecturer không linked Teacher | Trang lecturer hiển thị empty state: `Tài khoản chưa liên kết hồ sơ giảng viên` |

## 9. Edge cases

- Một Teacher có nhiều section trong nhiều học kỳ.
- Một Section chỉ có một `teacher_id` chính trong schema hiện tại.
- Nếu sau này cần đồng giảng viên, phải thêm bảng join `section_teachers`; chưa làm trong MVP.
- Teacher đổi khoa: cần quyết định có giữ section cũ hay cảnh báo xung đột.
- User lecturer bị khóa: section vẫn còn teacher_id, nhưng account không đăng nhập được.
- Teacher bị soft-delete: cần cảnh báo section đang tham chiếu teacher không active.

## 10. P0 implementation checklist

- [ ] Thêm `api.updateSection` vào frontend API client.
- [ ] Trang Teacher load thêm sections/courses/semesters.
- [ ] Thêm cột `Số lớp phụ trách`.
- [ ] Thêm action `Phân lớp`.
- [ ] Tạo dialog chọn nhiều section cho một teacher.
- [ ] Gọi `PATCH /sections/{id}` để set/unset `teacher_id`.
- [ ] Hiển thị section đã có teacher khác và yêu cầu xác nhận khi đổi.
- [ ] Backend `PATCH /sections/{id}` check scope section và teacher.
- [ ] Manual smoke: tạo Teacher -> cấp account -> gán section -> login lecturer -> thấy đúng lớp.

## 11. P1 implementation checklist

- [ ] Tạo `/manager/sections` CRUD page.
- [ ] Thêm sidebar item `Lớp học phần` trong nhóm `Đào tạo`.
- [ ] Thêm endpoint bulk assignment nếu cần performance/transaction.
- [ ] Thêm link từ Teacher row sang analytics sections filter `teacher_id`.
- [ ] Thêm test frontend cho dialog phân lớp.
- [ ] Thêm backend pytest: manager không gán teacher ngoài khoa; lecturer bị 403.

## 12. Definition of Done

- Admin/manager có thể hoàn tất từ UI:
  - tạo giảng viên,
  - cấp tài khoản,
  - phân lớp học phần.
- Lecturer đăng nhập bằng account được cấp và chỉ thấy lớp thuộc `sections.teacher_id = teacher.id`.
- Không cần sửa database thủ công.
- Không cần gọi API bằng Postman để phân lớp.
- Reload/deep-link vẫn giữ dữ liệu đúng.
- RBAC backend chặn sửa section ngoài scope.
