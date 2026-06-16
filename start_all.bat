@echo off
echo Starting EduInsight Backend and Frontend...

REM Mở cửa sổ mới chạy Backend
start "EduInsight Backend" cmd /k "cd backend && ..\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000"

REM Mở cửa sổ mới chạy Frontend
start "EduInsight Frontend" cmd /k "cd frontend && npm run dev"

echo Da mo 2 cua so chay ngam! Ban co the tat cua so nay.
exit
