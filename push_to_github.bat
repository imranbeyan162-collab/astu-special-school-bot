@echo off
title Push ASTU Special School Updates to GitHub
echo ======================================================================
echo Pushing ASTU Special School Bot, Tracker and Admin Portal to GitHub
echo ======================================================================
cd /d "%~dp0"

:: Fix missing /tmp directory for Windows Git
if not exist "C:\tmp" mkdir "C:\tmp" 2>nul
set "TEMP=C:\tmp"
set "TMP=C:\tmp"

:: Clear broken askpass environment variables
set "GIT_ASKPASS="
set "SSH_ASKPASS="

echo [1/3] Staging changes...
git add .

echo [2/3] Committing changes...
git commit -m "Add complaint tracking system for students to view official school replies and hide admin passcode from public button" 2>nul

echo [3/3] Pushing to remote repository...
git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ======================================================================
    echo [SUCCESS] Successfully pushed to GitHub!
    echo.
    echo Now apply updates on Render:
    echo 1. Open https://dashboard.render.com
    echo 2. Click your 'astu-special-school-bot' service
    echo 3. Click 'Manual Deploy' -^> 'Clear build cache ^& deploy'
    echo ======================================================================
) else (
    echo.
    echo ======================================================================
    echo If GitHub asks for login:
    echo - Username: imranbeyan162-collab
    echo - Password: Use a GitHub Personal Access Token (NOT account password)
    echo   Get one at: https://github.com/settings/tokens (classic, check 'repo')
    echo ======================================================================
)

echo.
pause
