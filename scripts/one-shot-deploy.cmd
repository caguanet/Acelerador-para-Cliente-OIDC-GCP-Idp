@echo off
setlocal enabledelayedexpansion
:: Corregir encoding para caracteres especiales
chcp 65001 >nul

:: Asegurar ejecución desde el root del proyecto
cd /d %~dp0\..

:: ==============================================================================================
:: ONE-SHOT DEPLOY SCRIPT (OIDC SERVICE)
:: ==============================================================================================
:: Este script automatiza TODO el proceso descrito en DEPLOY.md.
:: Úselo para desplegar la solución OIDC completa con mínima intervención.
::
:: PRE-REQUISITOS:
:: 1. Google Cloud SDK instalado.
::    Si no ha iniciado sesión, descomente la siguiente línea o ejecútela manualmente:
::    call gcloud auth login
:: 2. Docker funcionando localmente (si se necesita build local) o Cloud Build habilitado.
:: ==============================================================================================

:: --- 1. CONFIGURACIÓN GLOBAL (¡EDITAR ANTES DE EJECUTAR!) ---

:: Identificadores
set PROJECT_ID=etb-identity-omnicanal
set ARTIFACT_REPO_NAME=idp-repo

:: Región de Despliegue
:: Opciones recomendadas para LatAm Norte:
:: - us-east1 (Virginia) - Menor latencia general
:: - us-central1 (Iowa) - Mayor disponibilidad de servicios
:: - southamerica-east1 (São Paulo) - Solo si la soberanía de datos es crítica
set REGION=us-east1


:: Orígenes Permitidos (CORS) - AUTOMÁTICO
:: Se configurará automáticamente con la URL del servicio tras el despliegue.
:: Si necesita dominios adicionales, edite el paso de "Update" al final.
:: set VITE_ALLOWED_ORIGINS= (Calculado automáticamente)

:: Secretos de Firebase (Valores Reales)
:: Déjelos en blanco si ya existen en Secret Manager.
set VAL_FIREBASE_API_KEY=YOUR_FIREBASE_WEB_API_KEY
set VAL_FIREBASE_AUTH_DOMAIN=etb-identity-omnicanal.firebaseapp.com
set VAL_FIREBASE_PROJECT_ID=etb-identity-omnicanal

:: reCAPTCHA Enterprise
:: VAL_RECAPTCHA_SITE_KEY es publica; VAL_RECAPTCHA_API_KEY es privada y debe ser
:: una API key separada, restringida solo a recaptchaenterprise.googleapis.com.
set VAL_RECAPTCHA_PROJECT_ID=etb-identity-omnicanal
set VAL_RECAPTCHA_SITE_KEY=6Lfak_0sAAAAAIMausKbKkGMKHe5W_RVxa4h3FGN
set VAL_RECAPTCHA_API_KEY=

:: ==============================================================================================
:: NO MODIFICAR DEBAJO DE ESTA LÍNEA A MENOS QUE SEPA LO QUE HACE
:: ==============================================================================================

echo [INIT] Iniciando One-Shot Deploy para Proyecto: %PROJECT_ID%
echo.
echo [ADVERTENCIA] Si su proyecto pertenece a una ORGANIZACIÓN, es posible que existan 
echo               politicas restrictivas (ej: Domain Restriction) que impidan el despliegue público.
echo               Si el despliegue falla por permisos, revise la sección 
echo               "Resolución de Problemas > Políticas de Organización" en DEPLOY.md.
echo.

:: Validar configuración mínima
if "%PROJECT_ID%"=="etb-identity-omnicanal"
    echo [ERROR] Por favor edite este script y configure la variable PROJECT_ID.
    pause
    exit /b 1
)

:: --- FASE 1: APROVISIONAMIENTO DE INFRAESTRUCTURA ---
echo [FASE 1] Aprovisionando Infraestructura...

:: 1. Habilitar APIs
:: 1. Habilitar APIs
echo [INFO] Habilitando APIs de GCP...
:: Se agregan compute.googleapis.com (para SA default) e iam.googleapis.com
call gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com secretmanager.googleapis.com compute.googleapis.com iam.googleapis.com recaptchaenterprise.googleapis.com --project=%PROJECT_ID%
if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo al habilitar APIs. & exit /b 1 )

echo [INFO] Esperando 15 segundos para la propagacion de Service Accounts...
echo [INFO] Esperando 15 segundos para la propagacion de Service Accounts...
timeout /t 15 /nobreak >nul

