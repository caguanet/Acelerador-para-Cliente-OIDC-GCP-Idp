# Guía para agentes de IA en este repositorio

Este documento **prioriza** la arquitectura y convenciones **de este producto** frente a skills genéricos instalados en `.agents/skills/`. Si un skill contradice lo indicado aquí o en los documentos enlazados, **gana el repo**.

## Fuente de verdad (leer antes de diseñar o implementar auth)

| Documento | Uso |
|-----------|-----|
| [README.md](README.md) | Visión del producto, branding en runtime, variables sensibles |
| [docs/architecture/TECH_README.md](docs/architecture/TECH_README.md) | Arquitectura IdP/OIDC, flujos implícitos, seguridad de `redirect_uri`, despliegue |
| [docs/guides/DEVELOPERS.md](docs/guides/DEVELOPERS.md) | Setup local, APIs de GCP, comandos de prueba |
| [docs/guides/DEPLOY.md](docs/guides/DEPLOY.md) | Producción Cloud Run |
| [docs/testing/TESTING.md](docs/testing/TESTING.md) | Estrategia de calidad |
| [PRODUCT.md](PRODUCT.md) | Contexto de producto para agentes/UI (no reemplaza `APP_CONFIG`) |
| [DESIGN.md](DESIGN.md) | Principios de UI accesorio al white-label runtime |
| [docs/guides/BRANDING_ETB.md](docs/guides/BRANDING_ETB.md) | Guía central de branding ETB en `docs/` (paleta, mapeo runtime, gobernanza y flujo de cambios). |
| [docs/guides/UX_STANDARDS.md](docs/guides/UX_STANDARDS.md) | Estándar UX-first del proyecto: mensajes amigables, intuitividad, performance y seguridad en UI. |
| [docs/guides/BRAND_ASSETS.md](docs/guides/BRAND_ASSETS.md) | Rutas de logotipos SVG, mock `public/branding/` y cómo resincronizar tras actualizar el **Manual de imagen (Brandbook).pdf** |
| [`.agents/skills/etb-brand-brandbook/reference/brandbook-extract.md`](.agents/skills/etb-brand-brandbook/reference/brandbook-extract.md) | Resumen técnico para agentes; debe mantenerse alineado con `docs/guides/BRANDING_ETB.md`. |

**Dominio concreto:** Identity broker OIDC sobre **Firebase Auth / GCP Identity Platform**, SPA **stateless**, configuración por `window.APP_CONFIG`. En [docs/architecture/TECH_README.md](docs/architecture/TECH_README.md) se documenta explícitamente el **OIDC Implicit Flow** y las razones por las que PKCE/backend stateful **no forman parte del diseño actual**. No sustituir eso por ejemplos genéricos (p. ej. Authorization Code + PKCE con servidor Next.js) sin un cambio de arquitectura acordado y actualización de la documentación.

## Stack y comandos oficiales

- **Runtime:** Node 18+, **npm** (no usar Bun/pnpm como suposición por defecto en snippets).
- **Frontend:** React **18**, Vite **4**, TypeScript **5**.
- **Datos/auth cliente:** Firebase JS SDK (~10.x) según `package.json`.

**Pruebas y build:**

```bash
npm install
npm run dev
npm run build
npm run test              # Vitest (unit/integration de componentes)
npm run test:e2e          # Playwright E2E
npm run test:e2e:ui       # Playwright con UI
```

Para patrones Playwright locales, usar la configuración de [playwright.config.ts](playwright.config.ts) y rutas en `tests/`.

### React

El skill **react-dev** en `.agents/skills/` incluye material orientado a **React 19**. En este repo **solo se usan APIs compatibles con React 18** hasta que exista migración explícita y actualización de dependencias.

## Matriz skill → uso (prioridad)

Usar **un skill principal por tarea**; el resto como apoyo opcional para no mezclar instrucciones contradictorias.

