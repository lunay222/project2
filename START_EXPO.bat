@echo off
echo ========================================
echo Starting Expo Development Server
echo ========================================
echo.
echo This window will show the QR code and connection URL
echo Keep this window open while using the app
echo.
echo ========================================
echo.

cd /d "%~dp0mobile-app"
call npm start

pause