:: 1.6. Crear Service Account Dedicada (Best Practice)
echo [INFO] Verificando Service Account dedicada 'idp-service-sa'...
call gcloud iam service-accounts describe idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [INFO] Creando Service Account 'idp-service-sa'...
    call gcloud iam service-accounts create idp-service-sa --display-name="Identity Provider Service Account" --project=%PROJECT_ID%
    if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo al crear Service Account. & exit /b 1 )
    :: Esperar propagación
    timeout /t 10 /nobreak >nul
) else (
    echo [INFO] Service Account 'idp-service-sa' ya existe.
)

:: 2. Verificar/Crear Artifact Registry
:: 2. Verificar/Crear Artifact Registry
echo [INFO] Verificando disponibilidad de Artifact Registry...

:: Retry Loop for API Availability
set "API_RETRIES=0"
:CheckARApi
call gcloud artifacts repositories list --project=%PROJECT_ID% >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    set /a API_RETRIES+=1
    if !API_RETRIES! LSS 10 (
        echo [WARN] Artifact Registry API aun no responde ^(Intento !API_RETRIES!/10^). Esperando 10s...
        timeout /t 10 /nobreak >nul
        goto CheckARApi
    ) else (
        echo [ERROR] La API de Artifact Registry no esta lista tras 100 segundos.
        exit /b 1
    )
)

echo [INFO] Verificando repositorio: %ARTIFACT_REPO_NAME%...
call gcloud artifacts repositories describe %ARTIFACT_REPO_NAME% --location=%REGION% --project=%PROJECT_ID% >nul 2>&1
if !ERRORLEVEL! NEQ 0 (
    echo [INFO] El repositorio '%ARTIFACT_REPO_NAME%' NO existe. Creando automáticamente...
    call gcloud artifacts repositories create %ARTIFACT_REPO_NAME% --repository-format=docker --location=%REGION% --description="Registro de Imagenes OIDC" --project=%PROJECT_ID%
    if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo al crear repositorio. & exit /b 1 )
) else (
    echo [INFO] Repositorio detectado. Continuando...
)

:: 3. Asignación de Permisos IAM (Cloud Build)
echo [INFO] Configurando permisos IAM para Cloud Build...
for /f "tokens=*" %%i in ('gcloud projects describe %PROJECT_ID% --format^="value(projectNumber)"') do set PROJ_NUM=%%i
:: Fix Build Push Error: Permitir al SA default de Compute escribir en Artifact Registry (necesario para push)
:: ADEMAS: Configurar SA dedicada para el Build para desacoplar de la default
echo [INFO] Asignando roles para Cloud Build a 'idp-service-sa'...

:: Roles necesarios para que 'idp-service-sa' pueda ejecutar builds
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com" --role="roles/logging.logWriter" >nul 2>&1
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com" --role="roles/storage.objectViewer" >nul 2>&1
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com" --role="roles/artifactregistry.writer" >nul 2>&1
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com" --role="roles/cloudbuild.builds.builder" >nul 2>&1

echo [INFO] Esperando 30 segundos paea propagacion de IAM...
timeout /t 30 /nobreak >nul

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

if not "%VAL_RECAPTCHA_PROJECT_ID%"=="" (
    call gcloud secrets describe RECAPTCHA_PROJECT_ID >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo [INFO] Actualizando RECAPTCHA_PROJECT_ID...
        echo %VAL_RECAPTCHA_PROJECT_ID%| gcloud secrets versions add RECAPTCHA_PROJECT_ID --data-file=- --quiet
    ) else (
        echo [INFO] Creando RECAPTCHA_PROJECT_ID...
        echo %VAL_RECAPTCHA_PROJECT_ID%| gcloud secrets create RECAPTCHA_PROJECT_ID --data-file=-
    )
)

if not "%VAL_RECAPTCHA_SITE_KEY%"=="" (
    call gcloud secrets describe RECAPTCHA_SITE_KEY >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo [INFO] Actualizando RECAPTCHA_SITE_KEY...
        echo %VAL_RECAPTCHA_SITE_KEY%| gcloud secrets versions add RECAPTCHA_SITE_KEY --data-file=- --quiet
    ) else (
        echo [INFO] Creando RECAPTCHA_SITE_KEY...
        echo %VAL_RECAPTCHA_SITE_KEY%| gcloud secrets create RECAPTCHA_SITE_KEY --data-file=-
    )
)

if not "%VAL_RECAPTCHA_API_KEY%"=="" (
    call gcloud secrets describe RECAPTCHA_API_KEY >nul 2>&1
    if !ERRORLEVEL! EQU 0 (
        echo [INFO] Actualizando RECAPTCHA_API_KEY...
        echo %VAL_RECAPTCHA_API_KEY%| gcloud secrets versions add RECAPTCHA_API_KEY --data-file=- --quiet
    ) else (
        echo [INFO] Creando RECAPTCHA_API_KEY...
        echo %VAL_RECAPTCHA_API_KEY%| gcloud secrets create RECAPTCHA_API_KEY --data-file=-
    )
)

