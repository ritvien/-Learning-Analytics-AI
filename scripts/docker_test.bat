@echo off
echo ========================================================
echo 🧪 Chay kiem thu (Unit Tests) ben trong Docker
echo ========================================================

echo.
echo 1. Dang kiem tra xem Backend container co dang chay khong...
docker-compose ps | findstr backend > nul
if errorlevel 1 (
    echo 🔴 Backend container chua chay! Vui long chay docker_start.bat truoc.
    pause
    exit /b
)

echo.
echo 2. Thuc thi Pytest ben trong container...
docker-compose exec backend pytest tests/ -v

echo.
echo ========================================================
echo ✅ Hoan tat kiem thu.
echo ========================================================
pause
