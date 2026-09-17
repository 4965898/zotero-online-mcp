@echo off
REM Windows launcher for the stdio MCP server.
REM Reads ZOTERO_API_KEY (and any other settings) from .env next to this file,
REM so MCP clients only need: "command": "<this file>"
REM
REM All diagnostics go to stderr; stdout stays clean for the JSON-RPC stream.
setlocal
cd /d "%~dp0"
if not exist "node_modules" (
  echo {"event":"fatal","message":"Dependencies missing. Run: npm ci"} 1>&2
  exit /b 1
)
if not exist "dist\stdio.js" (
  echo {"event":"fatal","message":"Build missing. Run: npm run build"} 1>&2
  exit /b 1
)
node --env-file-if-exists=.env dist\stdio.js
