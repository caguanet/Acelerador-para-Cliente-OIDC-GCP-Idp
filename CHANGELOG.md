# Changelog

All notable changes to this project will be documented in this file.

## [v1.2.2] - 2026-04-16
### 🐛 Correcciones
- **Compilación de Producción:** Se corrigieron errores de validación de tipos TypeScript (TS2367 y TS6133 en `BrandLoginForm.tsx`) eliminando código muerto inalcanzable, funciones de utilidad sobrantes y variables de estado no utilizadas, permitiendo el éxito del proceso de build local e integración continua.

## [v1.2.1] - 2026-02-19
### 🐛 Correcciones
- **Inyección de Variables de Entorno en Windows:** Se corrigió el script de despliegue (`one-shot-deploy.cmd` y `tmp/exc-one-shot-deploy.cmd`) para escapar correctamente el carácter pipe (`|`) en `VITE_ALLOWED_ORIGINS` usando `^|`. Esto solucionaba un error crítico donde la lista blanca de dominios se truncaba o malformaba, bloqueando el acceso CORS.
- **Acceso Público Cloud Run:** Se documentó e implementó la solución para sobrescribir la política de organización `iam.allowedPolicyMemberDomains`, permitiendo la invocación pública (`allUsers`) necesaria para la demo externa.

### 📚 Documentación
- **Guía de Despliegue (`DEPLOY.md`):** Se agregó una sección detallada "Troubleshooting Enterprise" para resolver bloqueos por políticas de organización mediante la Consola de GCP y CLI (`set-policy`).
- **Base de Conocimiento:** Se actualizó `tmp/knowledge-base-gcloud-windows.md` con el "gotcha" específico del escapado de pipes en CMD para comandos `gcloud`.

## [v1.2.0] - 2026-02-18
### ✨ Nuevas Características
- **Infrastructure Decoupling:** Independencia total de la cuenta "Compute Default". Ahora `deploy` y `build` usan `idp-service-sa` con roles explícitos (`logging.logWriter`, `artifactregistry.writer`, etc).
- **Project Reset Script:** Nuevo `tmp/delete-project.cmd` que permite reiniciar el entorno manteniendo el nombre del proyecto pero rotando el ID para evitar bloqueos de "soft-delete".

### 🔧 Refactorización y Mejoras
- **KISS Deployment:** Refactorizado `one-shot-deploy.cmd` para usar `CLOUDSDK_CORE_PROJECT` globalmente, eliminando redundancia y errores de contexto.
- **Robustez en Build:** Generación dinámica de `cloudbuild.yaml` (`logging: CLOUD_LOGGING_ONLY`) para permitir builds con cuentas de servicio personalizadas sin buckets de logs externos.

### 📚 Documentación
- **Knowledge Base:** Nueva `tmp/knowledge-base-gcloud-windows.md` documentando gotchas de Windows Batch, manejo de IAM y ciclo de vida de proyectos GCP.

## [v1.1.5] - 2026-02-17
### 🔧 Refactorización y Mejoras
- **Despliegue Estandarizado:** Reescritura total de `DEPLOY.md` cumpliendo estándares de Módulo 05 (Zero-Touch Provisioning).
- **Proceso One-Shot:** Creación de `scripts/one-shot-deploy.cmd` para automatizar completamente la infraestructura y despliegue del IdP.
- **Limpieza Técnica:** Eliminación de scripts obsoletos (`deploy-gcp.ps1`, `nuke-files.js`) y archivado de herramientas legacy en `tmp/`.

### 📚 Documentación
- **Sync Workflow:** Implementada regla `.agent/workflows/sync-deployment.md` para garantizar consistencia entre documentación y scripts.
- **Troubleshooting:** Nueva sección en `DEPLOY.md` con tabla de resolución de errores comunes (CORS, IAM, Saltos de Línea).

### 🔧 Refactorización y Mejoras
- **Server Port Enforcement:** Configurado `strictPort: true` y puerto `5173` en `vite.config.ts` para evitar colisiones con el Mock Client.
- **Manual Testing Guide:** Actualizado `TESTING.md` con instrucciones explícitas para el escenario "Dual-Site" (IdP + Mock).

## [v1.1.3] - 2026-02-16
### 🔧 Fixes
- **Robust Environment Cleanup**: Implemented `scripts/cleanup-ports.mjs` to surgically kill zombie processes on ports 3000/5173 before server start.
- **Port Binding**: Enforced explicit `127.0.0.1` binding in Vite config to resolve IPv4/IPv6 ambiguities.
- **Documentation**: Updated `TESTING.md` with Git tracking instructions and cleanup details.

## [1.1.2] - 2026-02-16
### 🔧 Refactorización y Mejoras
- **Tests E2E:** Implementada estrategia de **Navegación Directa** en `auth-flow.spec.ts` para eliminar la dependencia de la UI del Mock Client.
- **Estabilidad:** Aumentado el timeout de aserción inicial a 10s y refinados los selectores para manejar tiempos de carga y animaciones de entrada (`modalSlide`).
- **Diagnóstico:** Completado análisis de causa raíz para fallos de "White Screen" (descartado) vs "Race Condition" (confirmado).

## [1.1.1] - 2026-02-16
### ✨ Nuevas Características (Testing)
- **Deterministic Registration Test:** Implementado patrón de registro determinista en `auth-flow.spec.ts` para eliminar race conditions en tests E2E.
- **Existing User Login Test:** Nuevo escenario de prueba para usuarios existentes usando credenciales de `.env`.

### 📚 Documentación
- **PLAYWRIGHT_DIAGNOSIS.md:** RCA detallado sobre flakiness en tests y estrategia de solución.
- **TESTING.md:** Actualizado Plan de Pruebas con nuevos escenarios (Happy Path y Security).

### 🐛 Correcciones
- **E2E Timeout Fix:** Eliminado `try-catch` en flujo de login que ocultaba errores de timeout.

## [1.1.0] - 2026-02-16
### ✨ Nuevas Características
- **Mock Client Decoupling:** Separación total del cliente de prueba en `mock-client/` (Puerto 3000).
- **Runtime Configuration:** `public/config.js` permite White-Labeling sin recompilar.
- **Dev Simulation:** Script `npm run dev:simulation` para probar el flujo OIDC completo localmente.

### 🔧 Refactorización y Mejoras
- **IdP Purification:** Eliminado el Dashboard y componentes de UI innecesarios de `App.tsx`.
- **Security Hardening:** Validación estricta de orígenes y eliminación de alertas por manejo de errores en estado (`setOidcError`).
- **Code Cleanup:** Removidas importaciones y variables de Firebase no utilizadas.
- **Build Fix:** Corregido error de compilación en `App.test.tsx` (variable no usada).

### 📚 Documentación
- **TECH_README.md:** Arquitectura, diagramas de secuencia y despliegue. *Incluye nota sobre sanitización de sintaxis Mermaid.*
- **Legal:** Añadidos `LICENSE` y `DISCLAIMER.md`.
- **Testing:** Estructura de pruebas E2E con Playwright (`tests/auth.spec.ts`).

## [1.0.0] - 2026-02-10
### ✨ Initial Release
- **Pure OIDC Service**: Dedicated Identity Provider application.
- **Architecture**: React Frontend + Static Node.js Host (Cloud Run).
- **Security**: 
    - Strict `redirect_uri` whitelisting via `VITE_ALLOWED_ORIGINS`.
    - Runtime configuration via `window.APP_CONFIG`.
- **Infrastructure**: "Dual-Instance" and "Mock Client" logic removed for cleaner, production-ready artifact.
