@echo off
title Epidemiology — Public Live URL Launcher (Cloudflare)
echo =====================================================================
echo  Epidemiology — Municipal Disease Surveillance Platform
echo  Launching Persistent Cloudflare Public HTTPS Tunnel
echo =====================================================================
echo.

cd /d %~dp0

:: Check if backend is already listening on port 8000
netstat -ano | findstr ":8000" >nul
if %errorlevel% neq 0 (
    echo [1/2] Starting FastAPI Backend on http://127.0.0.1:8000 ...
    start "Epidemiology Backend (FastAPI)" cmd /k "cd /d %~dp0 && python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
    timeout /t 3 /nobreak >nul
) else (
    echo [1/2] FastAPI Backend is already active on port 8000.
)

echo.
echo [2/2] Launching Cloudflare Tunnel on http://127.0.0.1:8000 ...
echo Look for the line below starting with:
echo    https://......trycloudflare.com
echo That is your permanent public link for the entire platform!
echo.
echo =====================================================================
echo.

cloudflared.exe tunnel --url http://127.0.0.1:8000
pause
