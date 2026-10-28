@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js not found in PATH.
  pause
  exit /b 1
)
echo Starting TRSS-Lite...
node app.js
