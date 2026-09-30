@echo off
cd /d "%~dp0"
if not exist .env (
  echo [ERROR] Root .env file is missing.
  echo Run: copy .env.example .env
  pause
  exit /b 1
)
if not exist node_modules (
  call npm install || goto :error
)
call npm run prisma:generate || goto :error
call npm run db:push || goto :error
call npm run seed || goto :error
echo.
echo Database setup completed successfully.
pause
exit /b 0
:error
echo.
echo Database setup failed. Check the error above.
pause
exit /b 1
