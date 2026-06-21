# H46 — Seed 1.277 sinh viên thực

## Kết quả chuẩn hóa

| Chỉ số | Giá trị |
|---|---:|
| Dòng nguồn | 1.560 |
| Dòng có MSSV | 1.319 |
| MSSV duy nhất | 1.277 |
| Dòng trùng MSSV | 42 |
| Token không có dữ liệu | 241 |
| Lớp được map | 80/80 |
| Chuyên ngành thật | 26 |
| Môn học sau chuẩn hóa | 549 |
| Enrollment | 56.301 |
| Điểm thành phần | 147.286 |

Hai mươi bốn dòng miễn môn không có mã lớp học phần được ghi vào manifest nhưng
không tạo enrollment. Dữ liệu trùng được merge theo MSSV và khóa
`học kỳ + môn học + mã lớp`; không phát hiện xung đột điểm giữa các bản ghi.

## Artifact và cơ chế an toàn

- `backend/db/seed-academic-v2.json.gz`: artifact tự chứa, không dùng numeric ID.
- `backend/db/seed-academic-v2.manifest.json`: checksum và các số đối soát.
- `backend/db/specialization-catalog.json`: catalog review được gồm 26 chuyên ngành và mapping 80 lớp.
- Import mặc định là dry-run; chỉ `--apply` mới ghi PostgreSQL.
- Toàn bộ import chạy trong một transaction và upsert bằng natural key.
- Import không reset database, không dùng `FORCE_SEED`, giữ nguyên ID của 699 sinh viên hiện có.
- Seed runner dùng cùng artifact sau bộ SQL cũ để database mới tái tạo đúng 1.277 sinh viên.

## Lệnh vận hành

Tạo lại artifact và kiểm tra nguồn, không chạm database:

```powershell
python backend/scripts/import_academic_dataset.py
```

Sao lưu trước khi apply:

```powershell
docker compose exec -T db pg_dump -U eduinsight -d eduinsight -Fc -f /tmp/h46-before.dump
docker compose cp db:/tmp/h46-before.dump ./backups/h46-before.dump
```

Import từ artifact đã review:

```powershell
python backend/scripts/import_academic_dataset.py `
  --artifact backend/db/seed-academic-v2.json.gz `
  --apply `
  --expected-students 1277 `
  --database-url postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight
```

Chạy lại cùng lệnh lần hai và xác nhận row count không đổi. Báo cáo aggregate được
ghi ở `docs/07-Sprint-Planning/evidence/H46/`; báo cáo không chứa tên hoặc MSSV.

## Nghiệm thu

- Database có đúng 1.277 `student_code` duy nhất.
- Cả 1.277 sinh viên đều có `specialization_id`.
- Enrollment và grade component khớp manifest.
- Tree API giữ đủ 5 tầng và không cộng trùng metric cấp cha.
- Backend test, frontend TypeScript và health check đều pass.

## Ảnh hưởng tới workspace

- PostgreSQL hiện hữu tăng từ 699 lên 1.277 sinh viên; 699/699 ID cũ giữ nguyên.
- Catalog sửa lại `DEPT09/DEPT10` về đúng Kế toán/QTKD và thêm `DEPT13/DEPT14` cho Năng lượng mới/Xây dựng; vẫn giữ đúng 37 program, không trùng tên.
- Tổng course tăng từ 480 lên 549; enrollment từ 35.916 lên 56.301; grade component từ 96.899 lên 147.286.
- Không đổi public API. Tree API hiện trả 14 khoa, 37 ngành, 26 chuyên ngành thật và root metric 1.277 sinh viên.
- Clean database đã được kiểm thử theo chuỗi `alembic upgrade head -> seed_database.py` và cho cùng row count.
- DWH/ML không được refresh trong H46; đây là đầu vào bàn giao cho task của Hưng.
- `alembic check` còn báo drift JSON type/report index có sẵn từ trước, không liên quan H45/T44/H46.
