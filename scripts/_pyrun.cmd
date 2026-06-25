@echo off
where python >nul 2>&1 && python %* && exit /b %ERRORLEVEL%
where py >nul 2>&1 && py -3 %* && exit /b %ERRORLEVEL%
echo [pyrun] No Python found on PATH >&2
exit /b 1
