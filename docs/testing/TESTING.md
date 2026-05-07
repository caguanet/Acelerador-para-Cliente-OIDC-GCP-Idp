# Testing Guide: OIDC Service

**Verification strategies for the Identity Provider.**

## 1. Unit Tests (`npm run test`)
Validates the core business logic in `src/App.tsx` and utility functions.
*   **OIDC Parameter Parsing**: Ensures `redirect_uri` and `client_id` are correctly extracted.
*   **Whitelist Validation**: Verifies that invalid `redirect_uri`s are rejected.
*   **Mode Switching**: Confirms the app enters "IDP Mode" when OIDC params are present.

## 2. End-to-End Tests (`npx playwright test`)
Simulates a real user logging in through the IDP using a **Deterministic Registration Pattern**.

### Scenarios Covered
1.  **Happy Path (New User - Registration)**:
    *   **Goal**: Verify the entire OIDC flow from Client -> IdP -> Client for a NEW user.
    *   **Strategy**: Generate a unique email (`borrame{timestamp}@dummymail.com`), navigate to IdP, **register immediately**, and verify the auth token is received by the mock client.
    *   **Why Registration?**: Eliminates "User Not Found" errors and race conditions associated with checking for existence.

2.  **Happy Path (Existing User - Login)**:
    *   **Goal**: Verify login for a pre-existing user (configured in `.env`).
    *   **Strategy**: Use `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` to log in directly.
    *   **Pre-requisite**: The user defined in `.env` MUST exist in the Firebase Auth project.

3.  **Security Rejection**:
    *   **Goal**: Verify that the IdP blocks unauthorized clients/redirects.
    *   **Strategy**: Navigate directly to IdP with a malicious `redirect_uri` (e.g., `evil.com`).
    *   **Expectation**: The "Portal de Acceso" (Login Form) **must not render**. An error message "Acceso No Autorizado" is displayed.

### Running Tests
```bash
# 1. Install Browsers (First Time)
npx playwright install

# 2. Run All Tests (Headless)
npx playwright test

# 3. UI Mode (Debug)
npx playwright test --ui
```

### 👻 Troubleshooting Errors

*   **`auth/requests-from-referer-blocked`**: Inicia sesión en la consola de GCP y añade `http://localhost:5173/*` (o la URL de tu entorno) a los **HTTP Referrers** de tu API Key.
*   **`Error de API Restrictions`**: Verifica que tu API Key permita el acceso a `Identity Toolkit API` y `Token Service API`.

### 👻 Automated Cleanup (Safe Mode)
The project uses a **Clean-on-Start** strategy (`scripts/cleanup-ports.mjs`).
*   **Automatic**: Runs automatically before `npm run dev:simulation` or `npx playwright test`.
*   **Surgical**: Only kills processes on ports **3000** and **5173**. It does *not* kill your other Node work.
*   **Retry-Safe**: If a test crashes, just re-run it. The new run will self-heal the environment.

### CI en GitHub Actions
*   **`ci.yml`** (automático en push/PR): `npm ci`, `node scripts/verify-skills-lock.mjs` (sin carpeta `.agents/skills` en el checkout sólo avisa; variable de repositorio `STRICT_SKILLS_LOCK=true` fuerza fallo si versiona skills), `npm run verify:regression` (build + Vitest), `npm audit --audit-level=critical` informativo.
*   **`e2e-manual.yml`** (*workflow_dispatch*): Playwright sólo Chromium (`npm run test:e2e:ci`). Requiere secretos `VITE_FIREBASE_*` (y opcionalmente `TEST_USER_*`) porque sin proyecto Firebase la UI E2E no es determinística en CI.

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
    npm run dev:simulation
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

1.  Start the IDP: `npm run dev` (http://localhost:5173).
2.  Construct a URL (ensure `https://example.com` is in `VITE_ALLOWED_ORIGINS`):
    ```
    http://localhost:5173/?redirect_uri=https://example.com&client_id=test-client&state=123
    ```
3.  Verify:
    *   Login Modal appears.
    *   After login, browser redirects to `https://example.com/#id_token=...`
