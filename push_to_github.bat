@echo off
title Push ASTU Special School Updates to GitHub
echo ======================================================================
echo Pushing ASTU Special School Bot and Admin Portal to GitHub
echo ======================================================================
cd /d "%~dp0"

echo [1/3] Staging changes...
git add .

echo [2/3] Committing changes...
git commit -m "Add student complaint system and passcode-protected admin portal"

echo [3/3] Pushing to remote repository...
git push origin main

echo.
echo ======================================================================
echo Successfully pushed to GitHub!
echo.
echo To apply updates to your live site:
echo 1. Open your Render dashboard at https://dashboard.render.com
echo 2. Click your 'astu-special-school-bot' web service
echo 3. Click 'Manual Deploy' -> 'Clear build cache & deploy'
echo ======================================================================
echo.
pause
