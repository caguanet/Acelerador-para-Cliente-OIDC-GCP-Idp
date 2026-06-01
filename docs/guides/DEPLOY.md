# Guia de despliegue Cloud Run

Este documento cubre el pipeline de build/deploy de `idp-service` y el troubleshooting propio del despliegue. La configuracion productiva viva de variables, secretos, IAM, Firebase/Auth, MuleSoft y reCAPTCHA esta centralizada en [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md).

## Alcance

| Tema | Documento |
| --- | --- |
| Build, Artifact Registry, Cloud Build, deploy y rollback de revision | Este documento |
| Secret Manager, variables productivas, IAM `idp-service-sa`, Firebase/Auth, reCAPTCHA, MuleSoft | [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md) |
| Setup local, `.env.local`, simulacion y pruebas en maquina de desarrollo | [CONFIGURACION-PASO-A-PASO.md](CONFIGURACION-PASO-A-PASO.md) |
| Proveedores externos, Anypoint, MS-4, Firestore y recuperacion de contrasena | [IDP_GCP_MULESOFT_MANUAL.md](IDP_GCP_MULESOFT_MANUAL.md) |

## Prerrequisitos

1. Instalar Google Cloud SDK.
   - Windows: descargar `GoogleCloudSDKInstaller.exe` desde <https://cloud.google.com/sdk/docs/install>.
   - macOS/Linux: usar el instalador oficial de Google Cloud SDK.
2. Autenticar la cuenta:

   ```bash
   gcloud auth login
   ```

3. Seleccionar proyecto:

   ```bash
   gcloud config set project etb-identity-omnicanal
   ```

4. Verificar cuenta y proyecto:

   ```bash
   gcloud auth list --filter=status:ACTIVE --format='value(account)'
   gcloud config get-value project
   ```

5. Confirmar permisos minimos para quien ejecuta el deploy:
   - Cloud Run Admin.
   - Cloud Build Editor o permisos equivalentes para ejecutar builds.
   - Artifact Registry Writer/Admin sobre el repositorio.
   - Service Account User sobre `idp-service-sa`, si se especifica la service account en deploy.
   - Secret Manager Viewer/Accessor solo si necesita validar secretos; la configuracion productiva se detalla en la guia canonica.

## Variables de sesion

Usar estos valores para el ambiente validado:

```bash
export PROJECT_ID=etb-identity-omnicanal
export REGION=us-east1
export ARTIFACT_REPO_NAME=idp-repo
export SERVICE_NAME=idp-service
export SERVICE_ACCOUNT=idp-service-sa@etb-identity-omnicanal.iam.gserviceaccount.com
export IMAGE_URI=${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO_NAME}/${SERVICE_NAME}
```

En Windows CMD:

```cmd
set PROJECT_ID=etb-identity-omnicanal
set REGION=us-east1
set ARTIFACT_REPO_NAME=idp-repo
set SERVICE_NAME=idp-service
set SERVICE_ACCOUNT=idp-service-sa@etb-identity-omnicanal.iam.gserviceaccount.com
set IMAGE_URI=%REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/%SERVICE_NAME%
```

## APIs e infraestructura base

Habilitar APIs si el proyecto es nuevo:

```bash
gcloud services enable \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  run.googleapis.com \
  secretmanager.googleapis.com \
  --project="${PROJECT_ID}"
```

Crear Artifact Registry si no existe:

```bash
gcloud artifacts repositories describe "${ARTIFACT_REPO_NAME}" \
  --location="${REGION}" \
  --project="${PROJECT_ID}" \
  || gcloud artifacts repositories create "${ARTIFACT_REPO_NAME}" \
    --repository-format=docker \
    --location="${REGION}" \
    --description="Registro de imagenes OIDC" \
    --project="${PROJECT_ID}"
```

