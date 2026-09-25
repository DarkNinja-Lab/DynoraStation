@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (
  echo.
  echo Installation fehlgeschlagen. Details stehen oben.
  pause
  exit /b 1
)
echo.
pause