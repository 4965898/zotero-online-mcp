@echo off
REM Starts the HTTP server for phones and other URL-only clients.
REM Reads .env, prints the addresses clients should use, then serves until Ctrl+C.
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo [x] Dependencies missing. Run: npm ci
  pause
  exit /b 1
)
if not exist "dist\main.js" (
  echo [x] Build missing. Run: npm run build
  pause
  exit /b 1
)
if not exist ".env" (
  echo [x] .env missing. Run: setup-local.cmd first.
  pause
  exit /b 1
)

for /f "usebackq tokens=2 delims==" %%A in (`findstr /b /c:"ZOTERO_API_KEY=" .env`) do set ZKEY=%%A
if "%ZKEY%"=="" (
  echo [x] ZOTERO_API_KEY is empty in .env
  echo     Create one at https://www.zotero.org/settings/keys/new
  pause
  exit /b 1
)

echo Starting Zotero Online MCP (HTTP mode)...
echo.
node scripts\show-address.mjs
echo.
echo Serving now. Press Ctrl+C to stop.
echo.
node --env-file-if-exists=.env dist\main.js
