# Testing Guide: OIDC Service

**Verification strategies for the Identity Provider.**

## 1. Unit Tests (`pnpm run test`)
Validates the core business logic in `src/App.tsx` and utility functions.
*   **OIDC Parameter Parsing**: Ensures `redirect_uri` and `client_id` are correctly extracted.
*   **Whitelist Validation**: Verifies that invalid `redirect_uri`s are rejected.
*   **Mode Switching**: Confirms the app enters "IDP Mode" when OIDC params are present.

### 1.1. BFF unit/integration tests (`pnpm run test:bff`)
`server/server.test.js` imports the Express app without opening the Cloud Run port and runs the BFF routes against an ephemeral local HTTP server. External systems are mocked at the process boundary, not inside the handlers:
*   **Public config safety**: `/config.js` must expose only browser-safe Firebase/OIDC/reCAPTCHA site values and must not leak MuleSoft, Admin SDK or backend reCAPTCHA secrets.
*   **Browser-origin protection**: protected `/api/...` routes reject unauthorized `Origin` values before calling Firebase Admin, MuleSoft or reCAPTCHA.
*   **Email OTP login happy path**: `/api/customer/otp/start-login` -> MS-2, `/api/customer/otp/validate` -> MS-3 and `/api/auth/login/complete` -> Firebase Admin custom token.
*   **Anti-enumeration**: non-eligible emails receive the same generic start response and never call MuleSoft.
*   **Anti-abuse**: invalid OTP attempts lock the session and block resend with the two-hour lock message.
*   **Security validation**: invalid reCAPTCHA Enterprise assessments fail before account lookup.

These tests are included in `pnpm run test` and therefore in `pnpm run verify:regression`; use `pnpm run test:bff` when iterating only on `server/server.js`.

## 2. End-to-End Tests (`pnpm exec playwright test`)
Simulates a real user logging in through the IDP using a **Deterministic Registration Pattern**.

### Scenarios Covered
1.  **Happy Path (New User - Registration)**:
    *   **Goal**: Verify the entire OIDC flow from Client -> IdP -> Client for a NEW user.
    *   **Strategy**: Generate a unique email (`borrame{timestamp}@dummymail.com`), navigate to IdP, **register immediately**, and verify the auth token is received by the mock client.
    *   **Why Registration?**: Eliminates "User Not Found" errors and race conditions associated with checking for existence.

2.  **Happy Path (Email Link Login)**:
    *   **Goal**: Verify login with the Firebase Email Link/passwordless entry point.
    *   **Strategy**: Use a registered test email and complete the Identity Platform email-link flow, then verify the mock client receives an auth token.
    *   **Opt-in**: el spec solo ejecuta este caso si defines `E2E_AUTH_LOGIN=1` (o `true`) al lanzar Playwright, porque requiere proyecto Firebase y plantilla de correo configurados.

3.  **Happy Path (Codigo OTP Login)**:
    *   **Goal**: Verificar que la pestaña `Codigo OTP` autentica al usuario real en Identity Platform y retorna `id_token` al mock cliente.
    *   **Strategy**: Usar un correo ETB habilitado, solicitar OTP por MiUso/MS-2, leer el correo mas reciente, validar por MS-3, completar `signInWithCustomToken` y verificar retorno OIDC.
    *   **Opt-in/manual**: requiere servicios MuleSoft reales, reCAPTCHA configurado, dominio Cloud Run autorizado en Firebase/Auth y acceso al buzon de prueba. No debe ejecutarse contra mocks cuando el objetivo sea validar integracion real.

4.  **Security Rejection**:
    *   **Goal**: Verify that the IdP blocks unauthorized clients/redirects.
    *   **Strategy**: Navigate directly to IdP with a malicious `redirect_uri` (e.g., `evil.com`).
    *   **Expectation**: The "Portal de Acceso" (Login Form) **must not render**. An error message "Acceso No Autorizado" is displayed.

### Running Tests
```bash
# 1. Install Browsers (First Time)
pnpm exec playwright install

# 2. Run All Tests (Headless)
pnpm exec playwright test

# 3. UI Mode (Debug)
pnpm exec playwright test --ui
```

### 👻 Troubleshooting Errors

*   **`auth/requests-from-referer-blocked` / `API_KEY_HTTP_REFERRER_BLOCKED`**: Inicia sesión en la consola de GCP y añade `http://localhost:5173/*`, `http://localhost:3000/*` y `https://<PROJECT_ID>.firebaseapp.com/*` (o la URL de tu entorno) a los **HTTP Referrers** de tu API Key. Para email link/passwordless, el action handler corre primero desde `firebaseapp.com`, no desde `localhost`.
    * Para Cloud Run preview, agregar tambien el dominio exacto y con `/*`, por ejemplo `https://idp-service-otp-preview-2tczqvffra-ue.a.run.app` y `https://idp-service-otp-preview-2tczqvffra-ue.a.run.app/*`.
*   **`UNAUTHORIZED_DOMAIN`**: Agrega el dominio del IdP en `Identity Platform > Settings > Authorized domains` sin protocolo ni path.
*   **`Permission 'iam.serviceAccounts.signBlob' denied`**: La service account de Cloud Run no puede firmar `customToken`; otorgar permiso de firma como se documenta en `GCP_FIREBASE_PROD_CONFIGURATION.md`.
*   **OTP correcto reportado como invalido**: confirmar que el codigo corresponde al correo mas reciente de la misma sesion. MS-3 valida contra `id_transaccion`; codigos antiguos o de otra sesion fallan aunque sean numericamente correctos.
*   **`Error de API Restrictions`**: Verifica que tu API Key permita el acceso a `Identity Toolkit API` y `Token Service API`.

