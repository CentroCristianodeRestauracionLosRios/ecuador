@echo off
title CCRLR - Aplicar Fixes y Publicar

echo.
echo ==========================================
echo   CCRLR - Aplicar Fixes y Publicar
echo ==========================================
echo.

cd /d "C:\Users\javie\Documents\mi pagina web"
if errorlevel 1 (
    echo ERROR: No se encontro la carpeta del proyecto.
    pause
    exit /b 1
)
echo OK - Carpeta encontrada

git --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Git no encontrado.
    pause
    exit /b 1
)
echo OK - Git disponible

python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no encontrado. Descargalo de https://python.org
    pause
    exit /b 1
)
echo OK - Python disponible

python -c "import PIL" >nul 2>&1
if errorlevel 1 (
    echo Instalando Pillow...
    pip install Pillow --quiet
)
echo OK - Pillow disponible

echo.
echo Aplicando fixes...
python fix_ccrlr.py
if errorlevel 1 (
    echo ERROR al aplicar fixes.
    pause
    exit /b 1
)

echo.
echo Subiendo a GitHub...
git add .
git commit -m "fix: navbar funcional, bfcache, icono juegos"
git push

if errorlevel 1 (
    echo AVISO: Problema con git push. Puede que no haya cambios nuevos.
) else (
    echo.
    echo ==========================================
    echo   LISTO - Cambios publicados en la web
    echo ==========================================
)

echo.
pause
