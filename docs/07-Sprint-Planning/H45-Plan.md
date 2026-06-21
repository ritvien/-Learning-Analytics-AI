# H45 — Kế hoạch nâng Academic Tree lên 3 tầng nghiệp vụ

> **Owner:** Hoàng  
> **Thời gian:** 21/06 – 22/06/2026  
> **Priority:** P0  
> **Trạng thái:** Hoàn thành — Hoàng đã triển khai và verify T44 ngày 21/06/2026  
> **Phụ thuộc tiếp theo:** `H45 -> T44 -> {V36, H46}`

## 1. Mục tiêu

Chốt kiến trúc và hợp đồng bàn giao để hệ thống hỗ trợ cây học vụ:

```text
Trường
└── Khoa (Department)
    └── Ngành / Chương trình đào tạo (Program)
        └── Chuyên ngành (Specialization)
            └── Môn học (Course)
```

H45 hoàn thành khi Hoàng triển khai `T44` đúng schema, API, backfill và cách
roll-up metric đã chốt; Hiếu có contract ổn định để làm `V36`; và
Hoàng có đầu vào rõ để seed dữ liệu ở `H46`.

## 2. Quyết định kiến trúc

### 2.1. Thuật ngữ chuẩn

| Thuật ngữ UI | Entity hiện tại | Ý nghĩa |
|---|---|---|
| Khoa | `Department` | Đơn vị quản lý ngành và môn |
| Ngành / CTĐT | `Program` | Ngành đào tạo, ví dụ Công nghệ thông tin |
| Chuyên ngành | `Specialization` mới | Nhánh chuyên sâu thuộc một ngành |
| Môn học | `Course` | Học phần có thể dùng chung giữa nhiều ngành/chuyên ngành |

Không dùng cấu trúc `Khoa -> Chuyên ngành -> Ngành`, vì `Program` và toàn bộ dữ
liệu hiện tại đang mang nghĩa Ngành/CTĐT.

### 2.2. Mô hình dữ liệu đề xuất

Thêm bảng `specializations`:

```text
id                PK
program_id        FK -> programs.id, NOT NULL
code              VARCHAR(30), NOT NULL
name              VARCHAR(255), NOT NULL
name_en           VARCHAR(255), NULL
description       TEXT, NULL
is_placeholder    BOOLEAN, NOT NULL, DEFAULT FALSE
is_active         BOOLEAN, NOT NULL, DEFAULT TRUE
created_at
updated_at

UNIQUE(program_id, code)
INDEX(program_id)
```

Thêm bảng nối `specialization_courses`:

```text
specialization_id FK -> specializations.id, ON DELETE CASCADE
course_id         FK -> courses.id, ON DELETE CASCADE
PRIMARY KEY(specialization_id, course_id)
```

Thêm `students.specialization_id` dạng nullable để không làm hỏng dữ liệu cũ.
Ràng buộc nghiệp vụ phải kiểm tra specialization thuộc đúng `student.program_id`.

Giữ nguyên `program_courses` trong Sprint 3. Đây vẫn là curriculum cấp ngành và
là đường tương thích cho các report/view hiện có. `specialization_courses` chỉ
mô tả phần môn thuộc từng chuyên ngành.

### 2.3. Chiến lược dữ liệu cũ

Migration không được đoán chuyên ngành thật từ tên lớp hoặc tên môn.

1. Tạo một specialization placeholder `UNASSIGNED` — “Chưa phân loại” cho mỗi
   Program hiện có.
2. Copy mapping từ `program_courses` sang `specialization_courses` của placeholder.
3. Để `students.specialization_id` là `NULL` trong migration.
4. `H46` mới chịu trách nhiệm map sinh viên và môn vào chuyên ngành thật từ dữ
   liệu crawl đã được kiểm chứng.

Migration downgrade phải xóa FK/bảng mới mà không tác động `programs`, `courses`,
`program_courses` hoặc sinh viên hiện có.

## 3. API contract bàn giao cho T44

### 3.1. Tree API

`GET /api/v1/tree` giữ response cũ nhưng thêm node type `specialization`:

