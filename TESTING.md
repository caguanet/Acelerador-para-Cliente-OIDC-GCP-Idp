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

## 4. Troubleshooting & Maintenance

### 👻 Automated Cleanup (Safe Mode)
The project uses a **Clean-on-Start** strategy (`scripts/cleanup-ports.mjs`).
*   **Automatic**: Runs automatically before `npm run dev:simulation` or `npx playwright test`.
*   **Surgical**: Only kills processes on ports **3000** and **5173**. It does *not* kill your other Node work.
*   **Retry-Safe**: If a test crashes, just re-run it. The new run will self-heal the environment.

### 📦 Git Tracking
New tests (e.g., `tests/e2e/specs/*.spec.ts`) are **not automatically added** to the repository.
**Solution:**
```bash
git add tests/
git commit -m "feat: Add Playwright E2E tests"
```

## 3. Manual Verification (OIDC Flow)
To test the flow manually without a real client app:

1.  Start the IDP: `npm run dev` (http://localhost:5173).
2.  Construct a URL:
    ```
    http://localhost:5173/?redirect_uri=https://example.com&client_id=test-client&state=123
    ```
    *(Note: Add `https://example.com` to `VITE_ALLOWED_ORIGINS` in `.env` first)*
3.  Verify:
    *   Login Modal appears (Background is blurred/unclickable).
    *   After login, browser redirects to `https://example.com/#id_token=...`
