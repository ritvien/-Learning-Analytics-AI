# Hướng dẫn Chuẩn mực Mã nguồn (Code Style Guide)

Đội nhóm không thể làm việc trơn tru nếu mỗi người viết code theo một phong cách khác nhau.

## 1. Python Code Style
- **Black:** Sử dụng bộ định dạng `Black` với line length = 88.
- **Flake8:** Linter kiểm tra các lỗi logic cơ bản và tính không thống nhất.
- **Isort:** Tự động sắp xếp các câu lệnh `import` theo thứ tự Alphabet và nhóm theo thư viện chuẩn/thư viện ngoài/module local.

### Type Hints (Bắt buộc)
Luôn sử dụng Type Hints. Việc này giúp Pydantic, FastAPI và IDE (VS Code, Cursor) gợi ý code chính xác.
```python
from typing import List, Optional

def fetch_data(user_id: int, tags: Optional[List[str]] = None) -> dict:
    ...
```

## 2. Docstrings và Comment
- Tất cả các Tools cung cấp cho Agent BẮT BUỘC phải có docstring giải thích chi tiết đầu vào và kết quả. LLM dùng nó để hoạt động.
- Tránh comment giải thích "Code này làm gì", hãy comment giải thích "TẠI SAO lại viết code này".

## 3. Quy chuẩn Naming Convention
- Tên biến, tên hàm: `snake_case` (ví dụ: `process_data`).
- Tên Class: `PascalCase` (ví dụ: `AgentState`).
- Hằng số: `UPPER_SNAKE_CASE` (ví dụ: `MAX_RETRIES = 3`).
