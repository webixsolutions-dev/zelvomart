@echo off
cd /d "%~dp0"
if not exist frontend\.env.local (
  echo [ERROR] frontend\.env.local missing. Copy frontend\.env.example to frontend\.env.local
  pause
  exit /b 1
)
if not exist backend\.env (
  echo [ERROR] backend\.env missing. Copy backend\.env.example to backend\.env
  pause
  exit /b 1
)
if not exist node_modules call npm install
call npm run dev
