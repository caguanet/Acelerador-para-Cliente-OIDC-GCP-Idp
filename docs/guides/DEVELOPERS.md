# Guía del Desarrollador (Quick-Start)

Referencia rápida para configurar el entorno y ejecutar el proyecto.
Para instrucciones detalladas con capturas de pantalla y navegación exacta en GCP, ver [CONFIGURACION-PASO-A-PASO.md](CONFIGURACION-PASO-A-PASO.md).

---

## Requisitos Previos

| Herramienta | Verificar |
| ----------- | --------- |
| Node.js v18+ | `node -v` |
| npm | `npm -v` |
| Git | `git --version` |
| Proyecto GCP con Identity Platform habilitado | [Guía completa → A.2](CONFIGURACION-PASO-A-PASO.md) |

---

## Configuración GCP (Paso Crítico)

Antes de ejecutar el proyecto localmente, configure la API Key en GCP (`APIs & Services > Credentials`):

1. **HTTP Referrers:** Agregue `http://localhost:5173/*` y `http://localhost:3000/*`
2. **API Restrictions:** Habilite explícitamente:
   - `Identity Toolkit API` (login/registro)
   - `Token Service API` (emisión del `id_token`)

> [!WARNING]
> Sin **Token Service API**, el IdP no puede emitir el `id_token` final aunque el login parezca exitoso.

→ Ver pasos detallados en [CONFIGURACION-PASO-A-PASO.md § A.3](CONFIGURACION-PASO-A-PASO.md)

---

## Configuración Local

```bash
git clone <URL_DEL_REPOSITORIO>
cd Acelerador-para-Cliente-OIDC-GCP-Idp
npm install
```

Crear `.env.local` en la raíz:

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=mi-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mi-proyecto
VITE_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

→ Ver cómo obtener cada valor en [CONFIGURACION-PASO-A-PASO.md § A.5](CONFIGURACION-PASO-A-PASO.md)

---

## Comandos de Desarrollo

| Comando | Descripción |
| ------- | ----------- |
| `npm run dev` | IdP en `http://localhost:5173` |
| `npm run dev:simulation` | IdP (5173) + Mock Client (3000) — requerido para E2E |
| `npm run build` | Build de producción |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test -- --watch` | Unitarias en modo watch |
| `npm run test:e2e` | E2E con Playwright (requiere `dev:simulation`) |
| `npm run test:e2e:ui` | E2E con interfaz visual para depuración |

> Primera vez con Playwright: `npx playwright install`

---

## Personalización de Marca (White-Label)

**Sin recompilar** — editar `public/config.js`:

```javascript
window.APP_CONFIG = {
    theme: {
        brandName: "Mi Empresa",
        colors: { primary: "#FF0000" }
    }
};
```

**Prueba rápida en navegador** — pegar en consola y recargar:

```javascript
window.APP_CONFIG = { theme: { brandName: "Prueba", colors: { primary: "#ff0000" } } };
location.reload();
```

**Con recompilación** — editar variables CSS en `src/index.css` (`:root`) y reemplazar logo en `public/branding/default/logo.svg`.

→ Ver referencia completa de `APP_CONFIG` en [CONFIGURACION-PASO-A-PASO.md § A.6](CONFIGURACION-PASO-A-PASO.md)
