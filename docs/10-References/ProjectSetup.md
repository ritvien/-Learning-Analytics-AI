# Hướng dẫn Khởi tạo Dự án (Project Setup)

Chào mừng bạn đến với hướng dẫn khởi tạo dự án AI Agent. Việc thiết lập một môi trường nhất quán ngay từ ngày đầu là vô cùng quan trọng để đảm bảo tất cả các lập trình viên trong đội đều có trải nghiệm phát triển giống nhau, ngăn chặn lỗi "trên máy tôi thì chạy được" (It works on my machine).

## 1. Yêu cầu Hệ thống (Prerequisites)
Trước khi bắt đầu, hãy đảm bảo máy tính của bạn đã cài đặt các công cụ sau:
- **Python 3.10+**: Bắt buộc để tương thích tốt nhất với LangGraph và FastAPI.
- **Git**: Để quản lý mã nguồn.
- **Docker & Docker Compose**: Dành cho việc khởi chạy database và môi trường cô lập.
- **Node.js 18+ & npm/yarn**: Nếu bạn tham gia phát triển giao diện Next.js.

## 2. Clone Repository
Hãy bắt đầu bằng việc clone mã nguồn từ kho lưu trữ chính:

```bash
git clone https://github.com/your-org/ai-agent-project.git
cd ai-agent-project
```

## 3. Thiết lập Môi trường Backend (FastAPI & LangGraph)

Chúng tôi sử dụng môi trường ảo (Virtual Environment) để cô lập các gói phụ thuộc (dependencies). Không bao giờ cài đặt thư viện trực tiếp vào hệ điều hành.

### Tạo và Kích hoạt Môi trường:
```bash
# Tạo môi trường ảo
python -m venv venv

# Kích hoạt trên Mac/Linux
source venv/bin/activate

# Kích hoạt trên Windows (Command Prompt)
venv\Scripts\activate
```

### Cài đặt Dependencies:
```bash
pip install --upgrade pip
pip install -r backend/requirements.txt
```

## 4. Quản lý Biến Môi Trường (.env)
Dự án yêu cầu các biến môi trường để cấu hình API Keys, Database URL.
1. Copy file template:
   ```bash
   cp .env.example .env
   ```
2. Mở file `.env` và điền các giá trị thực tế:
   ```env
   # LLM Provider
   OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxx
   ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxx
   
   # Database
   DATABASE_URL=sqlite:///./ai_agent.db
   
   # Agent Settings
   AGENT_MODEL=gpt-4o
   ```
   **CẢNH BÁO BẢO MẬT:** Tuyệt đối không commit file `.env` lên GitHub.

## 5. Khởi chạy Ứng dụng Cục bộ (Local Development)

Dự án cung cấp `Makefile` để tự động hoá các lệnh:

```bash
# Khởi chạy Backend (FastAPI)
make run-backend

# Hoặc khởi chạy thủ công
cd backend
uvicorn app.main:app --reload --port 8000
```
Truy cập tài liệu API tự động tại: [http://localhost:8000/docs](http://localhost:8000/docs)

## 6. Thiết lập Git Workflow và Pre-commit Hooks
Để duy trì chất lượng code, chúng ta sử dụng `pre-commit`:
```bash
pip install pre-commit
pre-commit install
```
Mỗi khi bạn tạo commit, hệ thống sẽ tự động format code (Black) và kiểm tra lỗi (Flake8).

---
**Bước tiếp theo:** Hãy chuyển sang tài liệu `SystemArchitecture.md` để hiểu cách các thành phần trong hệ thống tương tác với nhau.
