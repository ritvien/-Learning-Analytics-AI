# 🐳 Hướng dẫn chạy và kiểm thử EduInsight bằng Docker

Tài liệu này hướng dẫn toàn bộ team cách khởi chạy, tương tác và kiểm thử hệ thống sử dụng Docker Compose. 

Tất cả các dịch vụ (PostgreSQL DB, FastAPI Backend) đã được thiết lập sẵn trong file `docker-compose.yml`. Team **không cần** cài đặt Python hay PostgreSQL trực tiếp trên máy cá nhân để chạy backend.

---

## 1. Các Scripts hỗ trợ (Dành cho Windows)

Để tiết kiệm thời gian gõ lệnh, trong thư mục `scripts/` đã có sẵn các file `.bat` tiện ích. Bạn chỉ cần click đúp để chạy:

- `scripts/docker_start.bat` — Build và khởi động toàn bộ hệ thống. Tự động hiển thị log của Backend.
- `scripts/docker_stop.bat` — Tắt và xóa các container một cách an toàn (dữ liệu database không bị mất).
- `scripts/docker_test.bat` — Chạy bộ Unit Tests (Pytest) trực tiếp bên trong container Backend.

---

## 2. Các lệnh Docker thủ công (Nếu bạn dùng Terminal)

### Khởi động hệ thống
```bash
# Build lại image (nếu có cập nhật code/dependencies) và chạy ngầm
docker-compose up -d --build
```

### Xem trạng thái và Logs
```bash
# Xem các container đang chạy
docker-compose ps

# Xem log liên tục của Backend (ấn Ctrl+C để thoát)
docker-compose logs -f backend

# Xem log của Database
docker-compose logs -f db
```

### Chạy Kiểm thử (Testing)
Để đảm bảo môi trường test đồng nhất, chúng ta chạy test *bên trong* container:
```bash
# Chạy toàn bộ test
docker-compose exec backend pytest tests/

# Chạy test với thông tin chi tiết
docker-compose exec backend pytest tests/ -v

# Chạy một file test cụ thể
docker-compose exec backend pytest tests/test_agent.py
```

### Tắt hệ thống
```bash
# Tắt và xóa container (giữ lại data)
docker-compose down

# Tắt và XÓA LUÔN dữ liệu Database (Cẩn thận!)
docker-compose down -v
```

---

## 3. Kiến trúc Cổng (Ports Mapping)

Khi hệ thống đang chạy, bạn có thể truy cập các dịch vụ qua các cổng sau trên `localhost`:

| Service | Port (Host) | Port (Container) | URL Truy cập |
|---------|------------|-----------------|--------------|
| **FastAPI Backend** | `8000` | `8000` | [http://localhost:8000/docs](http://localhost:8000/docs) (Swagger UI) |
| **PostgreSQL DB** | `5433` | `5432` | Kết nối qua DBeaver/DataGrip: `localhost:5433` |

*(Lưu ý: PostgreSQL được map ra cổng `5433` trên máy chủ của bạn để tránh xung đột nếu máy bạn đã cài sẵn Postgres ở cổng `5432` mặc định).*

---

## 4. Chạy Streamlit UI (Frontend tạm thời)

Hiện tại, Streamlit app chưa được đưa vào Docker (sẽ được thêm ở Phase 2). Do đó, bạn cần chạy nó ở máy tính local (máy ngoài Docker):

**Bước 1:** Đảm bảo đã khởi động Docker (Backend + DB đang chạy).

**Bước 2:** Cài đặt thư viện trên máy tính nếu chưa có (chỉ cần chạy 1 lần):
```bash
# Khuyên dùng ảo hóa (Virtual Environment)
pip install -r requirements.txt
pip install streamlit
```

**Bước 3:** Chạy Streamlit:
```bash
streamlit run streamlit_app.py
```
App sẽ mở tại [http://localhost:8501](http://localhost:8501). Mọi yêu cầu gọi từ Streamlit sẽ được truyền xuống Backend/DB đang chạy trong Docker.
