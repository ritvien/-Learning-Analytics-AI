# Hướng dẫn Setup và Đồng bộ Database cho Team

Tài liệu này mô tả cách mọi thành viên chạy dự án, nhận thay đổi database và tham gia đợt chuyển đổi DWH/ML mà không làm lệch môi trường.

## 1. Yêu cầu

- Git
- Docker Desktop và Docker Compose v2
- Python 3.11+
- Node.js 20+

Docker Compose là môi trường phát triển chuẩn cho database và backend. PostgreSQL là database chuẩn; SQLite chỉ dùng cho một số unit test nhỏ.

## 2. Setup lần đầu

```powershell
git clone <repository-url>
cd C2-App-056
Copy-Item .env.example .env
docker compose up --build
```

Kiểm tra:

```powershell
docker compose ps
docker compose exec backend alembic current
docker compose exec backend pytest
```

## 3. Quy trình pull code hằng ngày

```powershell
git pull
docker compose up --build
```

Backend tự chạy `alembic upgrade head`. Không xóa database volume khi pull bình thường.

## 4. Đợt reset database có kiểm soát

Dự án sẽ có **một lần reset database local** khi migration baseline mới được merge. Tech lead phải thông báo rõ commit/PR bắt đầu reset. Schema DWH và ML được thêm bằng các migration tiếp theo, không yêu cầu reset lần nữa.

Sau khi nhận thông báo:

```powershell
git pull
docker compose down -v
docker compose up --build
```

> `docker compose down -v` xóa toàn bộ database local. Không chạy lệnh này ngoài đợt reset đã thống nhất.

Sau reset, mỗi thành viên xác nhận:

```powershell
docker compose exec backend alembic current
docker compose exec db psql -U eduinsight -d eduinsight -c "\dn"
```

Kết quả phải có cùng Alembic revision và schema `public`. Sau các phase DWH/ML, schema `dwh` và `ml` phải xuất hiện qua migration bình thường.

## 5. Quy tắc thay đổi database

Nguồn định nghĩa database chính là SQLAlchemy ORM trong `backend/app/models/`.

Mỗi thay đổi database phải đi theo quy trình:

1. Sửa ORM model.
2. Tạo Alembic migration.
3. Review cả `upgrade()` và `downgrade()`.
4. Chạy migration trên database sạch.
5. Chạy migration trên database đang có seed data.
6. Cập nhật seed, ETL và test liên quan.

```powershell
docker compose exec backend alembic revision --autogenerate -m "describe change"
docker compose exec backend alembic upgrade head
docker compose exec backend alembic downgrade -1
docker compose exec backend alembic upgrade head
```

Không sửa database trực tiếp bằng GUI rồi bỏ qua migration.

## 6. Quy tắc seed và ETL

- Seed script dùng natural key như `student_code`, `course_code`, `cohort_code`; không dựa vào ID hard-code.
- Seed phải idempotent: chạy lại không tạo duplicate.
- ETL load dimension trước, fact sau.
- ETL phải ghi `dwh.etl_run` và kết quả đối soát.
- Prediction chỉ chạy sau khi ETL thành công.

## 7. Quy trình xác minh sau pull

Khi PR có label hoặc mô tả `database-change`, chạy:

```powershell
git pull
docker compose up --build
docker compose exec backend alembic current
docker compose exec backend pytest
```

Nếu PR thay đổi ETL/ML, chạy thêm runner tương ứng và kiểm tra:

- ETL chạy lại không tăng số dòng ngoài dự kiến.
- Tổng enrollment và tín chỉ pass/trượt khớp giữa OLTP/DWH.
- Prediction có `model_run_id`, `scored_at` và `prediction_cutoff`.

## 8. Tài liệu nguồn chuẩn

- Kiến trúc DWH/ML: [ML_DWH_Architecture.md](./ML_DWH_Architecture.md)
- Kế hoạch chuyển đổi toàn team: [DatabaseModernizationPlan.md](./DatabaseModernizationPlan.md)
- Kiến trúc hệ thống: [SystemArchitecture.md](./SystemArchitecture.md)