```json
{
  "id": 1,
  "type": "program",
  "code": "PROG002",
  "label": "Công nghệ thông tin",
  "metrics": {},
  "children": [
    {
      "id": 11,
      "type": "specialization",
      "code": "SE",
      "label": "Công nghệ phần mềm",
      "metrics": {},
      "children": []
    }
  ]
}
```

Thứ tự node bắt buộc:

```text
school -> department -> program -> specialization -> course
```

`GET /api/v1/tree/specialization/{id}/metrics` phải hoạt động qua endpoint metrics
hiện có.

### 3.2. CRUD tối thiểu

T44 cần cung cấp:

```text
GET    /api/v1/specializations?program_id=
GET    /api/v1/specializations/{id}
POST   /api/v1/specializations
PATCH  /api/v1/specializations/{id}
DELETE /api/v1/specializations/{id}
```

Quyền truy cập specialization kế thừa department của Program cha. Scoped user
không được đọc hoặc sửa specialization ngoài khoa của mình.

## 4. Quy tắc metric

- Metric course: giữ nguyên.
- Metric specialization: lấy tập môn trong `specialization_courses` và sinh viên
  được gán vào specialization đó.
- Metric program: roll-up theo tập hợp duy nhất của student, course và enrollment;
  không cộng thẳng các specialization vì một môn có thể xuất hiện ở nhiều nhánh.
- Metric department/school: tiếp tục deduplicate theo ID như cấp Program.
- Placeholder specialization có thể hiển thị metric từ các môn đã backfill, nhưng
  phải gắn cờ dữ liệu “chưa phân loại”; không được trình bày như chuyên ngành thật.
- Health Score trong Tree hiện dùng công thức riêng so với module
  `analytics/health_score.py`; T44 không đổi công thức trong migration này. Việc
  hợp nhất công thức phải tách task để tránh mở rộng scope H45.

## 5. Thay đổi do Hoàng phụ trách

Sau khi contract backend được chốt:

1. Cập nhật schema table và JOIN guidance trong `backend/app/agent/prompts.py`.
2. Tách rõ entity recognition giữa “ngành” và “chuyên ngành”; không coi hai từ là
   đồng nghĩa.
3. Bổ sung ví dụ query có `specializations` và `specialization_courses`.
4. Cập nhật Mermaid Academic Tree trong `README.md`.
5. Chuẩn bị mapping template cho H46 với các cột:
   `program_code`, `specialization_code`, `specialization_name`, `class_code`,
   `student_code`, `confidence`, `source`, `review_status`.

Mapping template: [H46-specialization-mapping-template.csv](./H46-specialization-mapping-template.csv).

## 6. Phân chia trách nhiệm

| Phần việc | Owner | Output |
|---|---|---|
| Chốt thuật ngữ, hierarchy và quyết định dữ liệu | Hoàng — H45 | Tài liệu này được team xác nhận |
| Chốt schema, backfill, API và metric contract | Hoàng — H45 | Handoff checklist cho T44/V36/H46 |
| ORM, Alembic, CRUD, Tree API, RBAC, backend tests | Hoàng — T44 | Backend chạy và migration pass |
| Tree UI, labels, drill-down, chat context | Hiếu — V36 | UI hiển thị đúng 4 cấp |
| Prompt, README diagram, mapping/seed dữ liệu | Hoàng — H45/H46 | Agent hiểu scope mới, dữ liệu được verify |

## 7. Trình tự thực hiện

### Ngày 21/06 — chốt contract

1. Xác nhận hierarchy và thuật ngữ với Hưng, Hiếu.
2. Chốt ERD, FK, unique constraint và chiến lược placeholder.
3. Chốt JSON contract của Tree API và CRUD specialization.
4. Chốt quy tắc roll-up/deduplicate metric.
5. Handoff phần backend cho `T44` và phần UI cho `V36`.

Kết quả cuối ngày: không còn câu hỏi mở về thứ tự node, tên entity, FK, backfill
hay shape response.

### Ngày 22/06 — đồng bộ AI/docs và review T44

