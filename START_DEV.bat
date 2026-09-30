@echo off
cd /d "%~dp0"
if not exist .env (
  echo [ERROR] Root .env file is missing.
  echo Run: copy .env.example .env
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing workspace dependencies...
  call npm install || goto :error
)
echo Generating Prisma Client...
call npm run prisma:generate || goto :error
echo Starting Zelvomart...
call npm run dev
exit /b %errorlevel%
:error
echo.
echo Setup failed. Check the error above.
pause
exit /b 1
