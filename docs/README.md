# EduInsight Documentation Index

Trang này giúp team biết tài liệu nào là nguồn chuẩn hiện tại, tài liệu nào chỉ mang tính lịch sử/tham khảo và DWH/ML được mô tả ở đâu.

## Nguồn chuẩn hiện tại

| Chủ đề | Tài liệu |
|:-------|:---------|
| Product scope và module | [PRD.md](./02-PRD/PRD.md) |
| Bài toán ML và kiến trúc DWH | [ML_DWH_Architecture.md](./10-References/ML_DWH_Architecture.md) |
| Kế hoạch sửa DB và rollout team | [DatabaseModernizationPlan.md](./10-References/DatabaseModernizationPlan.md) |
| Review Backend Sprint 1 | [BackendSprint1Review.md](./10-References/BackendSprint1Review.md) |
| Review Backend Sprint 2 | [BackendSprint2Review.md](./10-References/BackendSprint2Review.md) |
| Backend progress (Hưng) | [Hung/README.md](./09-Materials/Hung/README.md) |
| Kiến trúc tổng thể | [SystemArchitecture.md](./10-References/SystemArchitecture.md) |
| Setup, pull, reset và migration | [ProjectSetup.md](./10-References/ProjectSetup.md) |
| Kế hoạch thực thi hiện tại | [Sprint3.md](./07-Sprint-Planning/Sprint3.md) |
| Contract Academic Tree 3-tier | [H45-Plan.md](./07-Sprint-Planning/H45-Plan.md) |
| User Behavior Observability | [README.md](./19-User-Behavior-Observability/README.md) |
| RAG Corpus Preparation TODO | [README.md](./20-RAG-Corpus-Preparation/README.md) |

Khi có mâu thuẫn giữa tài liệu, ưu tiên theo thứ tự:

```text
DatabaseModernizationPlan / ML_DWH_Architecture
→ PRD
→ SystemArchitecture
→ Sprint hiện tại
→ tài liệu tham khảo hoặc lịch sử
```

## Quyết định DWH/ML đã chốt

- Dự đoán xác suất pass/trượt từng môn.
- Tổng hợp expected passed/failed credits theo sinh viên-học kỳ.
- PostgreSQL tách schema `public`, `dwh`, `ml`.
- DWH là nguồn cho analytics lịch sử.
- Schema `ml` lưu model run và prediction.
- Agent chỉ giải thích dữ liệu DWH/ML, không tự tạo probability.
- Database thay đổi bằng Alembic; reset local đúng một lần sau baseline.

## Phân loại tài liệu

### Phải đồng bộ với DWH/ML

- Brief, PRD, User Stories.
- System Architecture, Data Flow, Agent Flow.
- Project Setup, Testing Guide, DevOps Guide.
- Sprint Planning, Sprint hiện tại, Required Deliverables.

### Tài liệu lịch sử, không sửa lại nội dung quá khứ

- `05-Meeting-Notes/meeting-01.md`.
- `07-Sprint-Planning/Sprint1.md`.
- Journal/worklog bên ngoài thư mục docs.

Quyết định thay đổi hướng được ghi ở [meeting-02-dwh-ml-decision.md](./05-Meeting-Notes/meeting-02-dwh-ml-decision.md).

### Artifact tham khảo hoặc cần làm lại

- Wireframe PNG và slide PDF hiện là placeholder rỗng; xem README trong từng thư mục để làm lại theo DWH/ML.
- Survey scripts và interview form đã bổ sung câu hỏi xác thực dữ liệu/prediction.
- UI research/materials.
- Code style, common patterns, BMAD và các tài liệu hướng dẫn chung.

Các artifact này chỉ cần cập nhật khi thiết kế UI, khảo sát hoặc nội dung trình bày được làm lại.

## Checklist khi sửa tài liệu

- Không mô tả Agent là nguồn tạo prediction.
- Không dùng bảng CRUD trực tiếp làm DWH.
- Prediction từng môn nằm trong schema `ml`, không nằm trong DWH.
- DWH chứa facts/dimensions lịch sử và feature.
- API/diagram/sprint phải dùng cùng tên bảng và endpoint.
- Link nội bộ dùng relative path, không dùng `file:///`.
