# Configuracion Paso a Paso (Guia Explicita)

Este documento detalla **cada paso** de configuracion del proyecto, con comandos exactos, rutas de navegacion en la consola de GCP/Firebase y archivos a modificar. Sirve como checklist para desarrollo local y despliegue en GCP.

> **Nota sobre la consola de GCP:** Google renombro la seccion "APIs & Services > Credentials" a **"Google Auth Platform"** (a partir de mediados de 2025). Ambas rutas siguen funcionando, pero este documento usa las rutas actuales. Si no ves "Google Auth Platform" en el menu, busca "APIs & Services > Credentials" (es la misma pantalla).

---

## PARTE A: CONFIGURACION PARA DESARROLLO LOCAL

### A.1 Requisitos previos (verificar antes de empezar)

| Requisito | Como verificar |
| --------- | -------------- |
| **Node.js v18+** | En PowerShell: `node -v` (debe mostrar v18.x o superior). |
| **pnpm** | `pnpm -v` |
| **Git** | `git --version` |
| **Proyecto GCP** | Tener un proyecto en Google Cloud con **Identity Platform** (Firebase Auth) habilitado. |

---

### A.2 Habilitar Identity Platform en GCP

Si el proyecto aun no tiene Identity Platform habilitado:

1. **Abrir la consola de GCP:** <https://console.cloud.google.com/>
2. **Seleccionar tu proyecto** en el selector de proyectos (barra superior).
3. **Navegar a Identity Platform:**
   - Menu de hamburguesa (`☰`) > buscar **"Identity Platform"** en el buscador superior, o
   - URL directa: `https://console.cloud.google.com/customer-identity/providers?project=etb-identity-omnicanal`
4. Si es la primera vez, haz clic en **"Enable Identity Platform"** (o "Habilitar Identity Platform").
5. **Agregar proveedor Email/Password:**
   - En la pagina **Identity Platform > Providers** (Proveedores), haz clic en **"Add A Provider"** (Agregar un proveedor).
   - Selecciona **"Email / Password"**.
   - Activa el toggle **"Enabled"** (Habilitado).
   - Haz clic en **"Save"** (Guardar).

---

### A.3 Configuracion de seguridad en GCP (obligatorio para que el login funcione)

#### A.3.1 Configurar la API Key (restricciones de dominio y API)

La API Key controla desde que dominios se puede llamar a Firebase Auth y a cuales APIs tiene acceso.

**Navegacion en la consola de GCP:**

```text
☰ Menu > Google Auth Platform > Clients
  (ruta legacy: ☰ Menu > APIs & Services > Credentials)
```

URL directa: `https://console.cloud.google.com/apis/credentials?project=etb-identity-omnicanal`

**Pasos:**

1. En la pagina **Credentials**, localiza la API Key que usa tu proyecto (normalmente llamada "Browser key (auto created by Firebase)" o similar). Haz clic en su **nombre** para abrirla.

2. **Application restrictions** (Restricciones de aplicacion) > selecciona **"Websites"** (Sitios web):
   - Haz clic en **"Add"** (Agregar) y escribe cada referrer:

   | Referrer a agregar | Proposito |
   | ------------------ | --------- |
   | `http://localhost:5173/*` | Servidor de desarrollo Vite (IdP) |
   | `http://localhost:3000/*` | Mock client para pruebas E2E |
   | `http://localhost:8080/*` | Servidor Express local (si aplica) |
   | `https://<PROJECT_ID>.firebaseapp.com/*` | Dominio de Auth usado por enlaces passwordless/email action |
   | `https://<PROJECT_ID>.web.app/*` | Hosting Firebase, si se usa como dominio público |
   | `https://<IDP_QA_O_PROD_DOMAIN>/*` | Dominio real de QA/producción del IdP |

   - Haz clic en **"Done"** (Listo) despues de cada entrada.

3. **API restrictions** (Restricciones de API) > selecciona **"Restrict key"** (Restringir clave):
   - Marca estas dos APIs en la lista:
     - **Identity Toolkit API** (necesaria para login/registro)
     - **Token Service API** (necesaria para emision del `id_token` OIDC)
   - Si no aparecen en la lista, primero debes habilitarlas:

     ```text
     ☰ Menu > APIs & Services > Enabled APIs & Services > + Enable APIs and Services
     ```

     Busca "Identity Toolkit API" y "Token Service API" y habilitarlas.

4. Haz clic en **"Save"** (Guardar) al final de la pagina.

