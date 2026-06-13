@echo off
echo ========================================================
echo 🚀 Khởi động EduInsight bằng Docker Compose
echo ========================================================

echo.
echo 1. Build va khoi dong cac container (PostgreSQL + FastAPI)...
docker-compose up -d --build

echo.
echo 2. Kiem tra trang thai container...
docker-compose ps

echo.
echo 3. Dang hien thi logs cua Backend (An Ctrl+C de thoat log, he thong van chay ngam)...
echo ========================================================
docker-compose logs -f backend
