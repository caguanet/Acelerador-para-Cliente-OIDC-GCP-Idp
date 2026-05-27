@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul
cd /d %~dp0\..

:: ==============================================================================================
:: DEPLOY CLOUD RUN ONLY — Usar cuando los secretos ya existen y la imagen ya fue construida.
:: Asigna permisos a la SA y despliega/actualiza idp-service.
:: ==============================================================================================

set PROJECT_ID=etb-identity-omnicanal
set REGION=us-east1
set ARTIFACT_REPO_NAME=idp-repo

echo [1/4] Otorgando Secret Manager Secret Accessor a idp-service-sa...
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor" --project=%PROJECT_ID%
if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo IAM. & exit /b 1 )
timeout /t 15 /nobreak >nul

echo [2/4] Desplegando idp-service en Cloud Run...
call gcloud run deploy idp-service ^
  --image %REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/idp-service ^
  --platform managed ^
  --region %REGION% ^
  --service-account idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com ^
  --allow-unauthenticated ^
  --set-env-vars APP_MODE=IDP ^
  --set-env-vars "VITE_ALLOWED_ORIGINS=pending_configuration" ^
  --set-secrets VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest ^
  --set-secrets VITE_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN:latest ^
  --set-secrets VITE_FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest ^
  --set-secrets RECAPTCHA_PROJECT_ID=RECAPTCHA_PROJECT_ID:latest ^
  --set-secrets RECAPTCHA_SITE_KEY=RECAPTCHA_SITE_KEY:latest ^
  --set-secrets RECAPTCHA_API_KEY=RECAPTCHA_API_KEY:latest
if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo deploy. Si aparece IAM policy, ejecute el paso 4 abajo. & exit /b 1 )

echo [3/4] Obteniendo URL y actualizando VITE_ALLOWED_ORIGINS...
for /f "tokens=*" %%i in ('gcloud run services describe idp-service --region %REGION% --format^="value(status.url)"') do set SERVICE_URL=%%i
echo URL del servicio: %SERVICE_URL%
call gcloud run services update idp-service ^
  --region %REGION% ^
  --update-env-vars "VITE_ALLOWED_ORIGINS=%SERVICE_URL%^|http://localhost:3000"
if !ERRORLEVEL! NEQ 0 ( echo [WARN] No se pudo actualizar env. Revise manualmente. )

echo.
echo [4/4] Si el deploy mostro "Setting IAM policy failed", ejecute una vez:
echo   gcloud run services add-iam-policy-binding idp-service --region=%REGION% --member=allUsers --role=roles/run.invoker
echo.
echo [EXITO] Servicio: %SERVICE_URL%
pause
