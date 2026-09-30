@echo off
title ASTU Special School AI Assistant & Admin Portal
echo ======================================================================
echo Starting ASTU Special School AI Assistant and Admin Portal...
echo ======================================================================
cd /d "%~dp0"
start "" /b python app.py
echo.
echo Server is running!
echo - Student Chatbot:  http://localhost:5000
echo - Admin Portal:     http://localhost:5000/admin
echo - Admin Passcode:   astu ss2026
echo ======================================================================
pause
