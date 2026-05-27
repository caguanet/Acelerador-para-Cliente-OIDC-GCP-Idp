# Checklist de auditoría: callback OIDC del partner (launcher)

Usar esta lista al revisar integraciones como `callback.php` o páginas que reciben
`redirect_uri#id_token=...&state=...` tras el IdP ETB.

## Al recibir el retorno

- [ ] Leer **solo** `window.location.hash` (no query string).
- [ ] Extraer `id_token` y `state` con `URLSearchParams` sobre el fragmento.
- [ ] **No** registrar en logs la URL completa, el hash ni el JWT.
- [ ] Limpiar el fragmento de inmediato: `history.replaceState(null, '', pathname)`.

## Validación de `state` (CSRF)

- [ ] Generar `state` aleatorio al iniciar login hacia el IdP.
- [ ] Guardarlo en `sessionStorage` (o cookie) antes de redirigir al IdP.
- [ ] Al volver, comparar `state` del hash con el valor guardado.
- [ ] Rechazar el token si `state` no coincide.

## Validación del JWT (servidor)

- [ ] Verificar firma con claves públicas de Google / Identity Platform.
- [ ] Validar `aud` (proyecto Firebase), `iss`, `exp` y `sub`.
- [ ] No confiar solo en decodificar base64 en el navegador para autorizar APIs.
- [ ] Preferir intercambiar el `id_token` por sesión de servidor (cookie `HttpOnly`).

## Almacenamiento en el cliente

- [ ] Evitar `localStorage` para el JWT si existe backend que emita sesión propia.
- [ ] Si se usa almacenamiento temporal, acotar TTL y limpiar al cerrar sesión.
- [ ] No exponer el token en la UI (solo demo/mock).

## Seguridad del dominio del callback

- [ ] `redirect_uri` **fijo** en código por ambiente (no desde input del usuario).
- [ ] Content-Security-Policy estricta en la página de callback (mitigar XSS).
- [ ] Sin scripts de terceros que capturen URL o DOM en la página de retorno.
- [ ] HTTPS obligatorio en producción.

## Analytics y herramientas

- [ ] Desactivar captura de URL completa en GA, GTM, Hotjar, etc.
- [ ] No enviar el hash a herramientas de session replay.

## Errores OIDC en el fragmento

- [ ] Manejar `#error=login_required` (p. ej. `prompt=none` sin sesión IdP).
- [ ] Manejar `#error=server_error` con mensaje controlado al usuario.

## Referencias en este repositorio

- [IDP_LAUNCHER_IMPLEMENTATION.md](./IDP_LAUNCHER_IMPLEMENTATION.md) — contrato launcher / IdP.
- [../architecture/TECH_README.md](../architecture/TECH_README.md) — Implicit Flow y `allowedOrigins`.
