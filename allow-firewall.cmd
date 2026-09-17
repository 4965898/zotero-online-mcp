@echo off
REM Adds a Windows Firewall rule so phones on the same Wi-Fi can reach the MCP server.
REM Needs to run as Administrator. Run this once.
setlocal
cd /d "%~dp0"
echo This will add an inbound firewall rule for TCP port 3000 (Private + Domain networks).
echo.
net session >nul 2>&1
if errorlevel 1 (
  echo [!] Not running as Administrator.
  echo     Right-click this file and choose "Run as administrator".
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="Zotero Online MCP (TCP 3000)" >nul 2>&1
netsh advfirewall firewall add rule name="Zotero Online MCP (TCP 3000)" dir=in action=allow protocol=TCP localport=3000 profile=private,domain
if errorlevel 1 (
  echo [!] Failed to add the rule.
  pause
  exit /b 1
)
echo.
echo Done. Phones on the same Wi-Fi can now reach this PC on port 3000.
echo The rule applies to Private and Domain networks only, so you are not exposed
echo on public networks such as cafes or airports.
echo.
pause