:: 5. Permiso para que la SA de Cloud Run lea los secretos (requerido por --set-secrets)
echo [INFO] Otorgando Secret Manager Secret Accessor a 'idp-service-sa'...
call gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor" --project=%PROJECT_ID%
if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo al otorgar acceso a secretos. & exit /b 1 )
echo [INFO] Esperando 15 segundos para propagacion de IAM en Secret Manager...
timeout /t 15 /nobreak >nul

:: --- FASE 2: DESPLIEGUE DEL SERVICIO OIDC ---
echo.
echo [FASE 2] Desplegando Servicio OIDC...

:: 1. Compilar y Subir
:: 1. Compilar y Subir
echo [Step] Cloud Build Submit...
echo [INFO] Este proceso puede tardar varios minutos y parecer detenido.
echo        Por favor espere a que termine la compilacion remotamente...

:: Generar cloudbuild.yaml temporal para configurar logging: CLOUD_LOGGING_ONLY
:: Esto es necesario cuando se usa una Service Account personalizada (si no, exige bucket de logs).
(
echo steps:
echo - name: 'gcr.io/cloud-builders/docker'
echo   args: ['build', '-t', '$_REGION-docker.pkg.dev/$_PROJECT_ID/$_ARTIFACT_REPO_NAME/idp-service', '.']
echo images:
echo - '$_REGION-docker.pkg.dev/$_PROJECT_ID/$_ARTIFACT_REPO_NAME/idp-service'
echo options:
echo   logging: CLOUD_LOGGING_ONLY
) > cloudbuild.yaml

call gcloud builds submit --config cloudbuild.yaml --substitutions=_REGION=%REGION%,_PROJECT_ID=%PROJECT_ID%,_ARTIFACT_REPO_NAME=%ARTIFACT_REPO_NAME% --service-account="projects/%PROJECT_ID%/serviceAccounts/idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com"
if !ERRORLEVEL! NEQ 0 ( 
    echo [ERROR] Fallo en el Build. 
    del cloudbuild.yaml
    exit /b 1 
)
del cloudbuild.yaml

:: 2. Desplegar Cloud Run (Inicial sin VITE_ALLOWED_ORIGINS correcta)
echo [Step] Cloud Run Deploy (Inicial)...
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

if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo en el Despliegue Inicial. & exit /b 1 )

:: 3. Post-Configuración Automática (Self-Referencing)
echo.
echo [FASE 3] Post-Configuración Automática...
echo [INFO] Obteniendo URL del servicio desplegado...

for /f "tokens=*" %%i in ('gcloud run services describe idp-service --region %REGION% --format^="value(status.url)"') do set SERVICE_URL=%%i
echo [INFO] URL Detectada: %SERVICE_URL%

echo [INFO] Actualizando VITE_ALLOWED_ORIGINS para permitirse a sí mismo...
:: Se actualiza el servicio poniendose a sí mismo como origen permitido.
:: NOTA: Se usa el caracter PIPE '|' como separador y debe escaparse con '^|' dentro de comillas dobles para CMD.
call gcloud run services update idp-service ^
  --region %REGION% ^
  --service-account idp-service-sa@%PROJECT_ID%.iam.gserviceaccount.com ^
  --update-env-vars "VITE_ALLOWED_ORIGINS=%SERVICE_URL%^|http://localhost:3000"

if !ERRORLEVEL! NEQ 0 ( echo [ERROR] Fallo al actualizar VITE_ALLOWED_ORIGINS. & exit /b 1 )

echo.
echo ==============================================================================================
echo [EXITO] Despliegue completado satisfactoriamente.
echo ==============================================================================================
echo.
echo [INFO] El servicio se ha configurado para permitir CORS desde:
echo        %SERVICE_URL%
echo.
echo Siguientes Pasos (Manuales):
echo 1. Authorized Domains (Identity Platform):
echo    https://console.cloud.google.com/customer-identity/settings?project=%PROJECT_ID%
echo.
echo 2. HTTP Referrers (API Key "Browser Key") y OAuth Origins (App Web):
echo    https://console.cloud.google.com/apis/credentials?project=%PROJECT_ID%
echo.
echo    [TIP] Agregue la URL de arriba como "Authorized Javascript Origin".
echo    [TIP] En "API Restrictions", asegurese de incluir:
echo          - Identity Toolkit API
echo          - Token Service API
echo    [TIP] En "HTTP Referrers", incluya tambien sus entornos locales:
echo          - http://localhost:AAAA/*
echo          - http://localhost:BBBB/*
echo    [TIP] Agregue esta URL como "Authorized Redirect URI":
echo          %SERVICE_URL%/__/auth/handler
echo.
pause
