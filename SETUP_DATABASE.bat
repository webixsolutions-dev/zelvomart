@echo off
cd /d "%~dp0"
if not exist backend\.env (
  echo [ERROR] backend\.env missing. Copy backend\.env.example to backend\.env
  pause
  exit /b 1
)
if not exist node_modules call npm install
call npm run prisma:generate || goto :error
call npm run db:push || goto :error
call npm run seed || goto :error
echo Database setup completed.
pause
exit /b 0
:error
echo Database setup failed.
pause
exit /b 1
