@echo off
title TaskSync Persistent Service
echo ==============================================
echo   TaskSync 任務追蹤系統 - 開機自動啟動中...
echo ==============================================
echo.
echo [1/2] 正在定位專案目錄...
cd /d "%~dp0"
echo 目前路徑: %CD%
echo.
echo [2/2] 正在啟動 SQLite 後端與 Vite 前端服務...
npm run dev:full
pause
