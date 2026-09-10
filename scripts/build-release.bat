@echo off
REM =============================================================================
REM Bilingual Reader Desktop — Windows release build
REM
REM Prerequisites (build machine only — NOT required on end-user PCs):
REM   - Node.js LTS
REM   - Yarn
REM   - Visual Studio Build Tools (C++ / Windows SDK) for native addons
REM     (better-sqlite3, libmobi-addon)
REM
REM Output: exec\BilingualReader-Setup-*.exe  (NSIS installer)
REM         exec\BilingualReader-Portable-*.exe
REM =============================================================================

setlocal EnableExtensions
cd /d "%~dp0.."

echo.
echo === Bilingual Reader Desktop — release build ===
echo Root: %CD%
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo ERROR: Node.js not found in PATH. Install Node LTS and retry.
  exit /b 1
)

where yarn >nul 2>&1
if errorlevel 1 (
  echo ERROR: Yarn not found in PATH. Install Yarn and retry.
  exit /b 1
)

if not exist "exec" (
  mkdir "exec"
  if errorlevel 1 (
    echo ERROR: Could not create exec\
    exit /b 1
  )
)

if not exist "node_modules\" (
  echo node_modules missing — running yarn install...
  call yarn install
  if errorlevel 1 (
    echo ERROR: yarn install failed.
    exit /b 1
  )
)

REM Ensure .env.production exists for electron-builder extraResources
if not exist ".env.production" (
  if exist ".env.example" (
    echo Creating .env.production from .env.example...
    copy /Y ".env.example" ".env.production" >nul
  ) else (
    echo Creating empty .env.production...
    type nul > ".env.production"
  )
)

echo.
echo Running yarn build:electron (compile + native + Angular + electron-builder^)...
echo.
call yarn build:electron
if errorlevel 1 (
  echo.
  echo ERROR: build:electron failed.
  exit /b 1
)

echo.
echo === Build finished ===
echo Artifacts in: %CD%\exec
echo.
dir /b "exec\*.exe" 2>nul
if errorlevel 1 (
  echo WARNING: No .exe found under exec\ — check electron-builder logs above.
) else (
  echo.
  echo Installer:  look for BilingualReader-Setup-*.exe
  echo Portable:   look for BilingualReader-Portable-*.exe
)
echo.
exit /b 0
