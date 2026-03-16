# Documentation Index / Índice de Documentación

This directory contains all project documentation organized by category.
Este directorio contiene toda la documentación del proyecto organizada por categoría.

---

## Architecture / Arquitectura

Technical design, component diagrams, sequence flows, and security guidelines.
Diseño técnico, diagramas de componentes, flujos de secuencia y guías de seguridad.

- [**TECH_README.md**](architecture/TECH_README.md) — Architecture overview, class diagrams, OIDC sequence flows, cloud deployment diagrams, and security best practices.

---

## Guides / Guías

Step-by-step instructions for developers and operators.
Instrucciones paso a paso para desarrolladores y operadores.

- [**DEVELOPERS.md**](guides/DEVELOPERS.md) — Local environment setup, running the dev server, unit and E2E tests, and white-label customization.
- [**DEPLOY.md**](guides/DEPLOY.md) — Production deployment guide: Cloud Run, Artifact Registry, Secret Manager, troubleshooting, and custom domains.
- [**CONFIGURACION-PASO-A-PASO.md**](guides/CONFIGURACION-PASO-A-PASO.md) — Explicit configuration checklist for local development and GCP deployment, with exact console navigation paths and commands.

---

## Testing / Pruebas

Testing strategies and verification scenarios.
Estrategias de prueba y escenarios de verificación.

- [**TESTING.md**](testing/TESTING.md) — Unit tests (Vitest), E2E tests (Playwright), manual verification scenarios, and troubleshooting test errors.

---

## Planning / Planificación

User stories, implementation analysis, and sprint planning artifacts.
Historias de usuario, análisis de implementación y artefactos de planificación de sprints.

- [**ANALISIS-IMPLEMENTACION.md**](planning/ANALISIS-IMPLEMENTACION.md) — Scope analysis, stakeholders, dependency order, risk register, and effort estimates. Recommended reading before sprint planning.
- [**README.md**](planning/README.md) — Index of user stories and planning conventions.
- [HU-01: Proyecto GCP e Identity Platform](planning/HU-01-proyecto-gcp-identity-platform.md) — GCP project setup, Identity Platform, authorized domains, IAM.
- [HU-02: Credenciales y seguridad](planning/HU-02-credenciales-seguridad.md) — API Key restrictions, OAuth 2.0 credentials, Token Service API.
- [HU-03: Infraestructura base](planning/HU-03-infraestructura-despliegue.md) — Service Account, Artifact Registry, Secret Manager.
- [HU-04: Build y despliegue Cloud Run](planning/HU-04-build-despliegue-cloud-run.md) — Docker image build, Cloud Run deployment, secrets injection.
- [HU-05: Integración post-despliegue](planning/HU-05-integracion-post-despliegue.md) — Authorized domains, API Key production config, VITE_ALLOWED_ORIGINS.
- [HU-06: Validación E2E y operación](planning/HU-06-validacion-operacion.md) — E2E validation, runbook, troubleshooting table, deploy-cloudrun-only.

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
