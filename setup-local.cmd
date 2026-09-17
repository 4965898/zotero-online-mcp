@echo off
REM One-time setup for local (stdio) use.
REM Copies .env.local.example to .env if no .env exists yet, then tells you what to edit.
setlocal
cd /d "%~dp0"
if not exist ".env" (
  copy /y ".env.local.example" ".env" >nul
  echo Created .env from .env.local.example
) else (
  echo .env already exists - left untouched
)
echo.
echo Next: open .env and paste your ZOTERO_API_KEY.
echo   https://www.zotero.org/settings/keys/new
echo Then run: npm ci ^&^& npm run build