> **Sin Token Service API** el login de Firebase puede parecer correcto pero el IdP no podra emitir el token final (`getIdToken()` falla silenciosamente).

> **Error frecuente:** Si al abrir el correo de acceso aparece `API_KEY_HTTP_REFERRER_BLOCKED` con `httpReferrer: "https://<PROJECT_ID>.firebaseapp.com/"`, falta agregar `https://<PROJECT_ID>.firebaseapp.com/*` en los **HTTP referrers** de la misma API Key. El enlace de correo se procesa primero en el dominio de Auth de Firebase y luego vuelve al `continueUrl` configurado.

---

#### A.3.2 Identity Platform: Dominios autorizados (Authorized Domains)

Los dominios autorizados controlan desde que URLs Firebase Auth permite la autenticacion. Para desarrollo local, `localhost` suele estar autorizado por defecto, pero si recibes el error `auth/unauthorized-domain`, debes agregarlo manualmente.

Hay **dos rutas equivalentes** para gestionar estos dominios:

**Opcion A: Desde Firebase Console (recomendada, mas directa):**

```text
Firebase Console > Authentication > Settings > Authorized domains
```

1. Abre la **Consola de Firebase**: <https://console.firebase.google.com/>
2. Selecciona el **mismo proyecto** que usas en Identity Platform.
3. En el menu lateral izquierdo, haz clic en **"Authentication"** (dentro de la seccion "Build").
4. Haz clic en la pestana **"Settings"** (Configuracion) — es la cuarta pestana, despues de "Users", "Sign-in method" y "Templates".
5. Baja a la seccion **"Authorized domains"** (Dominios autorizados).
6. Haz clic en **"Add domain"** (Agregar dominio).
7. Escribe el dominio (ej. `localhost` o tu dominio de Cloud Run `idp-service-xxxxx-uc.a.run.app`) y confirma.

> **Nota:** En proyectos creados antes de abril 2025, `localhost` esta habilitado por defecto. En proyectos nuevos, puede que necesites agregarlo manualmente.

**Opcion B: Desde la consola de GCP (Identity Platform):**

En la consola actual, los dominios autorizados se gestionan en **Configuracion > Seguridad**, no en Providers.

```text
☰ Menu > Identity Platform > Configuracion (icono engranaje) > pestana "Seguridad" > Dominios autorizados > Agregar un dominio
```

1. Abre la consola de GCP y selecciona tu proyecto.
2. Ve a **Identity Platform > Configuracion** (en el menu lateral izquierdo, icono de engranaje).
   - URL directa: `https://console.cloud.google.com/customer-identity/settings?project=TU_PROJECT_ID`
3. Haz clic en la pestana **"Seguridad"** (Security) — junto a "Usuarios" y "Activadores".
4. Baja hasta la seccion **"Dominios autorizados"** (Authorized domains).
5. Haz clic en el boton **"Agregar un dominio"** (Add a domain).
6. Escribe el dominio (ej. `localhost` o `idp-service-xxxxx-uc.a.run.app`) y confirma.

---

#### A.3.3 Configurar credenciales OAuth 2.0 (si usas proveedor Google)

Solo necesario si habilitaste **Google** como proveedor de identidad (ademas de Email/Password).

**Navegacion:**

```text
☰ Menu > Google Auth Platform > Clients
  (ruta legacy: ☰ Menu > APIs & Services > Credentials)
```

1. En la pagina **Credentials**, busca la credencial de tipo **"OAuth 2.0 Client IDs"** (normalmente "Web client (auto created by Google Service)").
2. Haz clic en su **nombre** para editarla.
3. **Authorized JavaScript origins** (Origenes autorizados de JavaScript):
   - Haz clic en **"+ Add URI"** y agrega:
     - `http://localhost:5173`
     - `http://localhost:3000` (si usas mock client)
4. **Authorized redirect URIs** (URIs de redireccion autorizadas):
   - Haz clic en **"+ Add URI"** y agrega:
     - `http://localhost:5173/__/auth/handler`
     - `http://localhost:3000/__/auth/handler`
5. Haz clic en **"Save"** (Guardar).

> **Importante sobre Google Auth Platform (junio 2025+):**
>
> - Los **Client Secrets** ahora se enmascaran en la consola; solo se muestran al momento de crearlos. Guarda el secret de forma segura al crearlo.
> - Los clientes OAuth inactivos por 6 meses se eliminan automaticamente.

---

### A.4 Clonar e instalar el proyecto

Ejecutar en la carpeta donde quieras dejar el proyecto (por ejemplo `D:\proyectos`):

