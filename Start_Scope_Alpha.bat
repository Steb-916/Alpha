@echo off
title Scope Alpha - Starting...
echo.
echo  ========================================
echo   SCOPE ALPHA - Crypto Derivatives Terminal
echo  ========================================
echo.
echo  Starting dev server...
echo  Once you see "Ready", open your browser to:
echo.
echo     http://localhost:3000
echo.
echo  Press Ctrl+C to stop the server.
echo  ========================================
echo.

cd /d "E:\Telegram Desktop\Alpha\scope-alpha\frontend"
"E:\Telegram Desktop\Alpha\nodejs\node.exe" node_modules\next\dist\bin\next dev

pause