### 👻 Automated Cleanup (Safe Mode)
The project uses a **Clean-on-Start** strategy (`scripts/cleanup-ports.mjs`).
*   **Automatic**: Runs automatically before `pnpm run dev:simulation` or `pnpm exec playwright test`.
*   **Surgical**: Only kills processes on ports **3000** and **5173**. It does *not* kill your other Node work.
*   **Retry-Safe**: If a test crashes, just re-run it. The new run will self-heal the environment.

### CI en GitHub Actions
*   **`ci.yml`** (automático en push/PR): `pnpm install --frozen-lockfile`, `node scripts/verify-skills-lock.mjs` (sin carpeta `.agents/skills` en el checkout sólo avisa; variable de repositorio `STRICT_SKILLS_LOCK=true` fuerza fallo si versiona skills), `pnpm run verify:regression` (build + Vitest), `pnpm audit --audit-level=critical` informativo.
*   **`e2e-manual.yml`** (*workflow_dispatch*): Playwright sólo Chromium (`pnpm run test:e2e:ci`). Requiere secretos `VITE_FIREBASE_*` (y opcionalmente `TEST_USER_*`) porque sin proyecto Firebase la UI E2E no es determinística en CI.

### 📦 Git Tracking
New tests (e.g., `tests/e2e/specs/*.spec.ts`) are **not automatically added** to the repository.
**Solution:**
```bash
git add tests/
git commit -m "feat: Add Playwright E2E tests"
```

## 3. Manual Verification

### 3.1. Scenario A: Helper Client (Recommended)
Use the included **Mock Client** to simulate a real OIDC Relying Party. This runs two servers: one for the IdP (5173) and one for the Client (3000).

1.  **Start the Simulation**:
    ```bash
    pnpm run dev:simulation
    ```
2.  **Access the Client**:
    Open [http://localhost:3000](http://localhost:3000).
3.  **Execute Flow**:
    *   Click **"Login with Identity Provider"**.
    *   Observe redirect to IdP (port 5173).
    *   Authenticate (or register).
    *   PROFIT: Redirect back to Client (3000) with `id_token`.
    *   **Verify**: The token is decoded/displayed in the "Authenticated" box.

### 3.2. Scenario B: Raw URL (Sanity Check)
To test the flow manually without the mock client:

1.  Start the IDP: `pnpm run dev` (http://localhost:5173).
2.  Construct a URL (ensure `https://example.com` is in `VITE_ALLOWED_ORIGINS`):
    ```
    http://localhost:5173/?redirect_uri=https://example.com&client_id=test-client&state=123
    ```
3.  Verify:
    *   Login Modal appears.
    *   After login, browser redirects to `https://example.com/#id_token=...`

### 3.3. Scenario C: Login Codigo OTP en Cloud Run preview

1. Validar el preview aislado:
    ```bash
    curl -fsS https://idp-service-otp-preview-2tczqvffra-ue.a.run.app/api/health
    PUBLIC_BASE_URL=https://idp-service-otp-preview-2tczqvffra-ue.a.run.app pnpm run verify:public-config
    ```
2. Abrir el mock preview:
    ```text
    https://mock-client-otp-preview-2tczqvffra-ue.a.run.app
    ```
3. Iniciar login hacia el IdP.
4. Seleccionar `Codigo OTP`.
5. Solicitar codigo para un correo ETB habilitado.
6. Usar el OTP mas reciente del correo.
7. Confirmar retorno al mock con `id_token`.
8. Revisar logs:
    ```bash
    gcloud logging read \
      'resource.type="cloud_run_revision" AND resource.labels.service_name="idp-service-otp-preview" AND ("mulesoft.ms2.response" OR "mulesoft.ms3.response" OR "login.otp.success" OR "Error issuing login custom token")' \
      --project=etb-identity-omnicanal \
      --limit=50 \
      --format='table(timestamp,severity,textPayload,jsonPayload.event,jsonPayload.status)'
    ```

## 4. Viewports responsive (checklist + automatización)

### Checklist manual (DevTools → dimensiones o dispositivo real)

Con `pnpm run dev:simulation` (IdP `5173` + mock `3000`), revisar en **320**, **375**, **414** y **768** px de ancho:

| Pantalla | Qué comprobar |
|----------|----------------|
| **IdP** (`5173` con `redirect_uri` del mock) | Título de login visible; tarjeta centrada sin barra horizontal; campo de correo visible; CTA de enlace de acceso; accesos sociales visibles; recuperación de contraseña accesible; **bloque “Descarga y conoce la app Mi ETB”** con tres enlaces a tiendas bajo la tarjeta; claim “Serás lo que creas” al pie. |
| **Mock cliente** (`3000`) | Botón principal visible; hero y tarjeta sin solape; token (tras login) con scroll si es largo. |

### Automatizado

`tests/e2e/specs/viewport-layout.spec.ts` recorre esos anchos en IdP y mock y comprueba que la tarjeta IdP quepa en el viewport y que el bloque móvil de tiendas muestre tres badges; en **1280px** comprueba que ese bloque esté oculto (paridad con desktop PNG).

```bash
pnpm exec playwright test tests/e2e/specs/viewport-layout.spec.ts --project=chromium
```
