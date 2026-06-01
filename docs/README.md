# Documentation Index / Índice de Documentación

This directory contains all project documentation organized by category.
Este directorio contiene toda la documentación del proyecto organizada por categoría.

---

## Documentation policy / Política editorial

- Documentar solo información **operativa y verificable** contra el código y la configuración vigente.
- Priorizar guías ejecutables: setup, despliegue, pruebas, arquitectura y branding aplicable.
- Evitar artefactos de bajo valor permanente en `docs/`: reportes de análisis, planes por fases, minutas o borradores de sprint.
- Si un contenido deja de ser operativo, eliminarlo o consolidarlo en la guía canónica correspondiente.
- Ante conflicto, manda la implementación real del repo y luego la documentación.

---

## Architecture / Arquitectura

Technical design, component diagrams, sequence flows, and security guidelines.
Diseño técnico, diagramas de componentes, flujos de secuencia y guías de seguridad.

- [**TECH_README.md**](architecture/TECH_README.md) — Architecture overview, class diagrams, OIDC sequence flows, cloud deployment diagrams, and security best practices.
- [**APPLICATION_ARCHITECTURE_OVERVIEW.md**](architecture/APPLICATION_ARCHITECTURE_OVERVIEW.md) — Vista tecnica consolidada de capas, endpoints BFF, flujos OIDC/OTP, seguridad y operacion.
- [**IDP_MULESOFT_GCP_ARCHITECTURE.md**](architecture/IDP_MULESOFT_GCP_ARCHITECTURE.md) — Arquitectura objetivo e **implementación actual** (mapa código ↔ MS-1…MS-4, diagramas de flujo, brecha objetivo vs `server/server.js`).
- [**LOGIN_OTP_EMAIL_FLOW.md**](architecture/LOGIN_OTP_EMAIL_FLOW.md) — Implementacion vigente del login `Codigo OTP`: MiUso/MS-2/MS-3, BFF, custom token, seguridad, preview Cloud Run y troubleshooting.
- [**OTP_ARCHITECTURE_VALIDATION.md**](architecture/OTP_ARCHITECTURE_VALIDATION.md) — Validacion cruzada de documentacion vs codigo para OTP, BFF y MS-4, con diagramas Mermaid de la arquitectura actual.
- [**ADR 0001**](architecture/decisions/0001-idp-spa-stateless-bff-stateful.md) — Formal decision: keep the IdP SPA stateless while adding a stateful BFF only for MuleSoft, OTP, MS-4, audit, and Admin SDK.

---

## Guides / Guías

Step-by-step instructions for developers and operators.
Instrucciones paso a paso para desarrolladores y operadores.

- [**DEVELOPERS.md**](guides/DEVELOPERS.md) — Local environment setup, running the dev server, unit and E2E tests, and white-label customization.
- [**IDP_LAUNCHER_IMPLEMENTATION.md**](guides/IDP_LAUNCHER_IMPLEMENTATION.md) — Guia tecnica para integrar un Launcher con el IdP: redireccion inicial, retorno exitoso/fallido, `allowedOrigins`, `state`, `id_token` y renovacion silenciosa.
- [**DEPLOY.md**](guides/DEPLOY.md) — Build/deploy pipeline guide: Cloud Build, Artifact Registry, Cloud Run revisions, rollback, and deployment troubleshooting.
- [**CONFIGURACION-PASO-A-PASO.md**](guides/CONFIGURACION-PASO-A-PASO.md) — Explicit local setup checklist: Identity Platform basics, `.env.local`, mock client, and local tests.
- [**GCP_FIREBASE_PROD_CONFIGURATION.md**](guides/GCP_FIREBASE_PROD_CONFIGURATION.md) — Canonical production configuration and mitigation runbook for Cloud Run `idp-service`, Secret Manager, Firebase/Auth IAM, MuleSoft, and reCAPTCHA.
- [**IDP_GCP_MULESOFT_MANUAL.md**](guides/IDP_GCP_MULESOFT_MANUAL.md) — Operational runbook for social providers, Firestore/audit, MuleSoft Anypoint, MS-4, and password recovery.
- [**BRANDING_ETB.md**](guides/BRANDING_ETB.md) — Central ETB branding guide: tokens, runtime theme mapping, governance, and documentation workflow.
- [**UX_STANDARDS.md**](guides/UX_STANDARDS.md) — Mandatory UX-first standards: user-friendly errors, performance-aware UI, and secure interaction rules.

---

## Planning / Planeación

Implementation plans and product/technical stories that remain useful while work is active.
Planes de implementación e historias técnico-funcionales vigentes durante la ejecución.

- [**IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md**](planning/IDP_GCP_MULESOFT_IMPLEMENTATION_PLAN.md) — Phase-by-phase implementation plan for BFF, MuleSoft, MS-4, React integration, social controls, and tests.
- [**HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md**](planning/HU-MS4-REGISTRO-CLIENTE-IDP-GCP.md) — User story and contract proposal for the MS-4 digital identity registration service.

---

## Testing / Pruebas

Testing strategies and verification scenarios.
Estrategias de prueba y escenarios de verificación.

- [**TESTING.md**](testing/TESTING.md) — Unit tests (Vitest), E2E tests (Playwright), manual verification scenarios, and troubleshooting test errors.

---

## Legal

Disclaimers and usage terms.
Exenciones de responsabilidad y términos de uso.

- [**DISCLAIMER.md**](legal/DISCLAIMER.md) — AS-IS warranty disclaimer, limitation of liability, support policy, and ownership terms.

---

## Other root-level documents

- [**README.md**](../README.md) — Project overview and quick start.
- [**CHANGELOG.md**](../CHANGELOG.md) — Version history and notable changes.
- [**LICENSE**](../LICENSE) — MIT License.
