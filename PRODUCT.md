# PRODUCT (contexto para agentes y diseño)

Archivo orientado al **contexto de producto** en flujos con agentes (p. ej. skill impeccable). La personalización runtime de marca sigue definida como siempre por `window.APP_CONFIG` y los documentos públicos — ver [README.md](README.md).

## Propósito del producto

Proveedor de identidad **white‑label**, **OIDC** y **SPA stateless**, desplegable en GCP (Cloud Run), que actúa como **broker** entre **Identity Platform / Firebase Auth** y las aplicaciones cliente (partners/Relying Parties). Una sola instancia parametrizada sirve marca, orígenes permitidos y flujo de login según configuración sin recompilar.

## Tipos de usuario

- **Usuario final**: inicia sesión en el modal del IdP y es redirigido al cliente con fragmento `#id_token=…` conforme diseño documentado en [docs/architecture/TECH_README.md](docs/architecture/TECH_README.md).
- **Equipo del cliente (tenant)**: despliega y opera la instancia, configura branding y `allowedOrigins`.
- **Apps partner (consumidoras OIDC)**: registran cliente OIDC válido (`redirect_uri` permitido por whitelist de orígenes) y consumen JWT según política propia.

## Decisiones estratégicas actuales (no improvisar desde agentes)

- Implicit flow SPA según alcance técnico documentado; cambios protocolo requieren plan de producto/architectura y nueva documentación.
- Seguridad crítica: validación severa de orígenes y `redirect_uri` contra lista permitida antes de exponer cualquier estado de sesión susceptible de emitir token.

## Fuera del alcance de este archivo

- Paleta final y textos de campaña pueden seguir sólo por `APP_CONFIG`.
- Credenciales o secretos: únicamente variables de entorno / Secret Manager como en README y [docs/guides/DEPLOY.md](docs/guides/DEPLOY.md).
