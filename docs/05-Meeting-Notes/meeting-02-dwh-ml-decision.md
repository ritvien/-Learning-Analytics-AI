# Meeting Notes 02 - Quyết định DWH và ML

**Ngày quyết định:** 12/06/2026  
**Phạm vi:** Database, Data Warehouse, Machine Learning và quy trình phối hợp team

## Quyết định

1. ML dự đoán xác suất pass/trượt từng môn.
2. Tổng tín chỉ pass/trượt kỳ vọng được tổng hợp từ xác suất từng môn và số tín chỉ.
3. PostgreSQL được tách schema `public`, `dwh` và `ml`.
4. SQLAlchemy ORM trong `backend/app/models/` là nguồn định nghĩa database chính.
5. Mọi thay đổi database phải có Alembic migration.
6. Team reset database local đúng một lần sau baseline migration; các lần pull sau chỉ chạy migration.
7. Agent đọc và giải thích dữ liệu DWH/ML, không tự train model hoặc sinh probability.

## Thứ tự triển khai

```text
Chốt ORM
→ Alembic baseline
→ Reset local một lần
→ DWH + ETL
→ ML prediction
→ UI/Agent integration
```

## Action Items

- Hưng: đồng bộ ORM, migration baseline, seed/import, DWH và ETL.
- Hoàng: feature engineering, model pass/trượt, tổng hợp tín chỉ và evaluation.
- Hiếu: prediction UI từng môn và tổng tín chỉ.
- Cả team: xác minh migration revision và row counts sau reset.

Chi tiết kế hoạch: [DatabaseModernizationPlan.md](../10-References/DatabaseModernizationPlan.md).
