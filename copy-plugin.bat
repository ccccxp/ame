@echo off
xcopy /E /Y /I "%~dp0src" "%LOCALAPPDATA%\ame\pengu\plugins\ame"
echo Done.
