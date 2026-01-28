@echo off
setlocal EnableDelayedExpansion

:: Setup ANSI escape codes
for /F %%a in ('"prompt $E$S & echo on & for %%b in (1) do rem"') do set "ESC=%%a"

:: Colors
set "R=%ESC%[0m"
set "GREEN=%ESC%[92m"
set "CYAN=%ESC%[96m"
set "DIM=%ESC%[90m"
set "BOLD=%ESC%[1m"

:: Header
echo.
echo   %CYAN%======================================%R%
echo   %CYAN%  %BOLD%ame%R%  %DIM%skin changer%R%
echo   %CYAN%======================================%R%
echo.
echo   %DIM%Starting server...%R%
echo   %DIM%Open League client to see the skin selector.%R%
echo   %DIM%Press Ctrl+C to stop.%R%
echo.
echo   %DIM%--------------------------------------%R%
echo.

:: Start WebSocket server
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0server.ps1"

echo.
echo   %DIM%--------------------------------------%R%
echo   %DIM%Cleaning up...%R%
taskkill /F /IM "mod-tools.exe" >nul 2>&1
echo   %GREEN%Server stopped.%R%
echo.
pause
