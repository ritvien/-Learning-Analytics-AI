# Backend Sprint 1 Review

> **Phạm vi:** nhiệm vụ Backend/DevOps của Hưng  
> **Quyết định phạm vi:** không xây dựng tính năng Import Excel trong MVP hiện tại

## 1. Kết quả rà soát

| Task | Trạng thái thực tế | Bằng chứng / vấn đề còn lại |
|:-----|:------------------:|:---------------------------|
| T1 - Chốt câu hỏi phỏng vấn | Done | Bộ câu hỏi đã có trong `docs/08-Surveys/01-Requirement-Validation/` |
| T2 - Liên hệ và xếp lịch | Chưa xác minh | Cần lưu lịch hoặc danh sách stakeholder |
| T3 - Tiến hành phỏng vấn | Not Done | Chưa có transcript/notes stakeholder |
| T4 - Tổng hợp insights | Not Done | Chưa có tài liệu tổng hợp findings |
| T5 - DB Schema Design | Done | ORM là nguồn chuẩn; Program-Course đã chuyển sang many-to-many |
| T6 - FastAPI Setup | Done | Có project structure, models và Alembic baseline |
| T7 - Docker Compose | Done | Đã dựng PostgreSQL + backend từ volume sạch bằng Alembic |
| T8 - CI/CD | Partial | Có Ruff + pytest workflow và test local pass; cần xác nhận branch protection |
| T9 - CRUD Core APIs | Done | Có endpoint CRUD, `/health` và integration test luồng core entities |
| T10 - DB review + migration plan | Done | Kế hoạch nằm trong `DatabaseModernizationPlan.md` |

## 2. Quyết định kỹ thuật

- Không phát triển endpoint hoặc UI Import Excel.
- Excel vẫn có thể xuất hiện trong mô tả pain point của stakeholder, nhưng không phải nguồn ingest của MVP.
- SQLAlchemy ORM trong `backend/app/models/` là nguồn định nghĩa database duy nhất.
- `backend/db/schema.sql` chỉ là tài liệu tham chiếu/bootstrap tạm thời.
- Alembic baseline `54025928d213` là mốc khởi tạo OLTP hiện tại.
- Dữ liệu đầu vào MVP đến từ CRUD API, seed hoặc sync job được kiểm soát.

## 3. Vấn đề cần xử lý

### P0 - Nền tảng backend đã xử lý

1. Program-Course dùng many-to-many qua `program_courses`.
2. ORM, Pydantic schemas và CRUD API đã dùng cùng contract.
3. Alembic baseline có upgrade/downgrade và dựng được database sạch.
4. Backend tests chạy qua; CI có bước kiểm tra migration.
5. Docker Compose dựng PostgreSQL và FastAPI healthy từ volume sạch.

### Việc dữ liệu còn lại

- Hoàn thiện seed/sync job idempotent theo async SQLAlchemy và natural key.
- Seed dữ liệu demo không nằm trong Alembic baseline; database sạch hiện khởi tạo đúng schema nhưng chưa có dữ liệu mẫu.

### Đã xử lý trong lượt rà soát

- Loại bỏ nguồn ORM legacy `backend/app/models.py`.
- Loại bỏ script sync legacy dùng `SessionLocal` không tồn tại.
- Test backend không còn phụ thuộc giá trị `DEBUG` trong `.env` cục bộ.
- Seed generator đọc được nguồn `epu_data.json` hiện có và dùng đúng tên trường tiếng Việt.
- Ruff lint/format và backend tests chạy qua trên máy rà soát.
- Alembic baseline đã chạy thành công trên SQLite và PostgreSQL sạch.
- Docker Compose đã được xác nhận healthy sau `down -v` và `up --build`.

### P1 - Đủ điều kiện cho DWH/ML

1. Lưu đầy đủ điểm thành phần và thời điểm ghi nhận để tránh data leakage.
2. Bổ sung snapshot tín chỉ đăng ký/pass/trượt theo học kỳ.
3. Tạo schema `dwh`, ETL idempotent và kiểm tra đối soát.
4. Tạo schema `ml`, lưu model run và prediction từng enrollment.

## 4. Definition of Done cho lượt sửa database

- Chỉ còn một nguồn ORM trong `backend/app/models/`.
- Database sạch được dựng bằng Alembic migration và seed/sync script.
- CRUD API, lint và tests chạy qua.
- Docker Compose chạy được từ volume sạch.
- Team có hướng dẫn một lần reset local; các lần pull sau chỉ chạy migration.
- DWH và ML được triển khai sau khi OLTP baseline ổn định.
