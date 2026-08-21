# Guía de Branding ETB (Fuente central)

Guía centralizada para aplicar identidad ETB en este repositorio con criterios de diseño, implementación runtime y gobernanza documental.

---

## 1) Alcance y fuente de verdad

- Esta guía es la referencia principal de branding ETB dentro de `docs/`.
- El PDF del manual puede existir localmente, pero la base operativa versionada vive aquí.
- Para agentes, el skill `etb-brand-brandbook` consume un extracto técnico que debe mantenerse alineado con esta guía.

Referencias relacionadas:

- [BRAND_ASSETS.md](BRAND_ASSETS.md)
- [DEVELOPERS.md](DEVELOPERS.md)
- [DESIGN.md](../../DESIGN.md)

---

## 2) Principios de marca aplicados al producto

- **Narrativa:** equilibrio emocional + funcional (creer/crear), tono cercano y claro.
- **Legibilidad:** priorizar contraste en botones, focos, alertas y textos sobre fondos azules.
- **Consistencia:** evitar cambios ad-hoc de logo, claim, tipografía o paleta sin actualización documental.
- **White-label compatible:** la app sigue gobernada por `window.APP_CONFIG`; ETB es un preset institucional.

---

## 3) Implementación técnica (runtime theme)

### 3.1 Fuente técnica

Implementación canónica en `src/config/theme.ts`:

- `ETB_BRAND_HEX`
- `ETB_IDP_THEME_COLORS`
- `ETB_APP_THEME_PRESET`
- `applyThemeCssVars(themeConfig)`

Aplicación en arranque: `src/main.tsx`.

### 3.2 Mapeo `theme.colors` → variables CSS

| `theme.colors.*` | Variable CSS | Default repo | Uso |
| --- | --- | --- | --- |
| `primary` | `--brand-primary` | `#214780` | Tipografía principal y hover de acción |
| `secondary` | `--brand-secondary` | `#0092bc` | Botón primario, foco e interacción |
| `accent` | `--brand-accent` | `#00E5FF` | Acentos visuales |
| `background` | `--brand-bg` | `#F8F9FB` | Fondo de app |
| `text` | `--brand-text` | `#080707` | Texto principal |
| `textSecondary` | `--brand-text-secondary` | `#515151` | Texto secundario |
| `action` | `--brand-action` | `#d86055` | CTA/énfasis de contraste |
| `cardBackground` | `--brand-card-bg` | `#fafafa` | Superficie de tarjeta/campos |
| `heroGradientStart` | `--brand-hero-gradient-start` | `#004b90` | Inicio gradiente hero móvil |
| `heroGradientEnd` | `--brand-hero-gradient-end` | `#0092bc` | Fin gradiente hero móvil |

Variables derivadas:

- `--brand-primary-rgb`
- `--brand-secondary-rgb`

Uso recomendado: sombras/overlays con `rgba(var(--brand-*-rgb), alpha)` en vez de RGB hardcodeado.

---

## 4) Activos y tipografía

- Activos SVG y sincronización del mock: ver [BRAND_ASSETS.md](BRAND_ASSETS.md).
- Tipografía operativa actual: Lexend/Lexend Deca.
- Si cambia la política tipográfica institucional, actualizar esta guía y `index.html`/CSS en el mismo PR.

---

## 5) Flujo de cambio (estándar de industria)

Cuando se modifique branding ETB:

1. Actualizar implementación (`theme.ts`, `index.css`, `config.js` si aplica).
2. Ejecutar pruebas (`pnpm run test` mínimo).
3. Actualizar documentación en `docs/` (esta guía + `BRAND_ASSETS.md`/`DEVELOPERS.md` si afecta operación).
4. Sincronizar extracto para agentes:
   - `.agents/skills/etb-brand-brandbook/reference/brandbook-extract.md`
5. Incluir en PR:
   - motivo del cambio,
   - mapeo afectado,
   - impacto visual esperado.

---

## 6) Gobernanza y responsabilidades

- **Canónico para humanos:** `docs/guides/BRANDING_ETB.md` (este archivo).
- **Canónico para agentes:** extracto del skill (debe reflejar esta guía).
- **Cambio de manual oficial ETB:** requiere actualización de ambos artefactos en el mismo ciclo.

Si hay discrepancia entre documentos:

1. Esta guía (`docs/guides/BRANDING_ETB.md`)
2. Código en `src/config/theme.ts`
3. Extracto del skill
