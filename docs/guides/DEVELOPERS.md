# Guía del Desarrollador (Quick-Start)

Referencia rápida para configurar el entorno y ejecutar el proyecto.
Para instrucciones detalladas con capturas de pantalla y navegación exacta en GCP, ver [CONFIGURACION-PASO-A-PASO.md](CONFIGURACION-PASO-A-PASO.md).

---

## Requisitos Previos

| Herramienta | Verificar |
| ----------- | --------- |
| Node.js v18+ | `node -v` |
| pnpm | `pnpm -v` |
| Git | `git --version` |
| Proyecto GCP con Identity Platform habilitado | [Guía completa → A.2](CONFIGURACION-PASO-A-PASO.md) |

---

## Configuración GCP (Paso Crítico)

Antes de ejecutar el proyecto localmente, configure la API Key en GCP (`APIs & Services > Credentials`):

1. **HTTP Referrers:** Agregue `http://localhost:5173/*`, `http://localhost:3000/*` y el dominio de Auth `https://<PROJECT_ID>.firebaseapp.com/*`
2. **API Restrictions:** Habilite explícitamente:
   - `Identity Toolkit API` (login/registro)
   - `Token Service API` (emisión del `id_token`)

> [!WARNING]
> Sin **Token Service API**, el IdP no puede emitir el `id_token` final aunque el login parezca exitoso.

> [!IMPORTANT]
> Los enlaces passwordless/email action de Firebase se abren primero en `https://<PROJECT_ID>.firebaseapp.com/__/auth/action`. Si la API Key solo permite `localhost`, Firebase mostrará `API_KEY_HTTP_REFERRER_BLOCKED` para el referrer `https://<PROJECT_ID>.firebaseapp.com/`.

→ Ver pasos detallados en [CONFIGURACION-PASO-A-PASO.md § A.3](CONFIGURACION-PASO-A-PASO.md)

---

## Configuración Local

```bash
git clone <URL_DEL_REPOSITORIO>
cd Acelerador-para-Cliente-OIDC-GCP-Idp
pnpm install
```

Crear `.env.local` en la raíz:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=mi-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mi-proyecto
VITE_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# Opcional — E2E (usuario que exista en Firebase Auth del mismo proyecto)
TEST_USER_EMAIL=usuario-prueba@ejemplo.com
TEST_USER_PASSWORD=contraseña-segura
```

El archivo está en `.gitignore` (patrón `.env.*`); no lo subas al repositorio. **Vite** carga `.env.local` en `pnpm run dev` / build. **Playwright** también lo carga (después de `.env`, con prioridad para claves repetidas) para `pnpm run test:e2e`.

→ Ver cómo obtener cada valor en [CONFIGURACION-PASO-A-PASO.md § A.5](CONFIGURACION-PASO-A-PASO.md)

---

## Comandos de Desarrollo

| Comando | Descripción |
| ------- | ----------- |
| `pnpm run dev` | IdP en `http://localhost:5173` |
| `pnpm run dev:simulation` | IdP (5173) + Mock Client (3000) — requerido para E2E |
| `pnpm run build` | Build de producción |
| `pnpm test` | Pruebas unitarias (Vitest) |
| `pnpm run test -- --watch` | Unitarias en modo watch |
| `pnpm run test:e2e` | E2E con Playwright (requiere `dev:simulation`) |
| `pnpm run test:e2e:ui` | E2E con interfaz visual para depuración |

> Primera vez con Playwright: `pnpm exec playwright install`

---

## Personalización de Marca (White-Label)

**Sin recompilar** — editar `public/config.js` (se carga antes del bundle). En arranque, `src/main.tsx` llama a `applyThemeCssVars(themeConfig)` y vuelca `theme.colors` a `--brand-*` en `:root`.

Defaults y preset ETB IdP: `src/config/theme.ts` (`ETB_IDP_THEME_COLORS`, `ETB_APP_THEME_PRESET`). La referencia central de mapeo y gobernanza de marca está en [BRANDING_ETB.md](BRANDING_ETB.md).

```javascript
window.APP_CONFIG = {
    theme: {
        brandName: "Mi Empresa",
        colors: { primary: "#214780", secondary: "#0092bc" },
    },
};
```

**Recarga completa** tras cambiar tema (`location.reload()`); no se re-aplica en caliente tras el primer `main.tsx`.

```javascript
location.reload();
```

**Con recompilación** — defaults en `src/config/theme.ts` y/o `:root` en `src/index.css`; logo en `public/branding/default/logo.svg`.

→ Ver referencia completa de `APP_CONFIG` en [CONFIGURACION-PASO-A-PASO.md § A.6](CONFIGURACION-PASO-A-PASO.md)
