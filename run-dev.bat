@echo off
REM Run API dev server and Vite dev server in separate windows
cd /d %~dp0
echo Starting Dev API server (port 3002)...
start "API Server" cmd /k "cd /d %~dp0 && node api/dev-server.mjs"

REM Wait for API to start listening on port 3002 (max 20s)
set MAX_WAIT=20
set /a i=0
:waitloop
timeout /t 1 >nul
netstat -aon | findstr 3002 >nul
if %errorlevel%==0 (
	echo API server detected listening on port 3002.
	goto startvite
)
set /a i+=1
if %i% GEQ %MAX_WAIT% (
	echo Timeout waiting for API server. Starting Vite anyway.
	goto startvite
)
goto waitloop

:startvite
echo Starting Vite dev server (frontend)...
start "Vite Dev" cmd /k "cd /d %~dp0 && npm run dev"
echo All dev servers started. Open http://localhost:5173 in your browser.
exit /b 0
