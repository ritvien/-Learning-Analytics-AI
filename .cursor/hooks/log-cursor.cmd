@echo off
setlocal
if defined CURSOR_PROJECT_DIR (
  cd /d "%CURSOR_PROJECT_DIR%"
) else (
  cd /d "%~dp0..\.."
)
set "TOOL=cursor"
if not "%~1"=="" set "TOOL=%~1"
python "%CD%\scripts\log_hook.py" --tool=%TOOL%
