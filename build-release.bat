@echo off
REM Wrapper: run the Windows release build (creates exec\ with installer + portable).
call "%~dp0scripts\build-release.bat" %*
exit /b %ERRORLEVEL%
