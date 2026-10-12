@echo off
title Servidor do Leitor EPUB

cd /d "%~dp0"

echo ========================================================
echo       Inicializando Leitor de Teste EPUB
echo ========================================================
echo.

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERRO] O Node.js nao foi encontrado no PATH do sistema!
    echo Verifique a instalacao do Node.js.
    pause
    exit /b 1
)

echo [1/2] Iniciando servidor local na porta 3000...
start "Servidor Leitor EPUB (Porta 3000)" cmd /c "node leitor\server.js"

echo [2/2] Abrindo navegador...
timeout /t 2 /nobreak >nul
start http://localhost:3000/leitor/

echo.
echo Leitor aberto com sucesso no navegador!
echo O arquivo teste.epub foi configurado para abertura automatica.
echo.
echo Para encerrar o servidor, feche a janela "Servidor Leitor EPUB".
echo ========================================================
pause
