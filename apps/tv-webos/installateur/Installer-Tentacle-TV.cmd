@echo off
rem Lanceur Windows. `chcp 65001` bascule la console en UTF-8 : sans lui, la page
rem de code héritée remplace chaque accent du script par un caractère de
rem remplacement, et les instructions deviennent illisibles.
chcp 65001 >nul 2>nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   Node.js est necessaire, et n'est pas installe sur cet ordinateur.
  echo.
  echo   Installez la version "LTS" depuis https://nodejs.org, puis relancez
  echo   ce script. Rien d'autre n'est requis.
  echo.
  pause
  exit /b 1
)

node installer.mjs
set issue=%errorlevel%

echo.
pause
exit /b %issue%
