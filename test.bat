@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo       Bilingual Reader Desktop - Test Runner
echo ===================================================

set TARGET=%1
if "%TARGET%"=="" set TARGET=all

if /I "%TARGET%"=="front" goto run_front
if /I "%TARGET%"=="frontend" goto run_front
if /I "%TARGET%"=="back" goto run_back
if /I "%TARGET%"=="backend" goto run_back
if /I "%TARGET%"=="mobile" goto run_mobile
if /I "%TARGET%"=="all" goto run_all

echo [ERRO] Opcao invalida: %TARGET%
echo Uso: test.bat [all ^| front ^| back ^| mobile]
exit /b 1

:run_back
echo.
echo [1/1] Executando testes do Backend (Electron / Jest)...
call npx jest --config jest.config.js
if %ERRORLEVEL% NEQ 0 (
    echo [FALHA] Testes do Backend falharam.
    exit /b %ERRORLEVEL%
)
echo [SUCESSO] Testes do Backend concluidos com exito!
goto end

:run_front
echo.
echo [1/1] Executando testes do Frontend (Angular / Karma)...
call npx ng test --no-watch --browsers=ChromeHeadless
if %ERRORLEVEL% NEQ 0 (
    echo [FALHA] Testes do Frontend falharam.
    exit /b %ERRORLEVEL%
)
echo [SUCESSO] Testes do Frontend concluidos com exito!
goto end

:run_mobile
echo.
echo [1/1] Executando testes unitarios do modulo Android / Kotlin...
if exist "aplicativo\gradlew.bat" (
    cd aplicativo
    call gradlew.bat testDebugUnitTest
    cd ..
) else (
    echo [AVISO] gradlew.bat nao localizado no diretorio aplicativo.
)
goto end

:run_all
echo.
echo ===================================================
echo [1/2] Executando testes do Backend (Jest)...
echo ===================================================
call npx jest --config jest.config.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FALHA] Testes do Backend falharam. Abortando suite.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [2/2] Executando testes do Frontend (Angular)...
echo ===================================================
call npx ng test --no-watch --browsers=ChromeHeadless
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [FALHA] Testes do Frontend falharam. Abortando suite.
    exit /b %ERRORLEVEL%
)

echo.
echo ===================================================
echo [SUCESSO COMPLETO] Todos os testes passaram!
echo ===================================================
goto end

:end
exit /b 0
