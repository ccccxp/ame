@echo off
setlocal EnableDelayedExpansion

:: Keep window open on error
if "%~1"=="" (
    cmd /k "%~f0" run
    exit /b
)


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

:: Uninstall Pengu Loader (requires admin rights)
echo   %DIM%Uninstalling Pengu Loader...%R%
echo   %DIM%A new window will open requesting admin rights.%R%
echo.

:: Create temp PowerShell script
set "PS_SCRIPT=%TEMP%\pengu_uninstall.ps1"
echo Write-Host "Uninstalling Pengu Loader..." -ForegroundColor Yellow > "%PS_SCRIPT%"
echo Write-Host "" >> "%PS_SCRIPT%"
echo irm https://pengu.lol/clean ^| iex >> "%PS_SCRIPT%"
echo Write-Host "" >> "%PS_SCRIPT%"
echo Write-Host "Done!" -ForegroundColor Green >> "%PS_SCRIPT%"
echo Write-Host "" >> "%PS_SCRIPT%"
echo Write-Host "Press any key to close..." -ForegroundColor Cyan >> "%PS_SCRIPT%"
echo $null = $Host.UI.RawUI.ReadKey^("NoEcho,IncludeKeyDown"^) >> "%PS_SCRIPT%"

:: Run with admin rights
powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"%PS_SCRIPT%\"' -Verb RunAs -Wait"
if %errorlevel%==0 (
    echo   %GREEN%[OK]%R% Pengu Loader uninstall completed
) else (
    echo   %YELLOW%[--]%R% Pengu Loader uninstall skipped or cancelled
)

:: Cleanup temp script
del "%PS_SCRIPT%" >nul 2>&1

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
exit /b 0
