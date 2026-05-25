# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Local development (IdP only, port 5173)
pnpm run dev

# Full simulation (IdP + mock client on port 3000) — required for E2E tests
pnpm run dev:simulation

# Build for production
pnpm run build

# Unit tests (Vitest)
pnpm test

# E2E tests (Playwright, requires dev:simulation running or will auto-start it)
pnpm run test:e2e

# Interactive Playwright UI
pnpm run test:e2e:ui
```

## Architecture

This is a **stateless, White-Label OIDC Identity Provider** that acts as an identity broker between client applications and GCP Identity Platform (Firebase Auth). It implements the **OIDC Implicit Flow** — no backend token exchange; the ID token is returned directly as a URL hash fragment (`#id_token=...`).

### Request Flow

1. Client app redirects to IdP with OIDC params: `?client_id=...&redirect_uri=...&response_type=id_token&nonce=...`
2. [App.tsx](src/App.tsx) validates `redirect_uri` against `window.APP_CONFIG.allowedOrigins` whitelist
3. User authenticates via Firebase (`signInWithEmailAndPassword`)
4. IdP calls `getIdToken()` and redirects back: `{redirect_uri}#id_token={token}`
5. Client app receives the token in the hash fragment

### Token refresh (silent refresh)

The ID token has a limited lifetime (e.g. 1 hour). To extend the session without asking the user to log in again, the client can use **silent refresh**:

- **IdP support:** When the client sends `prompt=none` in the auth URL, the IdP does **not** show the login form. It checks whether Firebase has an active session on the IdP origin. If yes, it calls `getIdToken(true)` and redirects back with a fresh `id_token`. If no session, it redirects back with `#error=login_required&error_description=...&state=...`.
- **Client responsibility:** Decode the JWT to read `exp` (expiration time). Before expiry (e.g. 5–10 minutes), redirect the user to the IdP with the same `client_id`, `redirect_uri`, `state`, and `prompt=none`. The user stays on the client; if they had an IdP session (same browser), they get a new token in the hash and can replace the stored token. If `error=login_required` is returned, the client should prompt for full login again.

Example IdP URL for silent refresh:  
`{IDP_URL}/?client_id=...&redirect_uri=...&response_type=id_token&state=...&prompt=none`

### Key Files

- [src/App.tsx](src/App.tsx) — Core OIDC logic: URL param parsing, origin validation, Firebase auth flow, token redirect
- [src/config/theme.ts](src/config/theme.ts) — `ThemeConfig` interface; merges `window.APP_CONFIG.theme` with defaults at runtime
- [src/index.css](src/index.css) — CSS custom properties (`--brand-primary`, `--brand-secondary`, etc.) that drive white-label theming
- [public/config.js](public/config.js) — Runtime configuration injected before React loads; controls `allowedOrigins`, Firebase config override, and theme
- [server/server.js](server/server.js) — Express static server that serves the built frontend (used in Docker/Cloud Run)

### White-Label Customization

There are two layers:

**Runtime (no rebuild needed):** Modify `window.APP_CONFIG` in `public/config.js` — controls `theme`, `firebase` credentials, and `allowedOrigins`. In development, you can also paste overrides directly in the browser console.

**Build-time (requires `pnpm run build`):** Edit CSS variables in `src/index.css`, replace `public/branding/default/logo.png`, or set `VITE_APP_BRAND_NAME` / `VITE_APP_LOGO_URL` environment variables.

### Environment Variables

Copy `.env.example` to `.env.local`. Required variables:

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_ALLOWED_ORIGINS       # Comma-separated allowed redirect origins
```

Test credentials for E2E:
```
TEST_USER_EMAIL
TEST_USER_PASSWORD
```

### Deployment

Production runs on **GCP Cloud Run** via a multi-stage Docker build (Node 18 Alpine builder → Express static server on port 8080).

Automated deployment: `scripts/one-shot-deploy.cmd` handles API enablement, Artifact Registry, service account, Secret Manager secrets, Cloud Build, and Cloud Run deployment.

## Testing Structure

- **Unit tests** (Vitest + jsdom): `src/App.test.tsx` and co-located test files
- **E2E tests** (Playwright): `tests/e2e/` with Page Object pattern (`LoginPage`, `MockClientPage`). The mock client at `mock-client/` simulates a relying party for full OIDC flow testing.

## Git Conventions

Branch naming: `type/description` (e.g., `feat/new-login-ui`, `fix/origin-validation`)
Commit format: `type: description` — allowed types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