```powershell
git clone <URL_DEL_REPOSITORIO>
cd Acelerador-para-Cliente-OIDC-GCP-Idp
pnpm install
```

- Reemplazar `<URL_DEL_REPOSITORIO>` por la URL real del repo (HTTPS o SSH).
- `pnpm install` crea la carpeta `node_modules` e instala dependencias.

---

### A.5 Variables de entorno locales

Hay que crear el archivo `.env.local` y rellenar las variables con valores **reales** de tu proyecto. A continuacion se indica **de donde sacar cada una**.

> **Por que se menciona Firebase si ya configure todo en GCP (Identity Platform)?**
> Identity Platform y Firebase usan **el mismo proyecto** de Google Cloud. Cuando configuraste dominios en **Identity Platform > Configuracion > Seguridad** (Opcion B), eso fue en la consola de GCP. Las variables que necesitas ahora — API Key, `authDomain`, `projectId` — son **credenciales de ese mismo proyecto**. La consola de **Firebase** no es un segundo proyecto: es otra interfaz para el mismo, y ahi Google muestra esas credenciales juntas en un bloque `firebaseConfig`. Si prefieres no abrir Firebase, puedes obtener la API Key desde GCP (Credentials) y el ID del proyecto ya lo conoces; ver **Opcion B** mas abajo.

---

#### Opcion A: Desde Firebase Console (todo en un solo bloque)

Es la forma mas rapida porque Firebase muestra `apiKey`, `authDomain` y `projectId` juntos. Es **el mismo proyecto** que ya usas en Identity Platform en GCP.

1. **Abrir la consola de Firebase**
   - URL: <https://console.firebase.google.com/>
   - Inicia sesion con la misma cuenta de Google que usa GCP.

2. **Seleccionar (o crear) el proyecto**
   - En la pagina principal veras la lista de proyectos.
   - Haz clic en el proyecto que tiene Identity Platform habilitado (el mismo donde configuraste Email/Password o Google como proveedores).
   - Si no hay proyecto, "Agregar proyecto" y enlazalo despues a Identity Platform.

3. **Abrir la configuracion del proyecto**
   - En el menu lateral izquierdo, haz clic en el **icono de engranaje** (junto a "Project Overview").
   - Selecciona **"Project settings"** (Configuracion del proyecto).

