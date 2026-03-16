# HU-03: Infraestructura base para despliegue (SA, Artifact Registry, Secret Manager)

**Estimación:** 3–4 jornadas  
**Dependencias:** HU-01  
**Prioridad:** Alta  

---

## Definición funcional

### Como
responsable de DevOps,

### quiero
tener creada la Service Account del IdP, el repositorio de imágenes Docker y los secretos de Firebase en Secret Manager con los permisos correctos,

### para que
el pipeline de build y despliegue pueda construir la imagen, subirla al registro y que Cloud Run lea las credenciales de forma segura sin hardcodear valores en el código.

### Criterios de aceptación (funcional)

- [ ] Existe una Service Account dedicada para el IdP (`idp-service-sa`) con los roles necesarios para Cloud Build (o el proceso de build), Artifact Registry y lectura de secretos.
- [ ] Existe un repositorio en Artifact Registry (formato Docker) en la región elegida para alojar la imagen del IdP.
- [ ] Los secretos `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN` y `FIREBASE_PROJECT_ID` existen en Secret Manager con las versiones correctas.
- [ ] La Service Account que ejecutará Cloud Run tiene permiso para acceder a esos secretos (Secret Accessor).

---

## Definición técnica

### Alcance

- Crear Service Account `idp-service-sa` y asignar roles: Logging, Storage (objectViewer), Artifact Registry Writer, Cloud Build Builder, Secret Manager Secret Accessor.
- Crear o reutilizar repositorio Artifact Registry (Docker) en la región de despliegue.
- Crear o actualizar secretos en Secret Manager y otorgar a `idp-service-sa` el rol `roles/secretmanager.secretAccessor`.

### Tareas técnicas

1. **Service Account**
   - Crear: `gcloud iam service-accounts create idp-service-sa --display-name="Identity Provider Service Account" --project=<PROJECT_ID>`.
   - Asignar roles al proyecto para `idp-service-sa@<PROJECT_ID>.iam.gserviceaccount.com`:
     - `roles/logging.logWriter`
     - `roles/storage.objectViewer`
     - `roles/artifactregistry.writer`
     - `roles/cloudbuild.builds.builder`
     - `roles/secretmanager.secretAccessor`
   - Esperar propagación IAM (aprox. 15–30 s) antes de usarla en Cloud Build.

2. **Artifact Registry**
   - Verificar/crear repositorio: `gcloud artifacts repositories create <ARTIFACT_REPO_NAME> --repository-format=docker --location=<REGION> --description="Registro de Imagenes OIDC" --project=<PROJECT_ID>`.
   - Si ya existe, solo validar con `gcloud artifacts repositories describe <ARTIFACT_REPO_NAME> --location=<REGION> --project=<PROJECT_ID>`.

3. **Secret Manager**
   - Crear o actualizar secretos (valores reales obtenidos de Firebase Console o GCP):
     - `FIREBASE_API_KEY`
     - `FIREBASE_AUTH_DOMAIN`
     - `FIREBASE_PROJECT_ID`
   - Crear: `echo -n "<valor>" | gcloud secrets create <NOMBRE> --data-file=- --project=<PROJECT_ID>`.
   - Actualizar: `echo -n "<valor>" | gcloud secrets versions add <NOMBRE> --data-file=- --project=<PROJECT_ID>`.
   - Asegurar que los valores no tengan espacios/saltos de línea al final (evita errores tipo "Illegal url for new iframe").

4. **Permisos de la SA para Secret Manager**
   - Binding: `gcloud projects add-iam-policy-binding <PROJECT_ID> --member="serviceAccount:idp-service-sa@<PROJECT_ID>.iam.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"`.

### Criterios de aceptación (técnicos)

- [ ] `gcloud iam service-accounts describe idp-service-sa@<PROJECT_ID>.iam.gserviceaccount.com` devuelve la SA.
- [ ] `gcloud artifacts repositories describe <ARTIFACT_REPO_NAME> --location=<REGION>` devuelve el repo.
- [ ] `gcloud secrets describe FIREBASE_API_KEY` (y los otros dos) existen y tienen al menos una versión.
- [ ] La política IAM del proyecto incluye a `idp-service-sa` con `roles/secretmanager.secretAccessor`.

### Referencias

- scripts/one-shot-deploy.cmd: Fase 1 (APIs, SA, Artifact Registry, Secret Manager, IAM).
- DEPLOY.md: §4 (Aprovisionamiento), gestión de secretos.
- CONFIGURACION-PASO-A-PASO.md: B.2 (variables), errores "Illegal url for new iframe".
