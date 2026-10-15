@echo off
cd /d C:\Users\welcome\Downloads\backend\hack
start "FastAPI" /b python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
timeout /t 3 /nobreak >nul
start "Cloudflare" /b cloudflared.exe tunnel --url http://127.0.0.1:8000 --logfile cloudflare.log --no-autoupdate
