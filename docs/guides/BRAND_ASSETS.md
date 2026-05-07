# Activos de marca ETB en este repositorio

La **fuente normativa** del logotipo y la identidad es el **Manual de imagen (Brandbook)** en PDF en la raíz del proyecto (`Manual de imagen (Brandbook).pdf`). Mantén ese archivo actualizado cuando Comunicaciones entregue nueva versión.

## Archivos vectoriales usados en software

| Uso | Ruta | Notas |
|-----|------|--------|
| IdP (tema por defecto) | `public/branding/default/logo.svg` | Wordmark en blanco para fondos oscuros / hero. |
| Referencia color | `img/ETB_Bogotá_logo.svg` | Variante en color (aprox. a manual). |
| Mock cliente OIDC (puerto 3000) | `mock-client/public/branding/etb-logo-white.svg` | Copia de `public/branding/default/logo.svg` para Vite con `root: mock-client`. |
| Mock cliente (fondos claros si se necesitan) | `mock-client/public/branding/etb-logo-color.svg` | Copia de `img/ETB_Bogotá_logo.svg`. |

### Cuando actualicen el brandbook (export desde PDF o kit oficial)

1. Sustituir o regenerar `public/branding/default/logo.svg` y `img/ETB_Bogotá_logo.svg` con los entregables oficiales.
2. Volver a copiar a la carpeta del mock:
   ```bash
   cp public/branding/default/logo.svg mock-client/public/branding/etb-logo-white.svg
   cp img/ETB_Bogotá_logo.svg mock-client/public/branding/etb-logo-color.svg
   ```
3. Revisar reglas de **área libre** y **prohibiciones** en `.agents/skills/etb-brand-brandbook/reference/brandbook-extract.md` (no deformar, sin sombras no aprobadas, etc.).

## Extracto operativo para agentes

Para decisiones rápidas de color, claim y tono sin abrir el PDF: `/.agents/skills/etb-brand-brandbook/reference/brandbook-extract.md`.
