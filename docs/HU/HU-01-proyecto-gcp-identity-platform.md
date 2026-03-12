# HU-01: Preparación del proyecto GCP e Identity Platform

**Estimación:** 3–4 jornadas  
**Dependencias:** Ninguna  
**Prioridad:** Alta  

---

## Definición funcional

### Como
responsable de infraestructura / DevOps,

### quiero
tener el proyecto GCP listo y Identity Platform habilitado con autenticación Email/Password y dominios autorizados,

### para que
el IdP pueda autenticar usuarios contra un backend de identidad gestionado por GCP y el despliegue posterior no falle por falta de servicios o dominios.

### Criterios de aceptación (funcional)

- [ ] Existe un proyecto GCP con facturación habilitado y es el que se usará para el IdP.
- [ ] Las APIs necesarias para Cloud Build, Artifact Registry, Cloud Run, Secret Manager, Compute e IAM están habilitadas en el proyecto.
- [ ] Identity Platform está habilitado y el proveedor **Email/Password** está activo.
- [ ] Los dominios autorizados incluyen al menos `localhost` (desarrollo) y se documenta cómo agregar el dominio de Cloud Run tras el primer despliegue.
- [ ] El equipo tiene acceso con roles suficientes (Cloud Run Admin, Artifact Registry Admin, Secret Manager Admin o Accessor) y puede autenticarse con `gcloud`.

---

## Definición técnica

### Alcance

- Crear o seleccionar el proyecto GCP.
- Habilitar facturación y APIs requeridas.
- Habilitar Identity Platform y configurar el proveedor Email/Password.
- Configurar dominios autorizados (Firebase Console o Identity Platform > Configuración > Seguridad).
- Verificar permisos IAM del equipo y autenticación `gcloud`.

### Tareas técnicas

1. **Proyecto GCP**
   - Crear proyecto (o confirmar `PROJECT_ID` existente).
   - Vincular cuenta de facturación.
   - Configurar proyecto por defecto: `gcloud config set project <PROJECT_ID>`.

2. **Habilitar APIs**
   - Habilitar: `cloudbuild.googleapis.com`, `artifactregistry.googleapis.com`, `run.googleapis.com`, `secretmanager.googleapis.com`, `compute.googleapis.com`, `iam.googleapis.com`.
   - Comando de referencia (script): ver bloque "Habilitar APIs" en `scripts/one-shot-deploy.cmd`.

3. **Identity Platform**
   - Navegar a Identity Platform en consola GCP (o Firebase).
   - Habilitar Identity Platform si no está activo.
   - En **Providers**, agregar proveedor **Email/Password** y activar (Enabled).

4. **Dominios autorizados**
   - En **Firebase Console > Authentication > Settings > Authorized domains** (o **Identity Platform > Configuración > Seguridad > Dominios autorizados**).
   - Agregar `localhost` para desarrollo.
   - Documentar en runbook que tras el primer deploy de Cloud Run se debe agregar el dominio `idp-service-xxxxx-uc.a.run.app` (sin `https://`).

5. **IAM y acceso**
   - En **IAM & Admin > IAM**, verificar que las cuentas del equipo tengan al menos: Cloud Run Admin, Artifact Registry Admin, Secret Manager Admin (o Accessor).
   - Ejecutar `gcloud auth login` y validar que `gcloud projects describe <PROJECT_ID>` funciona.

### Criterios de aceptación (técnicos)

- [ ] `gcloud config get-value project` devuelve el `PROJECT_ID` correcto.
- [ ] `gcloud services list --enabled` incluye las APIs listadas arriba.
- [ ] En Identity Platform > Providers aparece Email/Password como habilitado.
- [ ] En Authorized domains aparece `localhost` (y se deja documentado el paso para agregar el dominio de Cloud Run después).

### Referencias

- CONFIGURACION-PASO-A-PASO.md: A.2 (Identity Platform), A.3.2 (Authorized domains).
- DEPLOY.md: §2 (Prerrequisitos), §4 (Aprovisionamiento – habilitar APIs).
