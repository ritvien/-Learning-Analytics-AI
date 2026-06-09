# Yêu cầu Sản phẩm Bàn giao (Required Deliverables)

Dưới đây là danh sách kiểm tra (Checklist) những gì cần hoàn thiện trước khi dự án được coi là thành công và sẵn sàng nộp bài (Demo).

## 1. Mã nguồn (Source Code)
- Toàn bộ code Backend (FastAPI) và Frontend (Next.js) nằm trong một repository hoặc hai repositories rõ ràng.
- File `requirements.txt` (Backend) và `package.json` (Frontend) đã được dọn dẹp (chỉ chứa các package cần thiết).
- File `.env.example` chứa toàn bộ các biến cấu hình (nhưng không chứa keys thật).

## 2. Tài liệu Hệ thống (Documentation)
- **README.md:** Chứa giới thiệu dự án, các lệnh Setup, lệnh chạy Docker.
- **Kiến trúc:** Sơ đồ hệ thống (có thể dùng Mermaid hoặc hình ảnh đính kèm).
- **Video Demo:** Một video từ 3-5 phút quay màn hình quá trình tương tác mượt mà với Agent. Video này là "phao cứu sinh" nếu Live Demo gặp sự cố mạng.

## 3. Triển khai (Deployment)
- Ứng dụng đã được Docker hoá thành công.
- Có khả năng chạy mượt mà bằng lệnh `docker-compose up`.
- (Tuỳ chọn nhưng ưu tiên) Hệ thống đã được triển khai lên nền tảng Cloud (Vercel/Render/AWS).

## 4. Kiểm thử
- Cung cấp hình ảnh hoặc log chứng minh hệ thống vượt qua các Unit Test cốt lõi.
- Agent có cơ chế Fallback (Báo lỗi nhẹ nhàng) khi API của LLM bị sập.
