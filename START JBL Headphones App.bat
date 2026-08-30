@echo off
setlocal
title JBL Headphones App
cd /d "%~dp0"

where py >nul 2>&1
if not errorlevel 1 (
  start "" http://localhost:8777/select.html
  py -3 tools\serve.py 8777
  exit /b %errorlevel%
)

where python >nul 2>&1
if not errorlevel 1 (
  start "" http://localhost:8777/select.html
  python tools\serve.py 8777
  exit /b %errorlevel%
)

echo Python 3 is required to run the local Web Bluetooth server.
echo Install Python 3 from https://www.python.org/downloads/windows/
echo During installation, enable "Add Python to PATH", then run this file again.
pause
exit /b 1
