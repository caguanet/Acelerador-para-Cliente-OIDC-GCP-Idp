# Guía de Despliegue: Cloud Run (OIDC Service)

> [!TIP]
> **Despliegue Rápido (One-Shot):**
> Este documento detalla paso a paso el proceso de despliegue.
> Para entornos donde se desee minimizar la intervención manual, puede utilizar el script automatizado:
> `scripts/one-shot-deploy.cmd`
>
> *Nota: Asegúrese de editar las variables de configuración en el script antes de ejecutarlo.*

## 1. Resumen Ejecutivo

Este documento define la **Estrategia de Despliegue en Producción** para el Proveedor de Identidad OpenID Connect (OIDC). La arquitectura aprovecha **Google Cloud Run** para proporcionar una infraestructura serverless, altamente disponible y autoescalable.

**Alcance:**
*   **Aprovisionamiento:** Creación de recursos base (Artifact Registry, Secret Manager).
*   **Despliegue Continuo (CD):** Compilación y publicación de nuevas versiones del servicio.

---

## 2. Prerrequisitos

*   **Google Cloud SDK** (Autenticado y configurado).
*   **Roles IAM:** `Run Admin`, `Artifact Registry Admin`, `Secret Manager Accessor`.
*   **Docker:** Daemon local en ejecución (si se compila localmente).

---

## 3. Configuración Global

**IMPORTANTE:** Defina estas variables al inicio de su sesión de terminal.

```cmd
:: --- 1. Identificadores del Proyecto (OBLIGATORIO) ---
:: Nombre del proyecto en GCP
set PROJECT_ID=<TU_PROJECT_ID>

:: Nombre para el REPOSITORIO DE ARTEFACTOS (Donde se alojarán las imágenes Docker)
:: Ejemplo: "infra-registry", "oidc-artifacts", "backend-repo"
set ARTIFACT_REPO_NAME=<TU_NOMBRE_DE_REPOSITORIO>

:: --- 3. Secretos de la Aplicación (SENSIBLE) ---
:: Defina aquí los valores REALES.
:: ADVERTENCIA: Al ejecutar esto, los valores quedarán en el historial de su terminal.
:: Se recomienda limpiar el historial tras la ejecución.
set VAL_FIREBASE_API_KEY=<TU_API_KEY_REAL>
set VAL_FIREBASE_AUTH_DOMAIN=<TU_AUTH_DOMAIN_REAL>
set VAL_FIREBASE_PROJECT_ID=<TU_FIREBASE_PROJECT_ID_REAL>
```

---

## 4. Aprovisionamiento de Infraestructura (One-Time Setup)

Esta sección se ejecuta **una única vez** al inicializar el proyecto. Su objetivo es preparar el terreno (APIs, Repositorios, Secretos). No despliega la aplicación.

```cmd
:: 1. Habilitar APIs
setlocal enabledelayedexpansion
gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com secretmanager.googleapis.com

:: 2. Verificar/Crear Artifact Registry
echo [INFO] Verificando repositorio: %ARTIFACT_REPO_NAME%...
call gcloud artifacts repositories describe %ARTIFACT_REPO_NAME% --location=%REGION% >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] El repositorio '%ARTIFACT_REPO_NAME%' NO existe. Creando automáticamente...
    gcloud artifacts repositories create %ARTIFACT_REPO_NAME% --repository-format=docker --location=%REGION% --description="Registro de Imagenes OIDC"
) else (
    echo [INFO] Repositorio detectado. Continuando...
)

:: 3. Asignación de Permisos IAM (Cloud Build Service Account)
:: Crítico para que el pipeline de CI/CD pueda acceder a los secretos y al registro.
echo [INFO] Configurando permisos IAM para Cloud Build...
for /f "tokens=*" %i in ('gcloud projects describe %PROJECT_ID% --format^="value(projectNumber)"') do set PROJ_NUM=%i
gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJ_NUM%@cloudbuild.gserviceaccount.com" --role="roles/artifactregistry.admin" >nul
gcloud projects add-iam-policy-binding %PROJECT_ID% --member="serviceAccount:%PROJ_NUM%-compute@developer.gserviceaccount.com" --role="roles/secretmanager.secretAccessor" >nul


:: 3. Gestión de Secretos (Lógica Automática: Crear o Rotar)
echo [INFO] Configurando secretos en Secret Manager...

:: --- FIREBASE_API_KEY ---
call gcloud secrets describe FIREBASE_API_KEY >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo [INFO] El secreto FIREBASE_API_KEY ya existe. Agregando nueva versión...
    echo %VAL_FIREBASE_API_KEY%| gcloud secrets versions add FIREBASE_API_KEY --data-file=- --quiet
) else (
    echo [INFO] Creando secreto FIREBASE_API_KEY...
    echo %VAL_FIREBASE_API_KEY%| gcloud secrets create FIREBASE_API_KEY --data-file=-
)

:: --- FIREBASE_AUTH_DOMAIN ---
call gcloud secrets describe FIREBASE_AUTH_DOMAIN >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo [INFO] El secreto FIREBASE_AUTH_DOMAIN ya existe. Agregando nueva versión...
    echo %VAL_FIREBASE_AUTH_DOMAIN%| gcloud secrets versions add FIREBASE_AUTH_DOMAIN --data-file=- --quiet
) else (
    echo [INFO] Creando secreto FIREBASE_AUTH_DOMAIN...
    echo %VAL_FIREBASE_AUTH_DOMAIN%| gcloud secrets create FIREBASE_AUTH_DOMAIN --data-file=-
)

:: --- FIREBASE_PROJECT_ID ---
call gcloud secrets describe FIREBASE_PROJECT_ID >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    echo [INFO] El secreto FIREBASE_PROJECT_ID ya existe. Agregando nueva versión...
    echo %VAL_FIREBASE_PROJECT_ID%| gcloud secrets versions add FIREBASE_PROJECT_ID --data-file=- --quiet
) else (
    echo [INFO] Creando secreto FIREBASE_PROJECT_ID...
    echo %VAL_FIREBASE_PROJECT_ID%| gcloud secrets create FIREBASE_PROJECT_ID --data-file=-
)
```

