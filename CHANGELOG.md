# Changelog

All notable changes to this project will be documented in this file.

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
