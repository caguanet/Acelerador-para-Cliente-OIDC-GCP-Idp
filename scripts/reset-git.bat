@echo off
setlocal
echo ===================================================
echo   RESET GIT REPOSITORY (WHITE-LABEL INITIALIZATION)
echo ===================================================
echo.
echo [WARNING] This will DELETE the entire commit history (.git folder).
echo [WARNING] Ensure you have a backup if you need legacy history.
echo.
timeout /t 5

if exist .git (
    echo [RESET] Found existing .git folder. Removing...
    attrib -r -s -h .git /S /D
    rd /s /q .git
    if exist .git (
        echo [ERROR] Failed to delete .git folder. Close all editors/terminals and try again.
        pause
        exit /b 1
    ) else (
        echo [OK] Old history removed.
    )
) else (
    echo [INFO] No existing .git folder found.
)

echo.
echo [INIT] Initializing new repository...
git init

echo.
echo [ADD] Staging all files...
git add .

echo.
echo [COMMIT] Creating initial commit...
git commit -m "feat: Initial commit of White-Label OIDC Solution"

echo.
echo [BRANCH] Renaming branch to main...
git branch -M main

echo.
echo ===================================================
echo   REPOSITORY RESET COMPLETE
echo ===================================================
echo.
echo You can now add your remote:
echo   git remote add origin <your-repo-url>
echo   git push -u origin main
echo.
pause
