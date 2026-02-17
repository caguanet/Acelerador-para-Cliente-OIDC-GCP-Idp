@echo off
:: ====================================================
:: SCRIPT DE REDESPLIEGUE OPTIMIZADO "ONE-SHOT" (Windows CMD)
:: Proyecto: ETB IDP Demo
:: Autor: JuanK Ruiz (AI Assistant)
:: Fecha: 2026-02-10
:: ====================================================

:: 1. Configurar Entorno
set PROJECT_ID=etb-idp-demo
set REGION=us-central1

:: echo [INFO] Autenticacion en GCP (Descomentar si es necesario)
:: call gcloud auth login


echo ====================================================
echo  INICIANDO PROCESO DE REDESPLIEGUE MASIVO
echo ====================================================
echo.

:: 2. Construir Imagen
echo [1/3] Construyendo imagen Docker...
call gcloud builds submit --tag gcr.io/%PROJECT_ID%/etb-idp-frontend
IF %ERRORLEVEL% NEQ 0 ( echo [ERROR] Fallo al construir la imagen. & exit /b %ERRORLEVEL% )

:: 3. Obtener URLs de Servicios Existentes
echo.
echo [2/3] Obteniendo configuraciones de red...
for /f "tokens=*" %%i in ('gcloud run services describe etb-idp-service --region %REGION% --format^="value(status.url)"') do set IDP_URL=%%i
for /f "tokens=*" %%i in ('gcloud run services describe etb-mock-client --region %REGION% --format^="value(status.url)"') do set MOCK_URL=%%i

echo IDP URL:  %IDP_URL%
echo Mock URL: %MOCK_URL%

:: 4. Desplegar Mock Client (Depende de IDP_URL)
echo.
echo [3/3] Desplegando Mock Client...
call gcloud run deploy etb-mock-client ^
  --image gcr.io/%PROJECT_ID%/etb-idp-frontend ^
  --platform managed --region %REGION% ^
  --allow-unauthenticated ^
  --set-env-vars APP_MODE=MOCK,VITE_IDP_URL=%IDP_URL% ^
  --set-secrets VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest ^
  --set-secrets VITE_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN:latest ^
  --set-secrets VITE_FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest

IF %ERRORLEVEL% NEQ 0 ( echo [ERROR] Fallo al desplegar Mock Client. & exit /b %ERRORLEVEL% )

:: 5. Desplegar IDP Service (Depende de MOCK_URL + Autorización Cruzada en un solo paso)
echo.
echo [4/3] Desplegando IDP Service con Whitelist...
call gcloud run deploy etb-idp-service ^
  --image gcr.io/%PROJECT_ID%/etb-idp-frontend ^
  --platform managed --region %REGION% ^
  --allow-unauthenticated ^
  --set-env-vars "APP_MODE=IDP,VITE_BACKEND_URL=%IDP_URL%,VITE_ALLOWED_ORIGINS=%MOCK_URL%|%IDP_URL%|http://localhost:5173,VITE_MOCK_CLIENT_URL=%MOCK_URL%" ^
  --set-secrets VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest ^
  --set-secrets VITE_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN:latest ^
  --set-secrets VITE_FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest

IF %ERRORLEVEL% NEQ 0 ( echo [ERROR] Fallo al desplegar IDP. & exit /b %ERRORLEVEL% )

:: 6. Finalización
echo.
echo ====================================================
echo [FINAL] Despliegue completado y seguridad sincronizada.
echo.
echo URLs Activas:
echo IDP Service:  %IDP_URL%
echo Mock Client:  %MOCK_URL%
echo.
echo Listo para ejecutar: npm run test:e2e
