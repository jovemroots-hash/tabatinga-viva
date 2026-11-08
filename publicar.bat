@echo off
chcp 65001 >nul
echo ========================================================
echo   PROJETO TABATINGA VIVA - Publicador Oficial
echo   (GitHub: jovemroots-hash / Netlify: tabatinga-viva)
echo ========================================================
echo.

set "PATH=%PATH%;C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\Git\cmd;C:\Program Files\Git\cmd;%APPDATA%\npm;C:\Program Files\GitHub CLI"
set "NODE_OPTIONS=--use-system-ca"

echo [1/4] Salvando alteracoes no Git local...
git add .
git commit -m "Atualizacao do Projeto Tabatinga Viva" 2>nul

echo.
echo [2/4] Verificando conexao com o GitHub (jovemroots-hash)...
gh auth status >nul 2>&1
if %errorlevel% neq 0 (
    echo Conectando sua conta do GitHub no navegador...
    gh auth login -h github.com -p https -w
)

git remote get-url origin >nul 2>&1
if %errorlevel% neq 0 (
    echo Criando repositorio 'tabatinga-viva' no GitHub...
    gh repo create tabatinga-viva --public --source=. --remote=origin --push
) else (
    echo Enviando atualizacao para o GitHub...
    git push -u origin main
)

echo.
echo [3/4] Verificando conexao com o Netlify (tabatinga-viva)...
if not exist ".netlify\state.json" (
    echo Vinculando ao site tabatinga-viva no Netlify...
    call "%APPDATA%\npm\netlify.cmd" link --id 2a88b494-9572-4a3e-b224-60017fbaa7a9
)

echo.
echo [4/4] Publicando site ao vivo no Netlify...
call "%APPDATA%\npm\netlify.cmd" deploy --prod --dir="."

echo.
echo ========================================================
echo   Site atualizado com sucesso no GitHub e no Netlify!
echo   Link Oficial: https://tabatinga-viva.netlify.app
echo   Pesquisa:     https://tabatinga-viva.netlify.app/pesquisa_online.html
echo   Painel Dados: https://tabatinga-viva.netlify.app/painel_respostas.html
echo ========================================================
pause
