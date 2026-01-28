@echo off
setlocal EnableDelayedExpansion

:: Setup ANSI escape codes
for /F %%a in ('"prompt $E$S & echo on & for %%b in (1) do rem"') do set "ESC=%%a"

:: Colors
set "R=%ESC%[0m"
set "GREEN=%ESC%[92m"
set "RED=%ESC%[91m"
set "CYAN=%ESC%[96m"
set "YELLOW=%ESC%[93m"
set "DIM=%ESC%[90m"
set "BOLD=%ESC%[1m"

set "AME_DIR=%LOCALAPPDATA%\ame"
set "PENGU_DIR=%AME_DIR%\pengu"

:: Header
echo.
echo   %CYAN%======================================%R%
echo   %CYAN%  %BOLD%ame uninstaller%R%
echo   %CYAN%======================================%R%
echo.

:: Confirm
echo   %YELLOW%This will remove ame and all its data.%R%
echo.
set /p "CONFIRM=  Are you sure? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo.
    echo   %DIM%Uninstall cancelled.%R%
    echo.
    pause
    exit /b 0
)

echo.

:: Kill running processes
echo   %DIM%Stopping processes...%R%
taskkill /F /IM "ame.exe" >nul 2>&1
taskkill /F /IM "ame-server.exe" >nul 2>&1
taskkill /F /IM "mod-tools.exe" >nul 2>&1
taskkill /F /IM "Pengu Loader.exe" >nul 2>&1

:: Deactivate Pengu Loader (remove IFEO registry key)
echo   %DIM%Deactivating Pengu Loader...%R%
reg delete "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe" /f >nul 2>&1
if %errorlevel%==0 (
    echo   %GREEN%[OK]%R% Pengu Loader deactivated
) else (
    echo   %DIM%[--]%R% Pengu Loader was not activated or requires admin rights
)

:: Remove ame directory
echo   %DIM%Removing ame files...%R%
if exist "%AME_DIR%" (
    rmdir /s /q "%AME_DIR%" >nul 2>&1
    if exist "%AME_DIR%" (
        echo   %RED%[ERR]%R% Could not fully remove %AME_DIR%
        echo         %DIM%Some files may be in use. Try closing League client first.%R%
    ) else (
        echo   %GREEN%[OK]%R% Removed %AME_DIR%
    )
) else (
    echo   %DIM%[--]%R% ame directory not found
)

:: Footer
echo.
echo   %DIM%--------------------------------------%R%
echo   %GREEN%Uninstall complete!%R%
echo.
echo   %DIM%Note: This uninstaller can be deleted manually.%R%
echo.
pause
