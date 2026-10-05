@echo off
setlocal
cd /d "%~dp0"

echo [1/4] Installing dependencies...
call npm install
if errorlevel 1 goto :fail

echo [2/4] Generating Prisma client...
call npm run prisma:generate
if errorlevel 1 goto :fail

echo [3/4] Building backend...
call npm run build:backend
if errorlevel 1 goto :fail

echo [4/4] Building frontend...
call npm run build:frontend
if errorlevel 1 goto :fail

echo.
echo ==============================
echo ZELVOMART BUILD PASSED
echo ==============================
pause
exit /b 0

:fail
echo.
echo ==============================
echo BUILD FAILED - see error above
echo ==============================
pause
exit /b 1
