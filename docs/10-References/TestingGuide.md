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
