# OIDC Identity Provider (White-Label)

Una solución de proveedor de identidad ligera, segura y personalizable, diseñada para desplegarse en Google Cloud Platform (Cloud Run).

> **Para Desarrolladores:** Guía de configuración y pruebas local en [docs/guides/DEVELOPERS.md](docs/guides/DEVELOPERS.md).
>
> **📚 Índice de Documentación:**
>
> *   [**docs/README.md**](docs/README.md): Índice completo de toda la documentación.
> *   [**docs/guides/BRAND_ASSETS.md**](docs/guides/BRAND_ASSETS.md): Logos ETB en repo, mock y sincronización con el Manual de imagen (PDF).
> *   [**docs/guides/UX_STANDARDS.md**](docs/guides/UX_STANDARDS.md): Estándar UX-first (errores amigables, intuición, performance y seguridad en UI).
> *   [**CONFIGURACION-PASO-A-PASO.md**](docs/guides/CONFIGURACION-PASO-A-PASO.md): Guía explícita de configuración (local + despliegue) con cada paso y archivo a modificar.
> *   [**IDP_LAUNCHER_IMPLEMENTATION.md**](docs/guides/IDP_LAUNCHER_IMPLEMENTATION.md): Guía técnica para integrar un sitio Launcher con el IdP y manejar retorno exitoso/fallido.
> *   [**DEPLOY.md**](docs/guides/DEPLOY.md): Guía de despliegue en producción (Cloud Run + Infraestructura).
> *   [**TECH_README.md**](docs/architecture/TECH_README.md): Arquitectura técnica, diagramas de secuencia y seguridad.
> *   [**LOGIN_OTP_EMAIL_FLOW.md**](docs/architecture/LOGIN_OTP_EMAIL_FLOW.md): Flujo implementado de login por `Código OTP` con MiUso/MuleSoft, BFF, Firebase custom tokens y controles antiabuso.
> *   [**OTP_ARCHITECTURE_VALIDATION.md**](docs/architecture/OTP_ARCHITECTURE_VALIDATION.md): Validación de documentación vs código para OTP, BFF y MS-4 con diagramas Mermaid.
> *   [**DESIGN.md**](DESIGN.md): Guía corta de UI para agentes (el branding en runtime sigue en `APP_CONFIG`).
> *   [**TESTING.md**](docs/testing/TESTING.md): Estrategia de pruebas (E2E, Unitarias) y control de calidad.
> *   [**CHANGELOG.md**](CHANGELOG.md): Historial de versiones y cambios notables.
> *   [**DISCLAIMER.md**](docs/legal/DISCLAIMER.md): Exención de responsabilidades y términos de uso.

## 🚀 Características Principales

*   **White-Label:** Totalmente personalizable (Logos, Colores, Textos) vía configuración en tiempo de ejecución.
*   **Secure by Default:** Implementa validación estricta de orígenes (`redirect_uri`), saneamiento de inputs y headers de seguridad.
*   **Serverless:** Optimizado para Cloud Run (Stateless).
*   **OIDC Compliant:** Soporta flujo implícito para integración con aplicaciones SPA.
*   **Login por Código OTP:** Autenticación de usuarios ETB existentes con OTP enviado por MiUso/MuleSoft y sesión real en Identity Platform mediante `signInWithCustomToken`.
*   **Renovación silenciosa de token:** Soporta `prompt=none` para que las aplicaciones cliente renueven el token antes de que expire (1 h) sin volver a pedir credenciales al usuario.

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
👉 **[DEPLOY.md](docs/guides/DEPLOY.md)**

Para un despliegue rápido automatizado en Windows:
```cmd
scripts/one-shot-deploy.cmd
```

## 🔄 Renovación del token (más tiempo de sesión en el cliente)

El token de identidad (ID token) tiene una vida limitada (por ejemplo, 1 hora). Para que el usuario mantenga la sesión en la aplicación cliente sin tener que volver a iniciar sesión:

1. **En el IdP (esta solución):** Ya está soportado. Si el cliente incluye `prompt=none` en la URL de autenticación, el IdP no muestra la pantalla de login; comprueba si hay sesión activa en Firebase y, si existe, devuelve un **nuevo** `id_token` en la redirección. Si no hay sesión, devuelve `error=login_required` en el hash.

2. **En la aplicación cliente (socio):**
   - Decodificar el JWT para leer la fecha de expiración (`exp`).
   - Antes de que expire (p. ej. 5–10 minutos), redirigir al usuario al IdP con los mismos parámetros OIDC y **`prompt=none`** (misma ventana o iframe).
   - Al volver, si en la URL viene `id_token=...`, reemplazar el token guardado. Si viene `error=login_required`, pedir de nuevo login completo.

**Ejemplo de URL para renovación silenciosa:**  
`https://tu-idp.ejemplo.com/?client_id=...&redirect_uri=...&response_type=id_token&state=...&prompt=none`

Así el cliente puede mantener la sesión activa mientras el usuario siga con sesión en el IdP (mismo navegador).

## 🛡️ Seguridad
*   **CORS/Redirección:** Solo se permiten redirecciones a dominios listados en `window.APP_CONFIG.allowedOrigins`.
*   **Git History:** Este repositorio ha sido inicializado desde cero para garantizar que no existan secretos en el historial.

## 📄 Licencia
MIT License - Ver [LICENSE](LICENSE) para más detalles.
