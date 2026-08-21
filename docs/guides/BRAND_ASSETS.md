# Activos de marca ETB en este repositorio

La guía central de branding ETB está en [BRANDING_ETB.md](BRANDING_ETB.md). Este documento cubre solo inventario y sincronización de activos.

## Archivos vectoriales usados en software

| Uso | Ruta | Notas |
| --- | --- | --- |
| IdP (tema por defecto) | `public/branding/default/logo.svg` | Wordmark en blanco para fondos oscuros / hero. |
| Referencia color | `img/ETB_Bogotá_logo.svg` | Variante en color (aprox. a manual). |
| Mock cliente OIDC (puerto 3000) | `mock-client/public/branding/etb-logo-white.svg` | Copia de `public/branding/default/logo.svg` para Vite con `root: mock-client`. |
| Mock cliente (fondos claros si se necesitan) | `mock-client/public/branding/etb-logo-color.svg` | Copia de `img/ETB_Bogotá_logo.svg`. |

### Tipografía en el mock cliente (`mock-client/index.html`)

Para acercarse al manual sin incrustar **Kobenhavn** (Adobe Fonts / licencia), la simulación en puerto **3000** usa **Lexend** vía Google Fonts, como primera alternativa corporativa recomendada en el extracto (§7) para piezas digitales operativas.

### Cuando actualicen el brandbook (export desde PDF o kit oficial)

1. Sustituir o regenerar `public/branding/default/logo.svg` y `img/ETB_Bogotá_logo.svg` con los entregables oficiales.
2. Volver a copiar a la carpeta del mock:

   ```bash
   cp public/branding/default/logo.svg mock-client/public/branding/etb-logo-white.svg
   cp img/ETB_Bogotá_logo.svg mock-client/public/branding/etb-logo-color.svg
   ```

3. Revisar reglas de uso (área libre, prohibiciones, claim, paleta) en [BRANDING_ETB.md](BRANDING_ETB.md) y luego sincronizar el extracto para agentes.

## Extracto operativo para agentes

Para agentes, el extracto técnico vive en:

- `.agents/skills/etb-brand-brandbook/reference/brandbook-extract.md`

Debe mantenerse alineado con [BRANDING_ETB.md](BRANDING_ETB.md) en el mismo PR cuando cambie branding.
