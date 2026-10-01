@echo off
cd /d "%~dp0"
net session >nul 2>&1
if %errorLevel% == 0 (
    goto :run
) else (
    echo Requesting administrative privileges...
    powershell -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
    exit /b
)

:run
echo Starting Print Relay Server...
powershell -ExecutionPolicy Bypass -File "print_server.ps1"
pause