4. **En la pestana "General"**
   - Deja abierta la pestana **"General"** (es la que se abre por defecto).
   - Baja hasta la seccion **"Your apps"** (Tus aplicaciones). Si no hay ninguna app web, haz clic en el icono **"</>"** (Web) para **"Add app"** y registrar una aplicacion web (solo necesitas el nombre).
   - En la tarjeta de la **app web** veras el bloque `firebaseConfig` con todos los valores:

   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",           // <-- VITE_FIREBASE_API_KEY
     authDomain: "xxx.firebaseapp.com", // <-- VITE_FIREBASE_AUTH_DOMAIN
     projectId: "etb-identity-omnicanal",     // <-- VITE_FIREBASE_PROJECT_ID
     // ... otros campos que NO necesitas
   };
   ```

**Resumen de correspondencia:**

| Variable en `.env.local` | Donde obtenerla |
| ------------------------ | --------------- |
| `VITE_FIREBASE_API_KEY` | Firebase Console > engranaje > Project settings > General > Your apps > `apiKey` (empieza por `AIzaSy...`). |
| `VITE_FIREBASE_PROJECT_ID` | Mismo bloque: campo `projectId` (ej. `etb-identity-omnicanal`). Tambien visible en la parte superior de la pagina como "Project ID". |
| `VITE_FIREBASE_AUTH_DOMAIN` | Mismo bloque: campo `authDomain`. Normalmente es `etb-identity-omnicanal.firebaseapp.com`. Si no aparece, construyelo asi: `{VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`. |
| `VITE_ALLOWED_ORIGINS` | No viene de Firebase. Son las URLs desde las que se redirigira al IdP (desarrollo: ver bloque de ejemplo abajo). |

---

#### Opcion B: Solo GCP Console (sin abrir Firebase)

Si prefieres no usar la consola de Firebase, puedes obtener los valores asi:

1. **VITE_FIREBASE_PROJECT_ID:** Es el ID del proyecto que tienes seleccionado en GCP (barra superior). Ej. `etb-identity-omnicanal`.
2. **VITE_FIREBASE_AUTH_DOMAIN:** Construyelo: `TU_PROJECT_ID.firebaseapp.com` (el mismo ID del paso anterior).
3. **VITE_FIREBASE_API_KEY:** En GCP: **APIs & Services > Credentials** (o Google Auth Platform > Clients). Localiza la API Key de tipo "Browser key" (suele decir "auto created by Firebase") y haz clic en su nombre; ahi veras la clave (empieza por `AIzaSy...`). Es la misma que usaria Firebase para ese proyecto.

Con eso tienes las tres variables; `VITE_ALLOWED_ORIGINS` la defines tu (ej. `http://localhost:3000,http://localhost:5173`).

---

#### Crear el archivo `.env.local`

1. En la **raiz del proyecto** (misma carpeta donde esta `package.json`), crea un archivo llamado exactamente **`.env.local`** (con el punto delante).

2. Pega este contenido y **sustituye** los valores por los que obtuviste arriba:

```env
VITE_FIREBASE_API_KEY=AIzaSy...la_clave_que_copiaste_de_Firebase...
VITE_FIREBASE_AUTH_DOMAIN=etb-identity-omnicanal.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=etb-identity-omnicanal

# Origenes permitidos para redireccion OIDC (desarrollo)
VITE_ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173
```

- **VITE_FIREBASE_API_KEY:** el campo `apiKey` del bloque `firebaseConfig` en Firebase Console.
- **VITE_FIREBASE_AUTH_DOMAIN:** el campo `authDomain` del mismo bloque (normalmente `ID_DEL_PROYECTO.firebaseapp.com`).
- **VITE_FIREBASE_PROJECT_ID:** el campo `projectId` del mismo bloque.
- **VITE_ALLOWED_ORIGINS:** en desarrollo suele bastar `http://localhost:3000,http://localhost:5173` (IdP en 5173, cliente mock en 3000). Si usas otros puertos, anadelos separados por coma.

1. **Opcional: branding y credenciales de test:** en el mismo `.env.local` puedes anadir (segun `.env.example`):

```env
# VITE_APP_BRAND_NAME="Mi Empresa"
# VITE_APP_LOGO_URL="https://ejemplo.com/logo.png"

# Credenciales de prueba para E2E (deben existir como usuario en Identity Platform)
# TEST_USER_EMAIL=testuser@dummymail.com
# TEST_USER_PASSWORD=#123456789
```

1. **No subir secretos:** no hagas commit de `.env.local`; debe estar en `.gitignore` (ya lo esta en el proyecto).

---

### A.6 Configuracion white-label en runtime (opcional, sin recompilar)

El frontend puede leer configuracion desde **`public/config.js`**. Ese archivo define `window.APP_CONFIG`.

Referencia completa de campos disponibles:

| Campo | Tipo | Descripcion |
| ----- | ---- | ----------- |
| `allowedOrigins` | `string[]` | URLs desde las que se permite redireccion OIDC. Requerido en produccion. |
| `theme` | `object` | Nombre de marca, logo, colores, textos del hero. Ver seccion A.8 para detalles. |
| `enableLandingPage` | `boolean` | `true` en desarrollo para ver la landing. `false` en produccion si solo se expone el login. |
| `firebase` | `object` | Override de credenciales Firebase en runtime (`apiKey`, `authDomain`, `projectId`). Alternativa a `.env.local`. |
| `MODE` | `'IDP' \| 'MOCK'` | Modo de operacion. `IDP` para el proveedor de identidad (default). `MOCK` para el cliente de prueba. |
| `IDP_URL` | `string` | URL del IdP, usado por el mock client para construir la URL de redireccion OIDC. |
| `MOCK_CLIENT_URL` | `string` | URL del mock client, usado en configuracion de simulacion local. |
| `BACKEND_URL` | `string` | URL de backend opcional para integraciones que requieren llamadas servidor-a-servidor. |

Ejemplo de `public/config.js` para desarrollo:

```javascript
window.APP_CONFIG = {
  allowedOrigins: [
    "http://localhost:3000",
    "http://localhost:5173"
  ],
  enableLandingPage: true
};
```

Si usas **solo** `.env.local` y no tocas `config.js`, la app usara los valores por defecto del proyecto (incluido `allowedOrigins` en codigo o build).

---

### A.7 Ejecutar el IdP en local

Desde la raiz del proyecto:

```powershell
pnpm run dev
```

- El servidor de desarrollo (Vite) arranca en: **`http://localhost:5173`**.
- Abrir esa URL en el navegador; deberias ver la interfaz del IdP (landing y/o login).

---

### A.8 Probar con un cliente mock (simulacion completa)

Para simular una aplicacion que redirige al IdP (flujo OIDC completo):

```powershell
pnpm run dev:simulation
```

Este comando levanta **dos servidores simultaneamente**:

- **IdP** en `http://localhost:5173`
- **Mock Client** (relying party) en `http://localhost:3000`

Asegurate de que `http://localhost:3000` este en:

- `VITE_ALLOWED_ORIGINS` (o en `allowedOrigins` de `config.js`).
- Los HTTP Referrers de la API Key en GCP (seccion A.3.1).

---

### A.9 Pruebas automatizadas (local)

- **Unitarias (Vitest):**

  ```powershell
  pnpm run test
  ```

  Modo watch: `pnpm run test -- --watch`

- **E2E (Playwright):**

  ```powershell
  # Instalar navegadores (primera vez)
  pnpm exec playwright install

  # Ejecutar E2E (requiere dev:simulation corriendo, o lo levanta automaticamente)
  pnpm run test:e2e

  # Con interfaz visual para depuracion
  pnpm run test:e2e:ui
  ```

---

## PARTE B: CONFIGURACION PARA DESPLIEGUE EN GCP (PRODUCCION)

### B.1 Prerrequisitos de despliegue

| Requisito | Accion |
| --------- | ------ |
| **Google Cloud SDK** | Descargar e instalar desde: [GoogleCloudSDKInstaller.exe](https://dl.google.com/dl/cloudsdk/channels/rapid/GoogleCloudSDKInstaller.exe) (Windows). Verificar: `gcloud --version` |
| **Autenticacion** | En CMD o PowerShell: `gcloud auth login` (abre el navegador para iniciar sesion). |
| **Proyecto por defecto** | `gcloud config set project etb-identity-omnicanal` |
| **Permisos IAM** | Tu cuenta debe tener, como minimo: **Cloud Run Admin**, **Artifact Registry Admin**, **Secret Manager Admin** (o **Accessor** para solo leer secretos). Verificar en: `☰ Menu > IAM & Admin > IAM` |
| **Docker** | No es obligatorio si usas solo Cloud Build; si compilas localmente, el daemon de Docker debe estar en ejecucion. |

**Verificacion rapida de permisos IAM en la consola:**

```text
☰ Menu > IAM & Admin > IAM
```

URL directa: `https://console.cloud.google.com/iam-admin/iam?project=etb-identity-omnicanal`

Busca tu cuenta de correo en la lista y verifica que tenga los roles mencionados. Si no los tiene, un administrador del proyecto debe agregarlos con el boton **"Grant Access"** (Otorgar acceso).

---

### B.2 Variables que DEBES definir antes de desplegar

Abre el script **`scripts/one-shot-deploy.cmd`** (o anota estas variables si sigues DEPLOY.md a mano):

| Variable | Descripcion | Ejemplo |
| -------- | ----------- | ------- |
| **PROJECT_ID** | ID del proyecto GCP | `etb-identity-omnicanal` |
| **ARTIFACT_REPO_NAME** | Nombre del repositorio de imagenes Docker en Artifact Registry | `idp-repo` |
| **REGION** | Region de Cloud Run y Artifact Registry | `us-east1` |
| **VAL_FIREBASE_API_KEY** | API Key de Firebase (misma que en desarrollo) | `AIzaSy...` |
| **VAL_FIREBASE_AUTH_DOMAIN** | Dominio de Auth (ej. `PROJECT_ID.firebaseapp.com`) | `etb-identity-omnicanal.firebaseapp.com` |
| **VAL_FIREBASE_PROJECT_ID** | ID del proyecto (mismo que PROJECT_ID si es el mismo proyecto) | `etb-identity-omnicanal` |

En **`one-shot-deploy.cmd`** las lineas a editar son (aprox. lineas 24-44):

```cmd
set PROJECT_ID=etb-identity-omnicanal
set ARTIFACT_REPO_NAME=idp-repo
set REGION=us-east1
set VAL_FIREBASE_API_KEY=AIzaSy...
set VAL_FIREBASE_AUTH_DOMAIN=etb-identity-omnicanal.firebaseapp.com
set VAL_FIREBASE_PROJECT_ID=etb-identity-omnicanal
```

- **No dejar** el valor por defecto del script sin editar; el script fallara si no configuras el PROJECT_ID correcto.
- Si los secretos **ya existen** en Secret Manager, puedes dejar `VAL_FIREBASE_*` en blanco; el script no los sobrescribira.

---

### B.3 Despliegue con el script automatizado (recomendado)

1. Editar **`scripts/one-shot-deploy.cmd`** como en B.2.
2. Abrir CMD o PowerShell y situarse en la **raiz del proyecto**:

   ```cmd
   cd D:\ETBRepo\gcp\Acelerador-para-Cliente-OIDC-GCP-Idp
   ```

3. Ejecutar:

   ```cmd
   scripts\one-shot-deploy.cmd
   ```

4. El script:
   - Habilita APIs (Cloud Build, Artifact Registry, Cloud Run, Secret Manager, etc.).
   - Crea o reutiliza el repositorio de artefactos.
   - Crea una Service Account `idp-service-sa` y le asigna roles necesarios.
   - Crea o actualiza los secretos en Secret Manager (si definiste `VAL_FIREBASE_*`).
   - Ejecuta **Cloud Build** para construir la imagen Docker y subirla a Artifact Registry.
   - Despliega el servicio **idp-service** en Cloud Run con esa imagen e inyecta los secretos como variables de entorno.
   - Actualiza **VITE_ALLOWED_ORIGINS** con la URL del propio servicio y `http://localhost:3000`.

5. Al final, el script imprime la **URL del servicio** (ej. `https://idp-service-xxxxx-uc.a.run.app`) y recordatorios de pasos manuales.

---

### B.4 Pasos manuales OBLIGATORIOS despues del primer despliegue

Estos pasos deben completarse en la consola de GCP/Firebase. Sin ellos, el login en produccion fallara.

#### Paso 1: Agregar dominio de Cloud Run a "Authorized domains"

El dominio del servicio Cloud Run (ej. `idp-service-xxxxx-uc.a.run.app`) debe estar autorizado para que Firebase Auth permita la autenticacion desde produccion.

**Opcion A: Firebase Console (recomendada):**

```text
Firebase Console > Authentication > Settings > Authorized domains > Add domain
```

1. Abre <https://console.firebase.google.com/> y selecciona tu proyecto.
2. En el menu lateral: **Build** > **Authentication**.
3. Pestana **"Settings"** (Configuracion).
4. Seccion **"Authorized domains"** (Dominios autorizados).
5. Haz clic en **"Add domain"** (Agregar dominio).
6. Escribe el dominio de Cloud Run **sin** `https://`:

   ```text
   idp-service-xxxxx-uc.a.run.app
   ```

7. Confirma.

**Opcion B: Identity Platform (GCP Console):**

```text
☰ Menu > Identity Platform > Configuracion (engranaje) > pestana "Seguridad" > Dominios autorizados > Agregar un dominio
```

1. Ve a `https://console.cloud.google.com/customer-identity/settings?project=TU_PROJECT_ID`
2. Haz clic en la pestana **"Seguridad"** (Security).
3. En la seccion **"Dominios autorizados"**, haz clic en **"Agregar un dominio"**.
4. Escribe el dominio de Cloud Run (sin `https://`) y confirma.

---

#### Paso 2: Configurar la API Key para produccion

**Navegacion:**

```text
☰ Menu > Google Auth Platform > Clients > (tu API Key)
  (legacy: ☰ Menu > APIs & Services > Credentials > (tu API Key))
```

URL directa: `https://console.cloud.google.com/apis/credentials?project=etb-identity-omnicanal`

1. Haz clic en el nombre de la API Key usada por el IdP.
2. En **Application restrictions > Websites**, agrega:

   ```text
   https://idp-service-xxxxx-uc.a.run.app/*
   ```

   (Reemplaza `xxxxx-uc` por el sufijo real de tu servicio Cloud Run.)
3. En **API restrictions**, verifica que **Identity Toolkit API** y **Token Service API** esten permitidas.
4. Haz clic en **"Save"**.

---

#### Paso 3: Configurar credenciales OAuth 2.0 para produccion (si usas proveedor Google)

**Navegacion:**

```text
☰ Menu > Google Auth Platform > Clients > (tu OAuth 2.0 Client ID)
  (legacy: ☰ Menu > APIs & Services > Credentials > (tu OAuth 2.0 Client))
```

1. Haz clic en la credencial OAuth 2.0 de tipo "Web application".
2. **Authorized JavaScript origins**: agrega `https://idp-service-xxxxx-uc.a.run.app`
3. **Authorized redirect URIs**: agrega `https://idp-service-xxxxx-uc.a.run.app/__/auth/handler`
4. Haz clic en **"Save"**.

---

#### Paso 4: Actualizar VITE_ALLOWED_ORIGINS (si tienes clientes externos)

Si tienes aplicaciones cliente en otros dominios (ej. `https://app.miempresa.com`):

**Opcion A: Via CLI:**

```cmd
:: Obtener URL del servicio
for /f "tokens=*" %i in ('gcloud run services describe idp-service --region %REGION% --format^="value(status.url)"') do set SERVICE_URL=%i

:: Actualizar variable de entorno (separador: |)
gcloud run services update idp-service --region %REGION% --update-env-vars "VITE_ALLOWED_ORIGINS=%SERVICE_URL%^|https://app.miempresa.com^|http://localhost:3000"
```

**Opcion B: Desde la consola de Cloud Run:**

```text
☰ Menu > Cloud Run > idp-service > Edit & Deploy New Revision
  > Container(s) tab > Environment variables > VITE_ALLOWED_ORIGINS
```

1. Ve a `https://console.cloud.google.com/run?project=etb-identity-omnicanal`
2. Haz clic en el servicio **"idp-service"**.
3. Haz clic en **"Edit & Deploy New Revision"** (Editar e implementar nueva revision).
4. En la pestana **"Container(s)"**, baja a **"Environment variables"** (Variables de entorno).
5. Edita `VITE_ALLOWED_ORIGINS` con los dominios separados por `|`.
6. Haz clic en **"Deploy"** (Implementar).

---

### B.5 Despliegue manual (sin one-shot-deploy.cmd)

Si prefieres seguir DEPLOY.md a mano:

1. **Definir variables de sesion** (en la misma ventana de CMD donde ejecutaras los comandos):

   ```cmd
   set PROJECT_ID=etb-identity-omnicanal
   set ARTIFACT_REPO_NAME=idp-repo
   set REGION=us-east1
   set VAL_FIREBASE_API_KEY=AIzaSy...
   set VAL_FIREBASE_AUTH_DOMAIN=etb-identity-omnicanal.firebaseapp.com
   set VAL_FIREBASE_PROJECT_ID=etb-identity-omnicanal
   ```

2. **Habilitar APIs:**

   ```cmd
   gcloud services enable cloudbuild.googleapis.com artifactregistry.googleapis.com run.googleapis.com secretmanager.googleapis.com --project=%PROJECT_ID%
   ```

3. **Crear Artifact Registry** (si no existe):

   ```cmd
   gcloud artifacts repositories create %ARTIFACT_REPO_NAME% --repository-format=docker --location=%REGION% --description="Registro de Imagenes OIDC" --project=%PROJECT_ID%
   ```

4. **Crear/actualizar secretos** (ejemplo para FIREBASE_API_KEY):

   ```cmd
   echo %VAL_FIREBASE_API_KEY%| gcloud secrets create FIREBASE_API_KEY --data-file=- --project=%PROJECT_ID%
   ```

   (Si ya existe, usar `gcloud secrets versions add FIREBASE_API_KEY --data-file=-` leyendo desde stdin.) Repetir para `FIREBASE_AUTH_DOMAIN` y `FIREBASE_PROJECT_ID`.

5. **Compilar y subir imagen:**

   ```cmd
   gcloud builds submit --tag %REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/idp-service --project=%PROJECT_ID%
   ```

6. **Desplegar en Cloud Run:**

   ```cmd
   gcloud run deploy idp-service --image %REGION%-docker.pkg.dev/%PROJECT_ID%/%ARTIFACT_REPO_NAME%/idp-service --platform managed --region %REGION% --allow-unauthenticated --set-env-vars APP_MODE=IDP --set-env-vars "VITE_ALLOWED_ORIGINS=TU_URL_AQUI" --set-secrets VITE_FIREBASE_API_KEY=FIREBASE_API_KEY:latest --set-secrets VITE_FIREBASE_AUTH_DOMAIN=FIREBASE_AUTH_DOMAIN:latest --set-secrets VITE_FIREBASE_PROJECT_ID=FIREBASE_PROJECT_ID:latest --project=%PROJECT_ID%
   ```

   Sustituir `TU_URL_AQUI` por la URL del servicio (o la lista separada por `|` que uses).

Despues de esto, realizar los mismos pasos manuales de B.4 (Authorized domains, HTTP referrers, API restrictions, OAuth origins/redirect URIs).

---

## Resumen: Donde se configura cada cosa en la consola

Esta tabla de referencia rapida mapea cada configuracion a su ubicacion exacta en la consola:

| Que configurar | Donde en la consola | URL directa |
| -------------- | ------------------- | ----------- |
| **API Key (HTTP referrers + API restrictions)** | `☰ > Google Auth Platform > Clients > (API Key)` | `console.cloud.google.com/apis/credentials` |
| **OAuth 2.0 (JS origins + redirect URIs)** | `☰ > Google Auth Platform > Clients > (OAuth Client)` | `console.cloud.google.com/apis/credentials` |
| **Authorized domains (Firebase)** | `Firebase Console > Authentication > Settings > Authorized domains` | `console.firebase.google.com` |
| **Authorized domains (Identity Platform)** | `☰ > Identity Platform > Configuracion > Seguridad > Dominios autorizados > Agregar un dominio` | `console.cloud.google.com/customer-identity/settings` |
| **Identity providers (Email, Google, etc.)** | `☰ > Identity Platform > Providers > Add A Provider` | `console.cloud.google.com/customer-identity/providers` |
| **Habilitar APIs (Identity Toolkit, Token Service)** | `☰ > APIs & Services > Enabled APIs & Services > + Enable` | `console.cloud.google.com/apis/library` |
| **Secretos (Secret Manager)** | `☰ > Security > Secret Manager` | `console.cloud.google.com/security/secret-manager` |
| **Cloud Run (servicio, env vars)** | `☰ > Cloud Run > (servicio) > Edit & Deploy` | `console.cloud.google.com/run` |
| **Artifact Registry (imagenes Docker)** | `☰ > Artifact Registry > Repositories` | `console.cloud.google.com/artifacts` |
| **IAM (permisos de usuario/service account)** | `☰ > IAM & Admin > IAM` | `console.cloud.google.com/iam-admin/iam` |

---

## Resumen de archivos clave del proyecto

| Archivo | Uso |
| ------- | --- |
| **`.env.local`** | Variables de entorno para desarrollo (Firebase, origenes). No commitear. |
| **`.env.example`** | Plantilla de variables; copiar a `.env.local` y rellenar. |
| **`public/config.js`** | Configuracion en runtime: `allowedOrigins`, tema, landing. |
| **`src/index.css`** | Variables CSS de marca (`:root`) si se personaliza en codigo. |
| **`public/branding/default/logo.png`** | Logo por defecto (reemplazar para white-label). |
| **`scripts/one-shot-deploy.cmd`** | Script de despliegue completo; editar variables al inicio. |
| **`DEVELOPERS.md`** | Guia desarrollador (configuracion local y pruebas). |
| **`DEPLOY.md`** | Guia de despliegue detallada, troubleshooting y politicas de organizacion. |

---

## Errores frecuentes y que revisar

| Mensaje / sintoma | Causa | Donde revisar en la consola |
| ----------------- | ----- | --------------------------- |
| `auth/requests-from-referer-blocked` | La API Key no permite el dominio desde donde se hace la peticion. | `Google Auth Platform > Clients > (API Key) > Application restrictions > Websites` |
| `auth/unauthorized-domain` | El dominio no esta en la lista de dominios autorizados de Firebase Auth. | `Firebase Console > Authentication > Settings > Authorized domains` |
| "El dominio ... no esta autorizado" (mensaje del IdP) | `VITE_ALLOWED_ORIGINS` no incluye el dominio del cliente que redirige. | Cloud Run > idp-service > variable de entorno `VITE_ALLOWED_ORIGINS` |
| Login correcto pero no redirige con token | Token Service API no esta permitida en la API Key. | `Google Auth Platform > Clients > (API Key) > API restrictions` |
| `Illegal url for new iframe` | Secretos en Secret Manager con caracteres extra (espacios/saltos de linea). | `☰ > Security > Secret Manager > (secreto) > Versions` — verificar que el valor no tenga espacios al final. |
| One-shot falla por permisos (organizacion) | Politica "Domain Restricted Sharing" bloquea `allUsers`. | `☰ > IAM & Admin > Organization Policies > "Domain restricted sharing"`. Ver DEPLOY.md seccion 9. |
| `PERMISSION_DENIED` al desplegar | La cuenta no tiene los roles IAM necesarios. | `☰ > IAM & Admin > IAM` — verificar roles Cloud Run Admin, Artifact Registry Admin, Secret Manager Admin. |

---

Si algo no cuadra con tu entorno (por ejemplo otra region o otro nombre de servicio), ajusta los comandos usando la misma logica: mismo `PROJECT_ID`, misma `REGION`, mismos nombres de secretos y de servicio.
