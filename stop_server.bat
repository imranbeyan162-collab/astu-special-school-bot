@echo off
echo Stopping ASTU Special School AI Assistant...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5000') do taskkill /f /pid %%a 2>nul
echo Server stopped.
pause
