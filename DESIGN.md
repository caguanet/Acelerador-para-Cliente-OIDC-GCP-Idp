# DESIGN (orientación para agentes y diseño)

Este archivo **no** sustituye el branding en tiempo de ejecución: logos, paleta aplicada en UI y mensajes siguen viniendo de `window.APP_CONFIG` descrito en [README.md](README.md).

Cuando la entrega debe alinearse con la identidad institucional **ETB** (temas institucionales, copys públicos marca, uso de paleta oficial), usar el skill [`.agents/skills/etb-brand-brandbook/SKILL.md`](.agents/skills/etb-brand-brandbook/SKILL.md) y la referencia persistente sin PDF en línea base: [`.agents/skills/etb-brand-brandbook/reference/brandbook-extract.md`](.agents/skills/etb-brand-brandbook/reference/brandbook-extract.md).

## Registro

**Product**: interfaz funcional del IdP (SPA de login/redirección), no página de marketing aislada.

## Principios

- Contraste suficiente en botones enlaces y errores para lectura rápida (WCAG razonable sin bloquear entregas triviales).
- Jerarquía clara entre título hero, llamada al login y estados error (evitar competir dos CTAs igual de fuertes).
- White-label primero: estilos base deben ceder paso al tema aplicado desde `APP_CONFIG.theme` sin depender de un color hardcode obligatorio más allá del fallback inicial.

## Fuentes y espacio

Por defecto se apoya en la cadena definida por el tema / CSS global del proyecto. Si falta marca explícita, preferir sistemas sistema-ui o stack ya presente en Vite/CSS existente antes de cargar nuevas familias.

## Movimiento

Mantener discreto: solo transiciones necesarias para modales/focus outline; ninguna animación que retrase feedback de login o errores críticos.

## Referencias

- [docs/architecture/TECH_README.md](docs/architecture/TECH_README.md) diagramas componentes/secuencias.
- [PRODUCT.md](PRODUCT.md) público objetivo y decisiones estratégicas.
