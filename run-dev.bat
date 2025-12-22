@echo off
REM Run API dev server and Vite dev server in separate windows
cd /d %~dp0
echo Starting Dev API server (port 3002)...
start "API Server" cmd /k "node api/dev-server.mjs"
timeout /t 1 /nobreak >nul
echo Starting Vite dev server (frontend)...
start "Vite Dev" cmd /k "npm run dev"
echo All dev servers started. Open http://localhost:5173 in your browser.
exit /b 0
