@echo off
rem Lanceur Windows. `chcp 65001` bascule la console en UTF-8 : sans lui, la page
rem de code héritée remplace chaque accent du script par un caractère de
rem remplacement, et les instructions deviennent illisibles.
rem
rem Si Node.js manque, une copie PORTABLE est installée dans
rem %LOCALAPPDATA%\tentacle-tv\node (aucun droit administrateur), depuis
rem nodejs.org, empreinte SHA-256 vérifiée. Elle sert aux exécutions suivantes.
chcp 65001 >nul 2>nul
cd /d "%~dp0"
set "NODE_HOME=%LOCALAPPDATA%\tentacle-tv\node"

where node >nul 2>nul
if not errorlevel 1 goto run

if exist "%NODE_HOME%\node.exe" goto portable

echo.
echo   Node.js est absent : installation d'une copie portable (une seule fois)...
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop'; [Net.ServicePointManager]::SecurityProtocol='Tls12'; $ProgressPreference='SilentlyContinue';" ^
  "$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' };" ^
  "$base = 'https://nodejs.org/dist/latest-v22.x';" ^
  "$sums = (Invoke-WebRequest \"$base/SHASUMS256.txt\" -UseBasicParsing).Content -split \"`n\";" ^
  "$line = $sums | Where-Object { $_ -match \"win-$arch\.zip$\" } | Select-Object -First 1;" ^
  "$expected, $file = $line -split '\s+';" ^
  "$tmp = Join-Path $env:TEMP $file; Invoke-WebRequest \"$base/$file\" -OutFile $tmp -UseBasicParsing;" ^
  "if ((Get-FileHash $tmp -Algorithm SHA256).Hash -ne $expected.ToUpper()) { throw 'Empreinte SHA-256 inattendue' };" ^
  "$dest = Join-Path $env:TEMP 'tentacle-node'; Remove-Item $dest -Recurse -Force -EA 0; Expand-Archive $tmp $dest -Force;" ^
  "Remove-Item $env:NODE_HOME -Recurse -Force -EA 0; New-Item -ItemType Directory -Force (Split-Path $env:NODE_HOME) | Out-Null;" ^
  "Move-Item (Get-ChildItem $dest -Directory | Select-Object -First 1).FullName $env:NODE_HOME"
if errorlevel 1 (
  echo.
  echo   Node.js n'a pas pu etre installe automatiquement.
  echo   Installez la version "LTS" depuis https://nodejs.org, puis relancez.
  echo.
  pause
  exit /b 1
)
echo   OK - Node.js portable installe dans %NODE_HOME%

:portable
rem npm, livré avec la copie portable, doit être trouvé par l'installateur.
set "PATH=%NODE_HOME%;%PATH%"

:run
node installer.mjs
set issue=%errorlevel%

echo.
pause
exit /b %issue%
