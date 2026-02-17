# Guía de Despliegue: Cloud Run (OIDC Service)

**Metodología de Despliegue Seguro para el Identity Provider.**

## 1. Prerrequisitos

*   **Google Cloud SDK** instalado y autenticado.
*   **Permisos**: `Run Admin`, `Artifact Registry Admin`, `Secret Manager Accessor`.

## 2. Configuración Inicial (One-Time Setup)

```cmd
:: Variables
set PROJECT_ID=etb-idp-prod
set REGION=us-central1

:: 1. Habilitar APIs
gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com secretmanager.googleapis.com

:: 2. Crear Repositorio
gcloud artifacts repositories create gcr.io --repository-format=docker --location=us --description="Repo Docker"

:: 3. Configurar Secretos (API Keys)
echo|set /p="TU_API_KEY" | gcloud secrets create FIREBASE_API_KEY --data-file=-
echo|set /p="TU_AUTH_DOMAIN" | gcloud secrets create FIREBASE_AUTH_DOMAIN --data-file=-
echo|set /p="TU_PROJECT_ID" | gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
```

## 3. Script de Despliegue

```cmd
:: 1. Build
gcloud builds submit --tag gcr.io/%PROJECT_ID%/etb-idp-service

:: 2. Deploy IDP Service
gcloud run deploy etb-idp-service ^
  --image gcr.io/%PROJECT_ID%/etb-idp-service ^
  --platform managed --region %REGION% ^
  --allow-unauthenticated ^
  --set-env-vars APP_MODE=IDP ^
  --set-env-vars "VITE_ALLOWED_ORIGINS=https://mi-aliado.com|https://otro-aliado.com" ^
  --set-secrets VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest ^
  --set-secrets VITE_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN:latest ^
  --set-secrets VITE_FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest
```

## 4. Configuración Manual (GCP Console)

### OAuth & Dominios
1.  **Identity Platform**: En la configuración del proveedor (ej. Google), agrega el dominio de Cloud Run (`etb-idp-service-xyz.run.app`) a "Authorized Domains".
2.  **Credenciales API**: En "APIs & Services", agrega el dominio a "HTTP Referrers" de tu Browser Key.
3.  **Client IDs**: En "Credentials -> OAuth 2.0 Client IDs", agrega el dominio a "Authorized JavaScript origins".