1. Review migration/ORM/API contract đầu tiên của T44.
2. Cập nhật prompt schema và entity recognition.
3. Cập nhật Mermaid/README.
4. Chuẩn bị mapping template cho H46.
5. Chạy checklist acceptance và ghi blocker nếu có.

## 8. Acceptance checklist

- [x] Team xác nhận một hierarchy duy nhất: Department -> Program -> Specialization -> Course.
- [x] Có ERD và field definition đủ để viết migration không cần đoán.
- [x] Có quy tắc backfill/downgrade không mất dữ liệu.
- [x] Có Tree API contract chứa node `specialization`.
- [x] Có quy tắc RBAC kế thừa từ Program/Department.
- [x] Có quy tắc metric và deduplicate rõ ràng.
- [x] Ownership T44 chuyển sang Hoàng; implementation đã hoàn thành.
- [x] Frontend `ApiTreeNode` đã có type `specialization` để Hiếu triển khai V36.
- [x] Prompt và README phản ánh đúng hierarchy mới.
- [x] Có mapping template sẵn cho H46.

## 9. Kiểm thử bắt buộc cho handoff

T44 chỉ được coi là đủ ổn định để mở `V36` và `H46` khi:

- Alembic upgrade từ DB hiện tại pass và downgrade pass.
- Row counts cũ của departments/programs/courses/students không đổi.
- Mỗi Program cũ có đúng một placeholder specialization sau backfill.
- Mapping course cũ vẫn truy xuất được qua `program_courses`.
- Tree trả đúng 5 node type và metric không bị double-count.
- Metrics endpoint của specialization trả 200; ID sai trả 404.
- Manager chỉ nhìn thấy specialization thuộc department được phân quyền.
- Test Tree cũ được cập nhật và có thêm case specialization.

## 10. Ngoài phạm vi H45

- Tự động suy đoán chuyên ngành bằng LLM.
- Xóa hoặc thay thế `program_courses`.
- Viết lại toàn bộ DWH/report scope theo specialization.
- Hợp nhất hai công thức Health Score đang tồn tại.
- Hoàn thiện UI; phần này thuộc V36.

## 11. Tiến độ thực hiện

- [x] Chốt hierarchy và thuật ngữ chuẩn.
- [x] Chốt schema, backfill, API, RBAC và metric contract.
- [x] Liên kết kế hoạch H45 vào Sprint 3.
- [x] Cập nhật kiến trúc và Mermaid trong README/tài liệu hệ thống.
- [x] Tách “ngành” và “chuyên ngành” trong Agent prompt hiện tại.
- [x] Tạo mapping template cho H46.
- [x] Hoàng triển khai ORM/Alembic/CRUD/RBAC/Tree API cho T44.
- [x] Migration T44 upgrade trên PostgreSQL local và backfill đủ 37/37 Program, 880/880 course mappings.
- [x] Kích hoạt schema chuyên ngành trong Agent prompt sau khi migration T44 pass.
- [x] Backend test suite pass 29 tests; frontend TypeScript check pass.

## 12. Nội dung handoff cho team

```text
H45 đã chốt hierarchy: Department -> Program -> Specialization -> Course.

Hoàng/T44:
- Implement specializations + specialization_courses và students.specialization_id nullable.
- Backfill một UNASSIGNED specialization cho mỗi Program; không đoán dữ liệu thật.
- Giữ program_courses để tương thích.
- Tree API thêm node specialization; metric roll-up phải deduplicate theo ID.
- Contract/acceptance: docs/07-Sprint-Planning/H45-Plan.md.

Hiếu/V36:
- Chuẩn bị ApiTreeNode type specialization.
- Render đúng school -> department -> program -> specialization -> course.
- Không đổi nhãn Ngành và Chuyên ngành cho nhau.
- Chỉ bắt đầu tích hợp sau khi migration + Tree API T44 pass.

Hoàng/H46:
- Dùng H46-specialization-mapping-template.csv để map dữ liệu thật.
- Không ghi mapping confidence thấp nếu chưa review.
```
