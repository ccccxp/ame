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

set "CHECK=%GREEN%OK%R%"
set "AME_DIR=%LOCALAPPDATA%\ame"
set "PENGU_DIR=%AME_DIR%\pengu"

:: Header
echo.
echo   %CYAN%======================================%R%
echo   %CYAN%  %BOLD%ame uninstaller%R%
echo   %CYAN%======================================%R%
echo.

:: Confirm
echo   %YELLOW%This will remove ame and all its components.%R%
echo.
set /p "CONFIRM=   Continue? (y/n): "
if /i not "%CONFIRM%"=="y" (
    echo.
    echo   %DIM%Cancelled.%R%
    echo.
    pause
    exit /b
)
echo.

:: Stop processes
echo   %DIM%Stopping processes...%R%
taskkill /F /IM "mod-tools.exe" >nul 2>&1
taskkill /F /IM "Pengu Loader.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
echo         [%CHECK%] Processes stopped

:: Deactivate Pengu (open it so user can deactivate)
reg query "HKLM\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\LeagueClientUx.exe" /v Debugger >nul 2>&1
if %errorlevel%==0 (
    echo.
    echo   %DIM%Deactivating Pengu Loader...%R%
    echo         %YELLOW%Please click "Activate" to turn it OFF,%R%
    echo         %YELLOW%then close the window.%R%
    echo.
    if exist "%PENGU_DIR%\Pengu Loader.exe" (
        start "" /wait "%PENGU_DIR%\Pengu Loader.exe"
        echo         [%CHECK%] Pengu Loader deactivated
    )
)

:: Remove files
echo.
echo   %DIM%Removing files...%R%
if exist "%AME_DIR%" (
    rmdir /s /q "%AME_DIR%"
    echo         [%CHECK%] Files removed
) else (
    echo         %DIM%Nothing to remove%R%
)

:: Footer
echo.
echo   %DIM%--------------------------------------%R%
echo   %GREEN%Uninstall complete.%R%
echo.
pause
