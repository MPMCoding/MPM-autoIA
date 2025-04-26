@echo off
echo Iniciando MPM AutoIA Desktop...
echo.

REM Verifica se o Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Erro: Node.js não encontrado. Por favor, instale o Node.js antes de continuar.
    pause
    exit /b
)

REM Verifica se as dependências estão instaladas
if not exist node_modules (
    echo Instalando dependências...
    call npm install
    if %ERRORLEVEL% neq 0 (
        echo Erro ao instalar dependências.
        pause
        exit /b
    )
)

REM Compila o Angular e inicia o Electron
echo Compilando e iniciando a aplicação...
call npm run electron-dev

exit /b