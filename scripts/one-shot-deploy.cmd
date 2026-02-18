@echo off
setlocal enabledelayedexpansion

:: ==============================================================================================
:: ONE-SHOT DEPLOY SCRIPT (OIDC SERVICE)
:: ==============================================================================================
:: Este script automatiza TODO el proceso descrito en DEPLOY.md.
:: Úselo para desplegar la solución OIDC completa con mínima intervención.
::
:: PRE-REQUISITOS:
:: 1. Google Cloud SDK instalado y autenticado (gcloud auth login).
:: 2. Docker funcionando localmente (si se necesita build local) o Cloud Build habilitado.
:: ==============================================================================================

:: --- 1. CONFIGURACIÓN GLOBAL (¡EDITAR ANTES DE EJECUTAR!) ---

:: Identificadores
set PROJECT_ID=CAMBIAR_POR_TU_PROJECT_ID
set ARTIFACT_REPO_NAME=idp-repo
set REGION=us-east1

:: Orígenes Permitidos (CORS)
set VITE_ALLOWED_ORIGINS=https://tu-cliente.com|https://otro-cliente.com

:: Secretos de Firebase (Valores Reales)
:: Déjelos en blanco si ya existen en Secret Manager.
set VAL_FIREBASE_API_KEY=
set VAL_FIREBASE_AUTH_DOMAIN=
set VAL_FIREBASE_PROJECT_ID=

:: ==============================================================================================
:: NO MODIFICAR DEBAJO DE ESTA LÍNEA A MENOS QUE SEPA LO QUE HACE
:: ==============================================================================================

echo [INIT] Iniciando One-Shot Deploy para Proyecto: %PROJECT_ID%
echo.

:: Validar configuración mínima
if "%PROJECT_ID%"=="CAMBIAR_POR_TU_PROJECT_ID" (
    echo [ERROR] Por favor edite este script y configure la variable PROJECT_ID.
    pause
    exit /b 1
)

:: --- FASE 1: APROVISIONAMIENTO DE INFRAESTRUCTURA ---
echo [FASE 1] Aprovisionando Infraestructura...

:: 1. Habilitar APIs
echo [INFO] Habilitando APIs de GCP...
call gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com secretmanager.googleapis.com
if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo al habilitar APIs. & exit /b 1 )

:: 2. Verificar/Crear Artifact Registry
echo [INFO] Verificando repositorio: %ARTIFACT_REPO_NAME%...
call gcloud artifacts repositories describe %ARTIFACT_REPO_NAME% --location=%REGION% >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [INFO] El repositorio '%ARTIFACT_REPO_NAME%' NO existe. Creando automáticamente...
    call gcloud artifacts repositories create %ARTIFACT_REPO_NAME% --repository-format=docker --location=%REGION% --description="Registro de Imagenes OIDC"
    if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo al crear repositorio. & exit /b 1 )
) else (
    echo [INFO] Repositorio detectado. Continuando...
)

:: 3. Asignación de Permisos IAM (Cloud Build)
echo [INFO] Configurando permisos IAM para Cloud Build...
for /f "tokens=*" %%i in ('gcloud projects describe %PROJECT_ID% --format^="value(projectNumber)"') do set PROJ_NUM=%%i
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJ_NUM%@cloudbuild.gserviceaccount.com" --role="roles/artifactregistry.admin" >nul
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJ_NUM%-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor" >nul

:: 4. Gestión de Secretos
echo [INFO] Gestionando secretos...

:: Helper function logic simulated via checks
if not "%VAL_FIREBASE_API_KEY%"=="" (
    call gcloud secrets describe FIREBASE_API_KEY >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo [INFO] Actualizando FIREBASE_API_KEY...
        echo %VAL_FIREBASE_API_KEY%| gcloud secrets versions add FIREBASE_API_KEY --data-file=- --quiet
    ) else (
        echo [INFO] Creando FIREBASE_API_KEY...
        echo %VAL_FIREBASE_API_KEY%| gcloud secrets create FIREBASE_API_KEY --data-file=-
    )
)

if not "%VAL_FIREBASE_AUTH_DOMAIN%"=="" (
    call gcloud secrets describe FIREBASE_AUTH_DOMAIN >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo [INFO] Actualizando FIREBASE_AUTH_DOMAIN...
        echo %VAL_FIREBASE_AUTH_DOMAIN%| gcloud secrets versions add FIREBASE_AUTH_DOMAIN --data-file=- --quiet
    ) else (
        echo [INFO] Creando FIREBASE_AUTH_DOMAIN...
        echo %VAL_FIREBASE_AUTH_DOMAIN%| gcloud secrets create FIREBASE_AUTH_DOMAIN --data-file=-
    )
)

if not "%VAL_FIREBASE_PROJECT_ID%"=="" (
    call gcloud secrets describe FIREBASE_PROJECT_ID >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo [INFO] Actualizando FIREBASE_PROJECT_ID...
        echo %VAL_FIREBASE_PROJECT_ID%| gcloud secrets versions add FIREBASE_PROJECT_ID --data-file=- --quiet
    ) else (
        echo [INFO] Creando FIREBASE_PROJECT_ID...
        echo %VAL_FIREBASE_PROJECT_ID%| gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
    )
)


:: --- FASE 2: DESPLIEGUE DEL SERVICIO OIDC ---
echo.
echo [FASE 2] Desplegando Servicio OIDC...

:: 1. Compilar y Subir
echo [Step] Cloud Build Submit...
call gcloud builds submit --tag %REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/idp-service
if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo en el Build. & exit /b 1 )

:: 2. Desplegar Cloud Run
echo [Step] Cloud Run Deploy...
call gcloud run deploy idp-service ^
  --image %REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/idp-service ^
  --platform managed ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --set-env-vars APP_MODE=IDP ^
  --set-env-vars "VITE_ALLOWED_ORIGINS=%VITE_ALLOWED_ORIGINS%" ^
  --set-secrets VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest ^
  --set-secrets VITE_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN:latest ^
  --set-secrets VITE_FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest

if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo en el Despliegue. & exit /b 1 )

echo.
echo ==============================================================================================
echo [EXITO] Despliegue completado satisfactoriamente.
echo ==============================================================================================
echo.
echo Siguientes Pasos (Manuales):
echo 1. Agregue la URL del servicio a "Authorized Domains" en Identity Platform.
echo 2. Agregue la URL a "HTTP Referrers" en la API Key (GCP Console).
echo 3. Agregue la URL a "Authorized JavaScript origins" en Credenciales OAuth.
echo.
pause
