# HU-05: Integración y configuración post-despliegue (dominios, orígenes, login)

**Estimación:** 3–4 jornadas  
**Dependencias:** HU-04  
**Prioridad:** Alta  

---

## Definición funcional

### Como
responsable de DevOps / integrador,

### quiero
completar la configuración de Identity Platform, API Key y OAuth con la URL de producción del IdP, y dejar definidos los orígenes permitidos para redirección OIDC,

### para que
un usuario pueda iniciar sesión desde la URL de Cloud Run sin errores de dominio no autorizado ni de referrer bloqueado, y los clientes OIDC autorizados puedan redirigir al IdP y recibir el token en el hash.

### Criterios de aceptación (funcional)

- [ ] El dominio del servicio Cloud Run (ej. `idp-service-xxxxx-uc.a.run.app`) está en la lista de dominios autorizados de Firebase/Identity Platform.
- [ ] La API Key tiene en HTTP Referrers la URL de producción del IdP (`https://idp-service-xxxxx-uc.a.run.app/*`).
- [ ] Si se usa Google: el cliente OAuth tiene como Authorized JavaScript origin y Authorized redirect URI la URL de producción del IdP.
- [ ] La variable `VITE_ALLOWED_ORIGINS` del servicio Cloud Run incluye la URL del propio IdP y las URLs de los clientes que redirigirán al IdP (incluyendo mock/clientes de prueba si aplica).
- [ ] Se verifica un flujo de login completo: acceso a la URL del IdP → login Email/Password → redirección con `id_token` en el hash (o mensaje de error claro si el cliente no está en la whitelist).

---

## Definición técnica

### Alcance

- Agregar el dominio de Cloud Run a Authorized domains (Firebase o Identity Platform).
- Actualizar la API Key con el referrer de producción.
- Actualizar OAuth 2.0 (origins y redirect URIs) si se usa proveedor Google.
- Actualizar la variable de entorno `VITE_ALLOWED_ORIGINS` en Cloud Run (separador `|`) con la URL del IdP y los clientes permitidos.
- Ejecutar smoke test de login y, si hay mock client desplegado, prueba de flujo OIDC completo.

### Tareas técnicas

1. **Authorized domains**
   - Firebase Console > Authentication > Settings > Authorized domains > Add domain.
   - O: Identity Platform > Configuración > Seguridad > Dominios autorizados > Agregar un dominio.
   - Valor: dominio del servicio sin `https://` (ej. `idp-service-xxxxx-uc.a.run.app`).

2. **API Key**
   - Google Auth Platform > Clients > (API Key) > Application restrictions > Websites.
   - Agregar `https://idp-service-xxxxx-uc.a.run.app/*` (sustituir por la URL real).
   - Verificar que API restrictions sigue incluyendo Identity Toolkit API y Token Service API.

3. **OAuth 2.0 (si aplica)**
   - Authorized JavaScript origins: `https://idp-service-xxxxx-uc.a.run.app`.
   - Authorized redirect URIs: `https://idp-service-xxxxx-uc.a.run.app/__/auth/handler`.

4. **VITE_ALLOWED_ORIGINS**
   - Obtener URL: `gcloud run services describe idp-service --region <REGION> --format="value(status.url)"`.
   - Actualizar servicio: `gcloud run services update idp-service --region <REGION> --update-env-vars "VITE_ALLOWED_ORIGINS=<URL_IDP>|https://cliente1.com|http://localhost:3000"` (ajustar clientes).
   - En CMD usar `^|` para el pipe.

5. **Smoke test**
   - Abrir la URL del IdP en navegador.
   - Iniciar sesión con un usuario de prueba (Email/Password).
   - Verificar que no aparezcan `auth/unauthorized-domain` ni `auth/requests-from-referer-blocked`.
   - Si se prueba con un cliente: redirigir con `client_id`, `redirect_uri`, `response_type=id_token`, `nonce` y comprobar que la redirección de vuelta incluye `#id_token=...`.

### Criterios de aceptación (técnicos)

- [ ] El dominio de Cloud Run aparece en Authorized domains (Firebase o Identity Platform).
- [ ] La API Key incluye el referrer de producción; no hay errores de referrer en consola del navegador.
- [ ] Si se usa Google: OAuth tiene origin y redirect URI de producción.
- [ ] Cloud Run > idp-service > Edit & Deploy New Revision > Variables: `VITE_ALLOWED_ORIGINS` contiene la URL del IdP y los clientes necesarios.
- [ ] Login con Email/Password desde la URL de Cloud Run termina en redirección con token o en pantalla de error controlada (p. ej. redirect_uri no permitido), sin errores de dominio/referrer.

### Referencias

- CONFIGURACION-PASO-A-PASO.md: B.4 (Pasos manuales obligatorios), B.4 Paso 4 (VITE_ALLOWED_ORIGINS).
- DEPLOY.md: §6 (Configuración post-despliegue).
- README: flujo OIDC (redirect_uri, validación allowedOrigins).
