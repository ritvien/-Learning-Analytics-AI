@echo off
echo ========================================================
echo 🛑 Tat va xoa cac container EduInsight
echo ========================================================

echo.
echo 1. Dung cac container dang chay...
docker-compose stop

echo.
echo 2. Xoa cac container va mang (khong xoa data database)...
docker-compose down

echo.
echo ========================================================
echo ✅ He thong da dung hoan toan.
echo (Luu y: Du lieu database van duoc giu lai trong volume)
echo ========================================================
pause
