# HU-02: Configuración de credenciales y seguridad (API Key, OAuth)

**Estimación:** 3–4 jornadas  
**Dependencias:** HU-01  
**Prioridad:** Alta  

---

## Definición funcional

### Como
responsable de seguridad / DevOps,

### quiero
tener la API Key y las credenciales OAuth (si aplica) configuradas con restricciones de dominio y de API,

### para que
el IdP pueda llamar a Identity Toolkit y Token Service desde los dominios permitidos sin exponer credenciales a dominios no autorizados y, si se usa login con Google, el flujo OAuth funcione en desarrollo y luego en producción.

### Criterios de aceptación (funcional)

- [ ] La API Key del proyecto tiene restricciones de aplicación (Websites/HTTP Referrers) que incluyen los entornos de desarrollo (localhost) y se documenta cómo agregar la URL de Cloud Run tras el despliegue.
- [ ] La API Key tiene restricciones de API que permiten solo **Identity Toolkit API** y **Token Service API**.
- [ ] Si se usa el proveedor Google: el cliente OAuth 2.0 (Web) tiene configurados Authorized JavaScript origins y Authorized redirect URIs para desarrollo (y se documenta el paso para producción).
- [ ] No se almacenan secretos en código ni en el repositorio; se usa Secret Manager para valores sensibles en despliegue.

---

## Definición técnica

### Alcance

- Configurar la API Key (Browser key) con HTTP Referrers y API restrictions.
- Habilitar Identity Toolkit API y Token Service API en el proyecto.
- Opcional: configurar OAuth 2.0 Client ID para proveedor Google (origins y redirect URIs).
- Asegurar que los valores sensibles solo se usen vía variables de entorno/Secret Manager en despliegue.

### Tareas técnicas

1. **API Key (Google Auth Platform / APIs & Services > Credentials)**
   - Localizar la API Key de tipo "Browser key" (p. ej. "auto created by Firebase").
   - **Application restrictions > Websites:** agregar referrers:
     - `http://localhost:5173/*` (IdP dev),
     - `http://localhost:3000/*` (mock client E2E),
     - `http://localhost:8080/*` si aplica.
   - Documentar: tras el deploy, agregar `https://idp-service-xxxxx-uc.a.run.app/*`.
   - **API restrictions > Restrict key:** marcar **Identity Toolkit API** y **Token Service API**. Si no aparecen, habilitarlas en APIs & Services > Enabled APIs.

2. **OAuth 2.0 (solo si se usa proveedor Google)**
   - En Credentials, editar el OAuth 2.0 Client ID de tipo "Web application".
   - **Authorized JavaScript origins:** `http://localhost:5173`, `http://localhost:3000`.
   - **Authorized redirect URIs:** `http://localhost:5173/__/auth/handler`, `http://localhost:3000/__/auth/handler`.
   - Documentar: en producción agregar `https://idp-service-xxxxx-uc.a.run.app` y `https://idp-service-xxxxx-uc.a.run.app/__/auth/handler`.

3. **Secretos**
   - Confirmar que no hay API Key ni secrets en el código ni en el repo.
   - Los valores para producción se inyectarán vía Secret Manager (HU-03) y variables de entorno en Cloud Run.

### Criterios de aceptación (técnicos)

- [ ] En la API Key, Application restrictions = "Websites" con los referrers indicados.
- [ ] En la API Key, API restrictions incluyen Identity Toolkit API y Token Service API.
- [ ] Identity Toolkit API y Token Service API aparecen como habilitadas en el proyecto.
- [ ] Si se usa Google: OAuth Client tiene los origins y redirect URIs de desarrollo configurados.
- [ ] Búsqueda en repo de `AIzaSy` y de claves sensibles no devuelve resultados en código versionado.

### Referencias

- CONFIGURACION-PASO-A-PASO.md: A.3.1 (API Key), A.3.3 (OAuth 2.0).
- CONFIGURACION-PASO-A-PASO.md: tabla "Errores frecuentes" (auth/requests-from-referer-blocked, Token Service API).
