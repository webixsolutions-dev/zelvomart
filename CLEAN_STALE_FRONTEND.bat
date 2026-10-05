@echo off
setlocal
cd /d "%~dp0"

echo Cleaning obsolete pre-split frontend server/auth files...

del /f /q "frontend\auth.ts" 2>nul
del /f /q "frontend\lib\admin.ts" 2>nul
del /f /q "frontend\lib\db.ts" 2>nul
del /f /q "frontend\lib\permissions.ts" 2>nul
del /f /q "frontend\lib\sanitize.ts" 2>nul
del /f /q "frontend\lib\storage.ts" 2>nul
del /f /q "frontend\lib\jobs.ts" 2>nul
del /f /q "frontend\lib\meta.ts" 2>nul
del /f /q "frontend\lib\order.ts" 2>nul
del /f /q "frontend\lib\rate-limit.ts" 2>nul

rmdir /s /q "frontend\app\api\auth" 2>nul
rmdir /s /q "frontend\app\api\admin" 2>nul
rmdir /s /q "frontend\app\api\checkout" 2>nul
rmdir /s /q "frontend\app\api\events" 2>nul
rmdir /s /q "frontend\app\api\health" 2>nul
rmdir /s /q "frontend\app\api\orders" 2>nul
rmdir /s /q "frontend\app\api\reviews" 2>nul
rmdir /s /q "frontend\app\feeds\meta.xml" 2>nul

echo.
echo Obsolete files removed.
echo Valid frontend API routes that should remain:
echo   frontend\app\api\admin-proxy
echo   frontend\app\api\admin-session
echo   frontend\app\api\contact
echo   frontend\app\api\revalidate
echo.
echo Run from project root:
echo   npm install
echo   npm run prisma:generate
echo   npm run build
echo.
pause
