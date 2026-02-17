---
trigger: always_on
description: Aplica esta regla siempre que se realicen cambios significativos en el código, directivas de prompt o configuración de infraestructura.
---

# Regla de Mantenimiento de Changelog (Modo Turbo)

## Contexto
El proyecto mantiene un archivo [CHANGELOG.md] en la raíz para rastrear la evolución de la arquitectura y las funcionalidades.

## Regla
**SIEMPRE** que realices cambios significativos en el repositorio (nuevas funcionalidades, refactorización de código, cambios en directivas importantes o configuración de infraestructura), **DEBES** invocar el workflow de actualización automatizada (referencia interna: `@[/update-changelog]`) antes de finalizar la sesión o tarea.

Al invocar este workflow, aprovechas su configuración "turbo" para realizar la actualización sin solicitar permisos redundantes.

### Definición de "Cambio Significativo"
*   Modificaciones en flujos de trabajo de GitHub Actions (`.github/`).
*   Cambios en la estructura del proyecto.

### Formato de Entrada
Usa el formato [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
1.  Encabezado con la fecha: `## [YYYY-MM-DD] - Título Descriptivo`
2.  Categorías:
    *   `### ✨ Nuevas Características`
    *   `### 🔧 Refactorización y Mejoras`
    *   `### 🐛 Correcciones`
    *   `### 📚 Documentación`