---

## 5. Pipeline de Despliegue de Aplicación (OIDC Service)

Este script se ejecuta recurrentemente para liberar nuevas versiones del **Identity Provider**.

```cmd
:: 1. Compilar Imagen y Subir a Artifact Registry
:: Nota: Se usa la ruta regionalizada standard (pkg.dev)
gcloud builds submit --tag %REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/idp-service

:: 2. Desplegar Nueva Revisión en Cloud Run
gcloud run deploy idp-service ^
  --image %REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/idp-service ^
  --platform managed ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --set-env-vars APP_MODE=IDP ^
  --set-env-vars "VITE_ALLOWED_ORIGINS=https://tu-cliente.com|https://otro-cliente.com" ^
  --set-secrets VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest ^
  --set-secrets VITE_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN:latest ^
  --set-secrets VITE_FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest
```

---

## 6. Configuración Post-Despliegue (Integración)

Tras el despliegue, el servicio será accesible vía HTTPS, pero requiere autorización en los proveedores externos.

1.  **Identity Platform (GCP):** Agregar dominio de Cloud Run a "Authorized Domains".
2.  **Firebase Console:** Agregar dominio a "HTTP Referrers" en la API Key.
3.  **OAuth Credentials:** Agregar dominio a "Authorized JavaScript Origins".

> [!TIP]
> **Desarrollo Local:**
> Si planea desarrollar clientes OIDC externos (como la Solución Demo), asegúrese de agregar también `http://localhost:XXXX` (donde XXXX es el puerto local de su cliente) a la variable `VITE_ALLOWED_ORIGINS` del IdP y a los "Authorized JavaScript origins" de la Credencial OAuth en GCP.

---

## 7. Anexo: Despliegue de Cliente Mock (Entornos de Calidad)

Uso exclusivo para pruebas de integración en nube.

```cmd
:: 1. Compilar Artifact Mock
gcloud builds submit --tag %REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/mock-client --file=Dockerfile.mock

:: 2. Desplegar Servicio Mock
gcloud run deploy mock-client ^
  --image %REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/mock-client ^
  --platform managed ^
  --region %REGION% ^
  --allow-unauthenticated ^
  --set-env-vars APP_MODE=MOCK ^
  --set-env-vars VITE_IDP_URL=https://idp-service-xyz.run.app

:: 3. Interconexión Automática (Cierre del Círculo)
echo [INFO] Capturando URL del Mock Client...
for /f "tokens=*" %i in ('gcloud run services describe mock-client --region %REGION% --format^="value(status.url)"') do set MOCK_URL=%i
echo [INFO] Mock URL: %MOCK_URL%

echo [INFO] Actualizando Whitelist del IDP...
:: ADVERTENCIA: Se usa '|' como separador para evitar conflictos de parsing en CMD
gcloud run services update idp-service ^
  --region %REGION% ^
  --set-env-vars "^,^VITE_ALLOWED_ORIGINS=%MOCK_URL%|http://localhost:5173"

echo [EXITO] Despliegue de entorno de pruebas finalizado.
```

**Nota:** Este script asume que `idp-service-xyz.run.app` es la URL correcta. Si es la primera vez, verifique la salida del paso de despliegue principal.

---

## 8. Resolución de Problemas (Troubleshooting)

Errores comunes detectados en operación.

| Error Visible | Causa Probable | Solución |
| :--- | :--- | :--- |
| `auth/requests-from-referer-blocked` | Faltan dominios en API Key o OAuth. | Revisar Configuración Post-Despliegue (Referrers y Origins en GCP/Firebase). |
| `Error de seguridad: El dominio ... no está autorizado` | Variable `VITE_ALLOWED_ORIGINS` incorrecta. | El script usa `|` como separador. Verifique que Cloud Run tenga ambos dominios (IDP y Mock/Cliente). |
| `Illegal url for new iframe` | Secretos corruptos (espacios ocultos). | Repita el paso de gestión de secretos usando `echo|set /p` para evitar saltos de línea. |
| Login Loop / Redirección infinita | Configuración OIDC circular. | Verifique que el Client ID sea el correcto y que el Mock no se apunte a sí mismo como IDP. |

---

## 9. Estrategia DevOps: Dominios Personalizados

Para entornos productivos, evite usar las URLs por defecto `*.run.app`.

### Opción A: Mapeo de Dominio (Cloud Run)
1.  Vaya a **Cloud Run > Manage Custom Domains**.
2.  Mapee `auth.su-empresa.com` al servicio `idp-service`.
3.  Actualice **UNA VEZ** los orígenes autorizados en GCP/Firebase.
4.  Beneficio: Puede recrear el servicio sin romper la confianza de los clientes OAuth.

### Opción B: Load Balancer (Enterprise)
Recomendado para WAF, certificados gestionados y cumplimiento normativo. El dominio apunta a la IP del balanceador, desacoplando completamente la red del servicio de cómputo.

