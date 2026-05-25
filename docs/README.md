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
- [**IDP_MULESOFT_GCP_ARCHITECTURE.md**](architecture/IDP_MULESOFT_GCP_ARCHITECTURE.md) — Target architecture for the IdP, MuleSoft OTP, MS-4, BFF, Identity Platform, and trust boundaries.
- [**ADR 0001**](architecture/decisions/0001-idp-spa-stateless-bff-stateful.md) — Formal decision: keep the IdP SPA stateless while adding a stateful BFF only for MuleSoft, OTP, MS-4, audit, and Admin SDK.

---

## Guides / Guías

Step-by-step instructions for developers and operators.
Instrucciones paso a paso para desarrolladores y operadores.

- [**DEVELOPERS.md**](guides/DEVELOPERS.md) — Local environment setup, running the dev server, unit and E2E tests, and white-label customization.
- [**DEPLOY.md**](guides/DEPLOY.md) — Production deployment guide: Cloud Run, Artifact Registry, Secret Manager, troubleshooting, and custom domains.
- [**CONFIGURACION-PASO-A-PASO.md**](guides/CONFIGURACION-PASO-A-PASO.md) — Explicit configuration checklist for local development and GCP deployment, with exact console navigation paths and commands.
- [**IDP_GCP_MULESOFT_MANUAL.md**](guides/IDP_GCP_MULESOFT_MANUAL.md) — Operational runbook for GCP, Identity Platform, social providers, MuleSoft Anypoint, Cloud Run BFF, MS-4, and password recovery.
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