| Tarea del agente | Skill principal | Notas |
|------------------|-----------------|--------|
| Cambios OAuth/OIDC, integración cliente, tokens, redirects | `.agents/skills/oauth2-oidc-implementer/` | Aterrizar siempre contra [docs/architecture/TECH_README.md](docs/architecture/TECH_README.md); no imponer PKCE/backend si el objetivo es la SPA IdP actual. |
| Firebase / Identity Toolkit / reglas de cliente | `.agents/skills/firebase-auth-basics/` | Distinguir Identity Platform corporativa vs tutorial genérico; ver APIs en [docs/guides/DEVELOPERS.md](docs/guides/DEVELOPERS.md). |
| Despliegue, contenedores, Cloud Run | `.agents/skills/gcp-cloud-run/` | Aplicar solo cuando se toca infra Docker/Cloud Run; este árbol es sobre todo SPA — no asumir Express en `src/` sin comprobar. |
| Checklist rápido de seguridad en código/secrets/input | `.agents/skills/security-review/` | |
| Modelado de amenazas, STRIDE, auditorías formales | `.agents/skills/security-threat-model/` | Complementario a security-review para diseño/revisiones grandes. |
| Tests unit/componentes con Vitest y RTL | `.agents/skills/vitest-testing-patterns/` | Comando canónico: `npm run test`. |
| E2E, proyectos navegador, timeouts, trazas | `.agents/skills/playwright-testing/` | Comando canónico: `npm run test:e2e`. |
| Visión amplia (pirámide, flaky, release, herramientas extra) | `.agents/skills/web-testing/` | **No** como default en cada cambio pequeño; consultar cuando el alcance sea estrategia o release global. |
| Refactor TS, olores | `.agents/skills/typescript-refactoring/` | |
| Estilos, componentes UI, paleta/copy con marca ETB, temas institucionales | `.agents/skills/etb-brand-brandbook/` | Leer el extract en `reference/brandbook-extract.md`; coherentar con [DESIGN.md](DESIGN.md) y tema `APP_CONFIG` para white‑label. |
| Mejoras UX/UI, manejo de errores para usuario final, microcopy y claridad de interacción | `.agents/skills/impeccable/` | Debe respetar [docs/guides/UX_STANDARDS.md](docs/guides/UX_STANDARDS.md) y no exponer mensajes técnicos crudos en UI. |

**Solape:** `web-testing` agrupa contenido también cubierto por `playwright-testing` y `vitest-testing-patterns`. En caso de conflicto, mandan esta tabla y los scripts del `package.json`.

## Diseño UX/UI (skill impeccable)

`.agents/skills/impeccable/` exige contexto (`PRODUCT.md`, `DESIGN.md`, flujo `shape`/`craft`). Existe **[PRODUCT.md](PRODUCT.md)** mínimo con propósito y usuarios; **DESIGN.md** sigue siendo opcional: si falta, usar `impeccable document` según [.agents/skills/impeccable/SKILL.md](.agents/skills/impeccable/SKILL.md) o briefings explícitos del equipo.

Cuando la pieza sea **marcada institucionalmente como ETB** (o lo pida explícitamente el usuario / la instancia), cargar antes o en paralelo el skill [.agents/skills/etb-brand-brandbook/SKILL.md](.agents/skills/etb-brand-brandbook/SKILL.md) para respetar paleta, tipografía, uso de logo/claim, tono y restricciones de claim de servicio del extracto oficial en repo.

## Skills nativos vs `skills-lock.json`

Las entradas de [skills-lock.json](skills-lock.json) pinnean skills **importadas** desde upstream (hash de `SKILL.md`). Skills mantenidas solo en este repositorio (p. ej. `etb-brand-brandbook`) pueden no aparecer en el lock si no forman parte de ese flujo de importación; el proceso `npm run verify:skills` no las lista.

_(Esta aclaración evita esperar entrada de pin para contenido mantenido en el equipo.)_

## Gobernanza de skills

- `skills-lock.json` registra **origen** y **hash** de cada skill importada.
- Los contenidos instalados viven típicamente bajo `.agents/skills/<nombre>/`.

Tras actualizar skills desde upstream, revisar consistencia con este archivo y con `AGENTS.md`.

## Resolución de conflictos (orden)

1. `AGENTS.md` y los documentos enlazados arriba.
2. Código fuente actual y scripts del `package.json`.
3. Skills bajo `.agents/skills/`.
4. Conocimiento genérico del modelo.

---

_Mantenido como contrato corto entre el equipo humano y los agentes; actualizar cuando cambien flujo OIDC, versión de React o estrategia de despliegue._
