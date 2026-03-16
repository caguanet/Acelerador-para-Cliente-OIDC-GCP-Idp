# HU-06: Validación E2E, runbook y operación

**Estimación:** 3 jornadas  
**Dependencias:** HU-05  
**Prioridad:** Media-Alta  

---

## Definición funcional

### Como
responsable de operaciones / QA,

### quiero
tener documentación operativa, criterios de validación E2E y pasos de troubleshooting claros,

### para que
el equipo pueda verificar que el IdP en producción cumple el flujo OIDC de punta a punta, resolver incidencias frecuentes y realizar despliegues o cambios de configuración de forma repetible.

### Criterios de aceptación (funcional)

- [ ] Existe un runbook o checklist que describe: despliegue de una nueva versión (build + deploy), actualización de `VITE_ALLOWED_ORIGINS`, agregar un nuevo cliente/origen, y rotación de secretos en Secret Manager.
- [ ] Se ha ejecutado al menos una prueba E2E del flujo OIDC contra el entorno desplegado (IdP en Cloud Run + cliente de prueba o mock) y se documenta el resultado o los criterios de éxito.
- [ ] Los errores frecuentes (dominio no autorizado, referrer bloqueado, Token Service API, secretos con espacios) están documentados con causa y solución en un mismo lugar (p. ej. tabla de troubleshooting).
- [ ] Se deja documentado cómo desplegar solo Cloud Run cuando la imagen ya existe (script o pasos equivalentes a `deploy-cloudrun-only.cmd`).

---

## Definición técnica

### Alcance

- Redactar runbook con: despliegue completo (one-shot o manual), despliegue solo Cloud Run (imagen ya construida), actualización de orígenes y gestión de secretos.
- Ejecutar pruebas E2E contra la URL de Cloud Run (Playwright o manual con mock client) y documentar precondiciones y criterios de éxito.
- Recopilar en un único documento (o sección) la tabla de errores frecuentes y soluciones (CONFIGURACION-PASO-A-PASO y DEPLOY ya incluyen tablas; se puede referenciar o consolidar).
- Opcional: probar el script `scripts/deploy-cloudrun-only.cmd` y documentar cuándo usarlo (secretos e imagen ya listos).

### Tareas técnicas

1. **Runbook**
   - Sección "Despliegue completo": uso de `scripts/one-shot-deploy.cmd`, variables a editar, y pasos manuales posteriores (HU-05).
   - Sección "Despliegue solo Cloud Run": uso de `scripts/deploy-cloudrun-only.cmd` o comandos `gcloud run deploy` + `update-env-vars` cuando la imagen ya está en Artifact Registry.
   - Sección "Agregar nuevo cliente": actualizar `VITE_ALLOWED_ORIGINS` (Cloud Run), HTTP Referrers y OAuth origins si aplica; agregar dominio a Authorized domains si el cliente está en otro dominio.
   - Sección "Rotación de secretos": crear nueva versión en Secret Manager para FIREBASE_API_KEY / AUTH_DOMAIN / PROJECT_ID; opcionalmente crear nueva revisión de Cloud Run para forzar recarga de `:latest`.

2. **Validación E2E**
   - Configurar tests E2E (o escenario manual) con `VITE_IDP_URL` apuntando a la URL de Cloud Run.
   - Verificar: redirección al IdP, login, redirección de vuelta al cliente con `id_token` en el hash.
   - Documentar: URL del IdP, URL del cliente de prueba, usuario de prueba (si aplica), y resultado esperado (éxito o errores conocidos).

3. **Troubleshooting**
   - Tabla única con: mensaje/síntoma, causa probable, dónde revisar (consola GCP/Firebase), referencia a documento (CONFIGURACION-PASO-A-PASO, DEPLOY).
   - Incluir al menos: `auth/requests-from-referer-blocked`, `auth/unauthorized-domain`, "El dominio ... no está autorizado", login sin redirección con token (Token Service API), "Illegal url for new iframe", políticas de organización (Domain Restricted Sharing).

4. **Script deploy-cloudrun-only**
   - Probar en entorno de integración o staging.
   - Documentar: requisitos (secretos existentes, imagen ya en Artifact Registry), variables PROJECT_ID, REGION, ARTIFACT_REPO_NAME, y paso opcional de IAM (`allUsers` invoker si falla la política).

### Criterios de aceptación (técnicos)

- [ ] El runbook está en un archivo o carpeta conocido (p. ej. `docs/` o referenciado desde README/DEPLOY) y cubre los puntos anteriores.
- [ ] Se ha ejecutado al menos un flujo E2E contra el IdP en Cloud Run y el resultado está documentado.
- [ ] La tabla de troubleshooting está disponible y enlazada o integrada en la documentación de despliegue.
- [ ] `scripts/deploy-cloudrun-only.cmd` (o equivalente) está documentado con precondiciones y uso.

### Referencias

- CONFIGURACION-PASO-A-PASO.md: "Errores frecuentes y qué revisar".
- DEPLOY.md: §8 (Resolución de problemas), §9 (Políticas de organización).
- scripts/deploy-cloudrun-only.cmd: despliegue sin build ni gestión de secretos.
- TESTING.md: estrategia E2E y Playwright.
