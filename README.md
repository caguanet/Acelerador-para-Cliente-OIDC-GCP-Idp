# OIDC Identity Provider (White-Label)

Una solución de proveedor de identidad ligera, segura y personalizable, diseñada para desplegarse en Google Cloud Platform (Cloud Run).

> **Para Desarrolladores:** Guía de configuración y pruebas local en [DEVELOPERS.md](DEVELOPERS.md).
>
> **📚 Índice de Documentación:**
> *   [**DEPLOY.md**](DEPLOY.md): Guía de despliegue en producción (Cloud Run + Infraestructura).
> *   [**TECH_README.md**](TECH_README.md): Arquitectura técnica, diagramas de secuencia y seguridad.
> *   [**TESTING.md**](TESTING.md): Estrategia de pruebas (E2E, Unitarias) y control de calidad.
> *   [**CHANGELOG.md**](CHANGELOG.md): Historial de versiones y cambios notables.
> *   [**DISCLAIMER.md**](DISCLAIMER.md): Exención de responsabilidades y términos de uso.

## 🚀 Características Principales

*   **White-Label:** Totalmente personalizable (Logos, Colores, Textos) vía configuración en tiempo de ejecución.
*   **Secure by Default:** Implementa validación estricta de orígenes (`redirect_uri`), saneamiento de inputs y headers de seguridad.
*   **Serverless:** Optimizado para Cloud Run (Stateless).
*   **OIDC Compliant:** Soporta flujo implícito para integración con aplicaciones SPA.

## 🏗️ Arquitectura y Contexto de Despliegue

Este proyecto está diseñado bajo el patrón de **Identity Broker** (Intermediario de Identidad):

1.  **Infraestructura del Cliente (Host):**
    *   Esta solución **DEBE** ser desplegada y operada únicamente en la infraestructura del Cliente (dueño de la identidad).
    *   Es la "puerta de entrada" unificada para todos los servicios.

2.  **Socios y Terceros (Consumidores):**
    *   Los socios **NO** despliegan este componente.
    *   Los socios actúan como **OIDC Clients** (Relying Parties), redirigiendo a sus usuarios a esta instancia centralizada para autenticación.
    *   La relación es de confianza federada: El socio confía en el token emitido por esta instancia.

> **Nota:** Este componente no está destinado a ser entregado como código fuente a los socios, sino ofrecido como un **servicio SaaS** gestionado por la organización del Cliente.

## 🛠️ Configuración (Day 2 Operations)

### Personalización de Marca (Branding)
No es necesario recompilar la aplicación para cambiar la marca.

1.  **Logos:** Sube tu logo a una URL pública o reemplaza `public/branding/default/logo.png`.
2.  **Colores y Textos:** Inyecta la configuración en el objeto global `window.APP_CONFIG` antes de cargar el script `main.tsx`.

Ejemplo de inyección (`index.html` o script de inicialización):
```javascript
window.APP_CONFIG = {
    theme: {
        brandName: "Mi Empresa S.A.S",
        logoUrl: "https://cdn.miempresa.com/logo.png",
        colors: {
            primary: "#FF0000", /* Rojo Corporativo */
            secondary: "#CC0000",
            accent: "#00FF00"
        },
        hero: {
            title: "Bienvenido al Portal Seguro",
            subtitle: "Acceso centralizado para empleados"
        }
    },
    allowedOrigins: [
        "https://app.miempresa.com",
        "https://ventas.miempresa.com"
    ]
};
```

### Gestión de Secretos
Las variables sensibles se manejan como variables de entorno en el despliegue (Cloud Run):
*   `VITE_FIREBASE_API_KEY`: API Key de Identity Platform.
*   `VITE_FIREBASE_AUTH_DOMAIN`: Dominio de Auth.

## 📦 Despliegue (Production)

### Prerrequisitos
*   GCP Project con Billing habilitado.
*   gcloud CLI instalado y autenticado.

### Guía de Despliegue
Para instrucciones detalladas paso a paso, consulte:
👉 **[DEPLOY.md](DEPLOY.md)**

Para un despliegue rápido automatizado en Windows:
```cmd
scripts/one-shot-deploy.cmd
```

## 🛡️ Seguridad
*   **CORS/Redirección:** Solo se permiten redirecciones a dominios listados en `window.APP_CONFIG.allowedOrigins`.
*   **Git History:** Este repositorio ha sido inicializado desde cero para garantizar que no existan secretos en el historial.

## 📄 Licencia
MIT License - Ver [LICENSE](LICENSE) para más detalles.
