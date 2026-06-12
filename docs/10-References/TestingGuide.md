# Hướng dẫn Kiểm thử và Đánh giá (Testing Guide)

Trong AI Agent, code không chỉ bị lỗi cú pháp, mà còn bị lỗi "ảo giác" (Hallucination) từ mô hình ngôn ngữ. Việc kiểm thử được chia làm hai mảng: Software Testing và Agent Evaluation.

## 1. Software Testing (Kiểm thử phần mềm truyền thống)

Chúng ta sử dụng `pytest` cho môi trường Python.

### 1.1 Unit Tests cho Tools
Tools là phần dễ test nhất vì chúng là các hàm Python tĩnh.
```python
from app.tools.calculator import calculate_tax

def test_calculate_tax():
    # Test valid input
    assert calculate_tax(1000) == 100
    # Test error handling inside tool
    assert "Lỗi" in calculate_tax("invalid_input")
```

### 1.2 Integration Tests cho FastAPI
Sử dụng `httpx.AsyncClient` để gọi trực tiếp các Endpoint.
```python
import pytest
from httpx import AsyncClient
from app.main import app

@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

## 2. Agent Evaluation (Đánh giá chất lượng AI)

Đánh giá một hệ thống sinh ngôn ngữ (GenAI) là một bài toán phức tạp do tính chất không xác định (non-deterministic).

### 2.1 Phương pháp LLM-as-a-judge
Sử dụng một mô hình LLM mạnh (như GPT-4o) để chấm điểm câu trả lời của mô hình Agent. Cung cấp cho LLM chấm điểm một Rubric (bảng tiêu chí) rõ ràng:
- Tính hữu ích: 1-5 điểm
- Tính chân thực (không bịa đặt): 1-5 điểm
- Tone giọng điệu: Pass/Fail

### 2.2 LangSmith Tracing
Để debug lý do tại sao Agent lại trả lời sai, chúng ta sử dụng **LangSmith** để log toàn bộ đường đi (Trace) của đồ thị LangGraph.
- Bạn có thể thấy LLM nhận prompt gì.
- Quyết định gọi tool nào.
- Dữ liệu trả về từ tool là gì.

Thiết lập trong `.env`:
```env
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT="https://api.smith.langchain.com"
LANGCHAIN_API_KEY="ls__xxx"
LANGCHAIN_PROJECT="My_Agent_Project"
```

## 3. Database, DWH và ETL Testing

| Nhóm test | Điều cần chứng minh |
|:----------|:--------------------|
| Migration test | Database sạch và database có seed đều upgrade lên `head` thành công |
| Seed idempotency | Chạy seed lần hai không tạo duplicate hoặc sai liên kết cohort |
| ETL idempotency | Chạy ETL lần hai không tăng số dòng ngoài dự kiến |
| Reconciliation | Enrollment count, tổng tín chỉ pass/trượt và fail rate khớp giữa OLTP/DWH |
| Data quality | Không có orphan key, duplicate tại grain fact hoặc điểm ngoài khoảng hợp lệ |

## 4. ML Evaluation

Model dự đoán pass/trượt từng môn phải được chia train/test theo học kỳ để mô phỏng dự đoán tương lai.

Metric bắt buộc:

- Recall và Precision của lớp trượt.
- F1, PR-AUC và confusion matrix.
- Calibration của xác suất pass/trượt.
- Sai số của `expected_passed_credits` và `expected_failed_credits` sau khi tổng hợp.

Test chống leakage phải xác nhận feature không chứa `final_grade`, `is_passed` hoặc dữ liệu được ghi sau `prediction_cutoff`.

## 5. Integration Flow Bắt Buộc

```text
Migration + seed
→ ETL public sang dwh
→ data reconciliation
→ ML batch scoring
→ API prediction từng môn và tổng tín chỉ
→ Agent giải thích prediction
```

Tham khảo [DatabaseModernizationPlan.md](./DatabaseModernizationPlan.md).