La creacion y versionado de secretos no se documenta aqui para evitar duplicidad. Ver [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md#4-secret-manager).

## Build de imagen

El `Dockerfile` usa `node:22-alpine` en build y runtime porque el repo declara `pnpm@11.2.2`, version que requiere Node >= 22.13. No bajar la imagen base a Node 18/20 sin cambiar tambien `packageManager` y validar `pnpm install --frozen-lockfile` en Cloud Build.

Desde la raiz del repo:

```bash
gcloud builds submit \
  --tag="${IMAGE_URI}" \
  --project="${PROJECT_ID}"
```

Validar que la imagen exista:

```bash
gcloud artifacts docker images list \
  "${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO_NAME}" \
  --project="${PROJECT_ID}"
```

## Deploy de `idp-service`

Antes de desplegar, confirmar que la matriz de secretos y variables esperada esta definida en [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md#6-cloud-run---editar-idp-service).

Ejemplo minimo de deploy inicial:

```bash
gcloud run deploy "${SERVICE_NAME}" \
  --image="${IMAGE_URI}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --service-account="${SERVICE_ACCOUNT}" \
  --allow-unauthenticated \
  --set-env-vars=APP_MODE=IDP,NODE_ENV=production
```

Para un deploy productivo completo, usar la matriz de `--update-secrets` y `--update-env-vars` de la guia canonica. No copiar secretos como texto plano.

Obtener URL y revision:

```bash
gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format='value(status.latestReadyRevisionName,status.url)'
```

## Apuntamiento temporal a QA sobre `idp-service`

Uso exclusivo para ventanas de prueba controladas donde el mismo sitio publicado se apunta a MuleSoft QA y luego se revierte a produccion. No crear secretos con sufijo `_QA` en esta modalidad: los nombres runtime se mantienen iguales y se actualizan los valores montados en el servicio.

Antes de cambiar el apuntamiento, guardar una copia de la configuracion activa:

```bash
mkdir -p tmp/cloud-run-backups
gcloud run services describe "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --format=yaml > "tmp/cloud-run-backups/${SERVICE_NAME}-before-qa.yaml"
```

Actualizar Secret Manager con valores QA vigentes para los mismos Secret IDs que consume `idp-service`:

```text
MULESOFT_OAUTH_URL
MULESOFT_BASE_URL_MS1
MULESOFT_BASE_URL_MS2
MULESOFT_BASE_URL_MS3
MULESOFT_CLIENT_ID
MULESOFT_CLIENT_SECRET
MULESOFT_OAUTH_ACCOUNT_ID
```

Nota QA: el token service actual exige `client_id` y `client_secret` en el body, pero con valor vacio. Configurar `MULESOFT_OAUTH_CLIENT_ID` y `MULESOFT_OAUTH_CLIENT_SECRET` como variables literales vacias en Cloud Run; no montarlas desde secretos con valores no vacios. El BFF respeta esos vacios explicitos y solo usa fallback a `MULESOFT_CLIENT_ID` / `MULESOFT_CLIENT_SECRET` cuando la variable OAuth no existe.

Si MuleSoft confirma que un ambiente exige un header `Authorization` adicional para pedir el token, crear el secreto `MULESOFT_OAUTH_AUTHORIZATION_BEARER` y montarlo en una revision separada. No incluirlo en el despliegue base si el secreto no existe.

Endpoints QA esperados:

```text
MULESOFT_OAUTH_URL=https://oauth-etb-security-services-QA.us-e2.cloudhub.io:443/security/v1/access_token
MULESOFT_BASE_URL_MS1=https://customer-xapi-services-qa.us-e2.cloudhub.io:443
MULESOFT_BASE_URL_MS2=https://experience-xapi-services-qa.us-e2.cloudhub.io
MULESOFT_BASE_URL_MS3=https://experience-xapi-services-qa.us-e2.cloudhub.io
MULESOFT_ENABLE_MS4=false
```

Crear una nueva revision apuntada a QA:

```bash
gcloud run services update "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --service-account="${SERVICE_ACCOUNT}" \
  --remove-secrets='MULESOFT_OAUTH_CLIENT_ID,MULESOFT_OAUTH_CLIENT_SECRET,MULESOFT_OAUTH_AUTHORIZATION_BEARER' \
  --update-env-vars='APP_ENV=qa,APP_MODE=IDP,NODE_ENV=production,MULESOFT_ENABLE_MS4=false,MULESOFT_OAUTH_CLIENT_ID=,MULESOFT_OAUTH_CLIENT_SECRET=' \
  --update-secrets='MULESOFT_OAUTH_URL=MULESOFT_OAUTH_URL:latest,MULESOFT_BASE_URL_MS1=MULESOFT_BASE_URL_MS1:latest,MULESOFT_BASE_URL_MS2=MULESOFT_BASE_URL_MS2:latest,MULESOFT_BASE_URL_MS3=MULESOFT_BASE_URL_MS3:latest,MULESOFT_CLIENT_ID=MULESOFT_CLIENT_ID:latest,MULESOFT_CLIENT_SECRET=MULESOFT_CLIENT_SECRET:latest,MULESOFT_OAUTH_ACCOUNT_ID=MULESOFT_OAUTH_ACCOUNT_ID:latest'
```

Validar que el servicio no este usando simulacion:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="idp-service" AND resource.labels.location="us-east1" AND "MOCK MS-"' \
  --project="${PROJECT_ID}" \
  --limit=20 \
  --format='value(timestamp,textPayload,jsonPayload.message)'
```

Para volver a produccion, restaurar las versiones productivas de Secret Manager y crear una nueva revision con:

```bash
gcloud run services update "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --service-account="${SERVICE_ACCOUNT}" \
  --update-env-vars='APP_ENV=prod,APP_MODE=IDP,NODE_ENV=production,MULESOFT_ENABLE_MS4=false'
```

Confirmar despues de la reversa que `APP_ENV=prod`, que los secretos activos corresponden a produccion y que no quedan valores QA montados en `idp-service`.

## Cliente mock en Cloud Run

Uso exclusivo para pruebas de integracion controladas.

```bash
export MOCK_IMAGE_URI=${REGION}-docker.pkg.dev/${PROJECT_ID}/${ARTIFACT_REPO_NAME}/mock-client

gcloud builds submit \
  --tag="${MOCK_IMAGE_URI}" \
  --file=Dockerfile.mock \
  --project="${PROJECT_ID}"

gcloud run deploy mock-client \
  --image="${MOCK_IMAGE_URI}" \
  --platform=managed \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --allow-unauthenticated \
  --set-env-vars=APP_MODE=MOCK,VITE_IDP_URL=https://idp-service-2tczqvffra-ue.a.run.app
```

Luego agregar la URL del mock a `VITE_ALLOWED_ORIGINS` solo en QA/dev. La forma canonica de editar esa variable esta en [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md#62-editar-por-consola).

## Preview aislado para login OTP

Cuando se necesite probar el login `Codigo OTP` sin afectar el servicio publicado `idp-service`, usar servicios separados:

| Servicio | Uso |
| --- | --- |
| `idp-service-otp-preview` | IdP preview con SPA+BFF, MuleSoft real y Firebase/Auth real. |
| `mock-client-otp-preview` | Cliente OIDC de prueba que apunta al IdP preview. |

El script automatizado vigente es:

```bash
node scripts/deploy-isolated-cloudrun.mjs
```

Comportamiento esperado:

- Construye y despliega una imagen para `idp-service-otp-preview`.
- Construye y despliega `mock-client-otp-preview` con `Dockerfile.mock`.
- Configura el mock para redirigir al IdP preview.
- Configura `VITE_ALLOWED_ORIGINS` y `CORS_ALLOWED_ORIGINS` del IdP preview para aceptar el mock preview y el propio origen del IdP.
- No modifica el servicio `idp-service` ni su trafico.

Validaciones obligatorias despues de desplegar:

```bash
curl -fsS https://idp-service-otp-preview-2tczqvffra-ue.a.run.app/api/health
PUBLIC_BASE_URL=https://idp-service-otp-preview-2tczqvffra-ue.a.run.app pnpm run verify:public-config
PUBLIC_BASE_URL=https://mock-client-otp-preview-2tczqvffra-ue.a.run.app pnpm run verify:public-config
```

Configuracion GCP adicional del preview:

- Agregar dominios preview en Identity Platform `authorizedDomains`.
- Agregar dominios preview en HTTP referrers de la API key web de Firebase, incluyendo variante exacta y `/*`.
- Agregar dominios preview en la web key de reCAPTCHA.
- Confirmar que `idp-service-sa` puede emitir custom tokens; si aparece `iam.serviceAccounts.signBlob denied`, ver [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md#5-iam-para-la-service-account-de-cloud-run).
- Si MuleSoft QA requiere `MULESOFT_OAUTH_CLIENT_ID` o `MULESOFT_OAUTH_CLIENT_SECRET` vacios, configurar esas variables como valor literal vacio en el preview en lugar de montar secretos con valores no esperados por el token service.

Prueba funcional de cierre:

1. Abrir `mock-client-otp-preview`.
2. Iniciar OIDC hacia `idp-service-otp-preview`.
3. En la pestaña `Codigo OTP`, solicitar codigo para un correo ETB habilitado.
4. Ingresar el OTP mas reciente del correo.
5. Confirmar retorno al mock con `id_token`.
6. Revisar logs de `idp-service-otp-preview` y confirmar `mulesoft.ms2.response`, `mulesoft.ms3.response` y `login.otp.success`.

## Rollback

Listar revisiones:

```bash
gcloud run revisions list \
  --service="${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}"
```

Enviar todo el trafico a una revision anterior:

```bash
gcloud run services update-traffic "${SERVICE_NAME}" \
  --region="${REGION}" \
  --project="${PROJECT_ID}" \
  --to-revisions=REVISION_ANTERIOR=100
```

Tambien puede hacerse en consola:

```text
Menu > Cloud Run > idp-service > Revisions > Manage traffic
```

## Troubleshooting de deploy

| Sintoma | Causa probable | Accion |
| --- | --- | --- |
| `PERMISSION_DENIED` al ejecutar build/deploy | La cuenta no tiene permisos sobre Cloud Build, Artifact Registry, Cloud Run o service account. | Revisar `IAM & Admin > IAM` y los prerequisitos de este documento. |
| `Setting IAM policy failed` al permitir acceso publico | Politica de organizacion restringe `allUsers`. | Revisar `IAM & Admin > Organization Policies > Domain restricted sharing`. |
| Revision no queda `Ready` | Imagen no arranca, puerto incorrecto, env var faltante o secreto inaccesible. | Revisar logs de Cloud Run y validar matriz en [GCP_FIREBASE_PROD_CONFIGURATION.md](GCP_FIREBASE_PROD_CONFIGURATION.md#11-validacion-posterior-al-cambio). |
| Login falla despues del deploy | Configuracion Firebase/Auth, dominios, API key o `VITE_ALLOWED_ORIGINS`. | Revisar guia canonica de configuracion productiva. |
| Registro cae en mock o bypass | Faltan variables MuleSoft/reCAPTCHA reales. | Revisar secciones MuleSoft y reCAPTCHA de la guia canonica. |

Logs recientes:

```bash
gcloud logging read \
  'resource.type="cloud_run_revision" AND resource.labels.service_name="idp-service" AND resource.labels.location="us-east1" AND severity>=WARNING' \
  --project="${PROJECT_ID}" \
  --limit=50 \
  --format='value(timestamp,severity,textPayload,jsonPayload.message)'
```

## Dominios personalizados

Para produccion, evitar depender de URLs `*.run.app`.

Opcion Cloud Run custom domain:

```text
Menu > Cloud Run > Manage custom domains
```

1. Mapear el dominio corporativo al servicio `idp-service`.
2. Actualizar `Authorized domains`, API key referrers, OAuth origins/redirect URIs y `VITE_ALLOWED_ORIGINS` en la guia canonica.
3. Mantener URLs temporales solo en QA o durante ventana de migracion.

Opcion enterprise: Load Balancer + certificado gestionado + Cloud Armor. Esta opcion desacopla el dominio publico del servicio Cloud Run y permite WAF/politicas corporativas.
