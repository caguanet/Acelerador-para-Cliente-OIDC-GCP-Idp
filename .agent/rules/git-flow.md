# Reglas de Flujo de Trabajo (Git Flow & Changelog)

## 1. Estrategia de Ramas (GitHub Flow Simplificado)

Para mantener la agilidad y estabilidad del proyecto, seguiremos una adaptación estricta de **GitHub Flow**:

1.  **Rama `main` Sagrada:**
    *   La rama `main` **SIEMPRE** debe ser desplegable.
    *   Nunca se hace commit directo a `main` (a menos que sea hotfix crítico o setup inicial).

2.  **Feature Branches (Ramas de Funcionalidad):**
    *   Para cada nueva tarea, bug fix o experimento, crea una rama desde `main`.
    *   **Nomenclatura:** `tipo/descripcion-breve`
        *   `feat/login-google`: Nuevas funcionalidades.
        *   `fix/token-validation`: Corrección de errores.
        *   `chore/setup-repo`: Tareas de mantenimiento o configuración.
        *   `docs/readme-update`: Documentación.

3.  **Pull Requests (PR):**
    *   Para fusionar cambios a `main`, abre un PR.
    *   El PR es el lugar de discusión y revisión de código.

## 2. Convención de Commits (Conventional Commits)

Es **MANDATORIO** usar el estándar [Conventional Commits](https://www.conventionalcommits.org/) para permitir la automatización del Changelog.

**Formato:** `<tipo>: <descripción breve>`

*   **Tipos permitidos:**
    *   `feat`: Una nueva funcionalidad (Feature).
    *   `fix`: Una corrección de un bug.
    *   `docs`: Cambios solo en documentación.
    *   `style`: Cambios que no afectan la lógica (espacios, formato, css cosmético).
    *   `refactor`: Cambio de código que no arregla un bug ni añade funcionalidad.
    *   `test`: Añadir tests faltantes o corregir existentes.
    *   `chore`: Cambios en el proceso de build, herramientas, scripts auxiliares.

**Ejemplos:**
*   `feat: add google auth login button`
*   `fix: resolve cors issue in backend`
*   `style: update glassmorphism css`

## 3. Automatización del Changelog

Utilizaremos un script automático para mantener el archivo `CHANGELOG.md` actualizado basado en el historial de git.

*   **Script:** `scripts/update_changelog.py`
*   **Disparador:** Ejecutar antes de hacer merge a main o preparar un release.
*   **Comando:** `python scripts/update_changelog.py`

Este script leerá los commits desde el último tag (o el inicio), los agrupará por tipo (`Features`, `Bug Fixes`, `Chores`) y actualizará el archivo `CHANGELOG.md`.
