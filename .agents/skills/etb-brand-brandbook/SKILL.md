---
name: etb-brand-brandbook
description: >-
  Applies ETB institutional visual and verbal identity from the Brandbook Manual de imagen —
  palettes, typography, narrative claim, logo misuse rules, tone matrix, UX copy discipline.
  Use when styling UI, creating or auditing React/HTML/CSS components, choosing colors or fonts,
  writing user-facing ETB messaging, illustrating layouts, ETB-themed themes, accessibility
  contrasts for brand blues, cobranding, or whenever the user mentions ETB brand, marca ETB,
  brandbook or Manual de imagen.
user-invocable: true
---

# Brandbook ETB (Manual de imagen)

## Alcance obligatorio

Antes de proponer o editar **estilos**, **tokens**, **temas**, **copys visibles**, **layouts con marca**, o **componentes** que puedan llevar marca ETB (o cuando el usuario indique despliegue/pantalla institucional ETB):

1. Leer el extracto consolidado **[reference/brandbook-extract.md](reference/brandbook-extract.md)** (fuente única en repo del manual; no depender del PDF en línea base).
2. Mantener compatibilidad con la arquitectura del producto: la SPA sigue siendo configurada por `window.APP_CONFIG` y [DESIGN.md](/DESIGN.md) / [README.md](/README.md). Los hex por defecto y el volcado a variables CSS están en [`src/config/theme.ts`](/src/config/theme.ts) (`ETB_BRAND_HEX`, `ETB_IDP_THEME_COLORS`, `applyThemeCssVars`). El brandbook orienta narrativa, uso de logo/claim y paleta; el mapeo técnico a `theme.colors` ↔ `--brand-*` está resumido al inicio de [reference/brandbook-extract.md](reference/brandbook-extract.md).
3. No inventar hex/RGB/marketing sensible no listados en el extracto: si falta un token, usar el más cercano de la paleta corporativa definida ahí y documentar en el cambio por qué, o solicitar aclaración al usuario.

## Complementos (orden sugerido)

| Contexto | Combinar con |
|---------|----------------|
| Diseño/UI detallado, jerarquía, craft | [.agents/skills/impeccable/SKILL.md](../impeccable/SKILL.md) — aplicar después de tener los límites de marca claros desde este skill. |
| Contrato técnico del producto · white-label genérico | [DESIGN.md](/DESIGN.md), [PRODUCT.md](/PRODUCT.md), [README.md](/README.md). |

## Principios ejecutables (recordatorio corto)

- **Narrativa "Creer / Crear":** comunicación cercana y optimista; mezcla emocional + funcional; datos verificables; evitar promesas absolutas sobre continuidad del servicio donde el manual lo prohíbe.
- **Identidad visual:** respetar logo y claim — sin deformar colores tipografía ni sombras; área de reserva según extracto.
- **UI digital:** garantizar contraste y legibilidad sobre fondos azules/nubes del sistema cuando se usen; iconografía línea simple; sistema de "ondas dinámicas" como recurso opcional abstracto — no saturar interfases densas tipo formulario/login.

Si el PDF oficial está disponible localmente pero no está en el repositorio, puede usarse solo para verificar discrepancias; ante conflicto entre PDF y este extracto archivado, **actualizar primero `reference/brandbook-extract.md` y el historial git** antes de código.
