@echo off
title Tentacle TV - Desktop Dev
echo ============================================
echo   Tentacle TV - Desktop Dev Environment
echo ============================================
echo.

:: Kill any leftover processes
taskkill /F /IM tentacle-desktop.exe >nul 2>&1

:: Start Vite dev server in background
echo [1/2] Starting Vite dev server...
cd /d "%~dp0..\apps\web"
start "TentacleTV-Vite" cmd /c "set NODE_OPTIONS=--max-old-space-size=4096 && npx vite --port 5173"

:: Wait for Vite to be ready
echo Waiting for Vite on http://localhost:5173 ...
:wait_vite
timeout /t 1 /nobreak >nul
curl -s -o nul http://localhost:5173 2>nul
if errorlevel 1 goto wait_vite
echo Vite is ready!
echo.

:: Start Tauri dev
echo [2/2] Starting Tauri desktop...
cd /d "%~dp0..\apps\desktop"
npx tauri dev

:: Cleanup: kill Vite when Tauri exits
echo.
echo Shutting down Vite...
taskkill /FI "WINDOWTITLE eq TentacleTV-Vite*" >nul 2>&1
echo Done.
