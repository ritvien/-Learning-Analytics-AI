# Hướng dẫn DevOps và Triển khai (DevOps & Deployment)

Một dự án AI chuyên nghiệp không thể chỉ dừng lại ở localhost. Quá trình tự động hoá kiểm thử (CI), tự động hoá triển khai (CD), và container hoá (Docker) là nền tảng để vận hành hệ thống trơn tru.

## 1. Container hoá với Docker

Chúng ta sử dụng Docker để đóng gói ứng dụng. Để tối ưu hoá, chúng ta sử dụng **Multi-stage Dockerfile**.

### Multi-stage Dockerfile cho FastAPI (Backend)
```dockerfile
# Stage 1: Build
FROM python:3.10-slim as builder
WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

# Stage 2: Runtime
FROM python:3.10-slim
WORKDIR /app
COPY --from=builder /app/wheels /wheels
COPY --from=builder /app/requirements.txt .
RUN pip install --no-cache /wheels/*
COPY ./app /app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```
Mô hình này giúp giảm kích thước Image đáng kể, giảm thiểu chi phí lưu trữ và tăng tốc độ kéo (pull) image.

## 2. Quản lý Môi trường bằng Docker Compose

Để chạy trọn bộ (Backend + Frontend + DB) trên Local hoặc môi trường Staging:
```yaml
version: '3.8'
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    env_file: .env
  
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    depends_on:
      - backend
```
Lệnh khởi chạy: `docker-compose up -d --build`

## 3. Tích hợp liên tục (CI) với GitHub Actions

Chúng ta cấu hình GitHub Actions để chặn các đoạn code lỗi trước khi chúng được merge vào `main`.

File `.github/workflows/ci.yml`:
```yaml
name: CI Pipeline
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.10'
      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r backend/requirements.txt pytest flake8
      - name: Run Linter
        run: flake8 backend/
      - name: Run Tests
        run: pytest backend/tests/
```

## 4. Health Checks và Monitoring
Tất cả các dịch vụ đều phải có endpoint `/health`. Kubernetes hoặc Docker Swarm sẽ ping endpoint này mỗi 10 giây.
```python
@app.get("/health")
async def health_check():
    # Thêm logic kiểm tra kết nối Database tại đây
    return {"status": "ok", "db": "connected", "llm": "available"}
```
