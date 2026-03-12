# HU-04: Build de imagen y despliegue del IdP en Cloud Run

**Estimación:** 3–4 jornadas  
**Dependencias:** HU-02, HU-03  
**Prioridad:** Alta  

---

## Definición funcional

### Como
responsable de DevOps / desarrollador,

### quiero
que la aplicación IdP se construya como imagen Docker y se despliegue en Cloud Run con las variables y secretos inyectados,

### para que
el IdP esté disponible en una URL HTTPS gestionada por GCP, sin servidores que administrar, y listo para la configuración de dominios y orígenes permitidos en la siguiente HU.

### Criterios de aceptación (funcional)

- [ ] La imagen del IdP se construye a partir del Dockerfile del proyecto (build multi-etapa: Vite + servidor Express) y se publica en Artifact Registry.
- [ ] El servicio Cloud Run `idp-service` está desplegado en la región definida, escuchando en el puerto 8080, con tráfico público (allow-unauthenticated) para permitir el flujo de login.
- [ ] Las credenciales de Firebase se inyectan desde Secret Manager (no en variables de entorno en texto plano).
- [ ] La variable `VITE_ALLOWED_ORIGINS` está configurada (puede ser un valor inicial; se refina en HU-05).
- [ ] El endpoint `/api/health` responde correctamente y la raíz sirve la aplicación de login.

---

## Definición técnica

### Alcance

- Ejecutar Cloud Build (o build local y push) para construir la imagen desde el `Dockerfile` y subirla a `REGION-docker.pkg.dev/PROJECT_ID/ARTIFACT_REPO_NAME/idp-service`.
- Desplegar en Cloud Run con la imagen, Service Account `idp-service-sa`, variables de entorno (`APP_MODE=IDP`, `VITE_ALLOWED_ORIGINS`) y secretos mapeados a variables (`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`).
- Opcional: actualizar `VITE_ALLOWED_ORIGINS` con la URL del propio servicio (self-reference) tal como hace `one-shot-deploy.cmd`.

### Tareas técnicas

1. **Cloud Build**
   - Usar `gcloud builds submit` con config que construya la imagen y la empuje al Artifact Registry.
   - Ejemplo de sustitución: `_REGION`, `_PROJECT_ID`, `_ARTIFACT_REPO_NAME`.
   - Especificar `--service-account=idp-service-sa@<PROJECT_ID>.iam.gserviceaccount.com` si se usa SA dedicada para el build.
   - Asegurar que el Dockerfile multi-etapa (builder + runner) y el contexto de build (raíz del proyecto) son los correctos.

2. **Despliegue Cloud Run**
   - `gcloud run deploy idp-service --image <IMAGE_URL> --platform managed --region <REGION> --service-account idp-service-sa@<PROJECT_ID>.iam.gserviceaccount.com --allow-unauthenticated --set-env-vars APP_MODE=IDP --set-env-vars "VITE_ALLOWED_ORIGINS=..." --set-secrets VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest ...` (y análogo para AUTH_DOMAIN y PROJECT_ID).
   - Separador de orígenes en `VITE_ALLOWED_ORIGINS`: `|` (pipe). En CMD escapar con `^|`.

3. **Post-deploy (opcional en esta HU)**
   - Obtener URL: `gcloud run services describe idp-service --region <REGION> --format="value(status.url)"`.
   - Actualizar revisión con `VITE_ALLOWED_ORIGINS` incluyendo esa URL y `http://localhost:3000` si se usa mock client.

### Criterios de aceptación (técnicos)

- [ ] La imagen existe en Artifact Registry: `gcloud artifacts docker images list REGION-docker.pkg.dev/PROJECT_ID/ARTIFACT_REPO_NAME`.
- [ ] `gcloud run services describe idp-service --region <REGION>` muestra estado OK y la URL del servicio.
- [ ] `curl -s <SERVICE_URL>/api/health` devuelve el mensaje de salud esperado.
- [ ] Abrir `<SERVICE_URL>` en navegador muestra la UI del IdP (puede fallar el login hasta completar HU-05).
- [ ] En la revisión del servicio, las variables de entorno incluyen `APP_MODE` y `VITE_ALLOWED_ORIGINS`; los secretos están mapeados y la SA es `idp-service-sa`.

### Referencias

- Dockerfile (raíz del proyecto): builder Node 18 Alpine, runner con server Express en puerto 8080.
- server/server.js: endpoint `/config.js` que expone `allowedOrigins` y `firebase` desde env.
- scripts/one-shot-deploy.cmd: Fase 2 (Cloud Build, Cloud Run deploy, actualización VITE_ALLOWED_ORIGINS).
- DEPLOY.md: §5 (Pipeline de despliegue).
