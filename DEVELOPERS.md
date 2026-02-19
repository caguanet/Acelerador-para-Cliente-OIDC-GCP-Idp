# Guía del Desarrollador (Developer Guide)

Esta guía documenta los procesos estándar para configurar el entorno local, ejecutar la aplicación y correr las pruebas automatizadas.

## 1. Requisitos Previos

*   **Node.js**: v18 o superior.
*   **Gestor de Paquetes**: `npm` (incluido con Node.js).
*   **Git Bash** (Recomendado en Windows) o PowerShell.
*   **GCP Project**: Acceso a un proyecto con Identity Platform habilitado.

## 2. Configuración de Seguridad en GCP (Paso Crítico)

Para que el entorno local funcione correctamente con las APIs de Firebase, debe configurar su API Key en la Consola de GCP (`APIs & Services > Credentials`):

1.  **HTTP Referrers:** Agregue su origen local: `http://localhost:5173/*` (y cualquier otro puerto que use).
2.  **API Restrictions:** Si tiene restricciones de API habilitadas, asegúrese de **PERMITIR** explícitamente estas dos:
    *   **Identity Toolkit API** (Necesaria para login/registro).
    *   **Token Service API** (Necesaria para el intercambio de tokens OIDC).

> [!WARNING]
> Sin la "Token Service API", el IdP no podrá emitir el `id_token` final, aunque el login de Firebase parezca exitoso.

## 3. Configuración del Entorno Local

1.  **Clonar el repositorio:**
    ```bash
    git clone <URL_DEL_REPOSITORIO>
    cd oidc-identity-provider
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env.local` en la raíz del proyecto para sobreescribir las variables por defecto si es necesario (ej. credenciales de Firebase propias).
    ```env
    VITE_FIREBASE_API_KEY=AIzaSy...
    VITE_FIREBASE_AUTH_DOMAIN=mi-proyecto-dev.firebaseapp.com
    VITE_FIREBASE_PROJECT_ID=mi-proyecto-dev
    ```

## 3. Ejecución Local (Dev Server)

Para levantar el servidor de desarrollo Vite con Hot Module Replacement (HMR):

```bash
npm run dev
```

*   **URL Local:** `http://localhost:5173`
*   **Debug:** La consola del navegador mostrará logs detallados de la inicialización de Firebase y la configuración del tema.

## 4. Pruebas Automatizadas

El proyecto cuenta con dos niveles de pruebas: Unitarias (Vitest) y End-to-End (Playwright).

### 4.1 Pruebas Unitarias
Ejecuta las pruebas de lógica de negocio y componentes aislados.

```bash
# Ejecutar todas las pruebas una vez
npm run test

# Ejecutar en modo observación ("watch mode")
npm run test -- --watch
```

### 4.2 Pruebas End-to-End (E2E)
Pruebas de flujo completo simulando un navegador real.

```bash
# Ejecutar pruebas en modo "headless" (sin interfaz gráfica)
npx playwright test

# Ejecutar pruebas con interfaz visual para depuración
npx playwright test --ui
```

> **Nota:** Si es la primera vez que ejecutas Playwright, es posible que necesites instalar los navegadores:
> `npx playwright install`

## 5. Simulación de Identidad Visual (White-Label)

Para probar diferentes configuraciones de marca localmente sin desplegar, puedes inyectar la configuración en la consola del navegador o modificar temporalmente `index.html`:

```javascript
// Pegar en la consola del navegador
window.APP_CONFIG = {
    theme: {
        brandName: "Marca de Prueba",
        colors: { primary: "#ff0000" } // Cambia a rojo
    }
};
// Recargar componentes (o forzar re-render) para ver cambios si no son reactivos al instante.
```
