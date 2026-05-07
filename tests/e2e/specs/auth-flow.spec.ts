import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { MockClientPage } from '../pages/MockClientPage';

const TEST_USER = {
  email: process.env.TEST_USER_EMAIL || `test-automation-${Date.now()}@etb.com`,
  password: process.env.TEST_USER_PASSWORD || 'securePassword123!',
};

/**
 * Login E2E: credenciales en .env.local + opt-in explícito (evita fallo rojo si el usuario no existe en Firebase).
 * Ej.: `E2E_AUTH_LOGIN=1 npx playwright test --project=chromium`
 */
const canRunLoginE2E =
  (process.env.E2E_AUTH_LOGIN === '1' || process.env.E2E_AUTH_LOGIN === 'true') &&
  Boolean(process.env.TEST_USER_EMAIL?.trim()) &&
  Boolean(process.env.TEST_USER_PASSWORD?.trim());

test.describe('Authentication Flow (Happy Path)', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(90_000);

  test('Positive Flow: Register New User and Receive Token', async ({ page }) => {
    // 1. Initialize POMs
    const mockPage = new MockClientPage(page);
    const loginPage = new LoginPage(page);
    
    // Unique "borrame" user
    const timestamp = Date.now();
    const uniqueEmail = `borrame${timestamp}@dummymail.com`;
    console.log(`[TEST] Creating User: ${uniqueEmail}`);

    // DIRECT NAVIGATION STRATEGY
    // We bypass the Mock Client click to avoid flake/redirect issues.
    // We construct the URL exactly as a Client would.
    const idpUrl = 'http://localhost:5173/?client_id=test-client&redirect_uri=http://localhost:3000&state=test-state';
    
    console.log(`[TEST] Navigating directly to IdP: ${idpUrl}`);
    await page.goto(idpUrl, { waitUntil: 'domcontentloaded' });

    // 4. Verify Redirection to IdP
    await expect(page).toHaveURL(/localhost:5173/);
    
    // 5. Fail Fast: Check for Security Error
    await expect(page.getByText('Acceso No Autorizado')).not.toBeVisible();

    // 6. Verify Identity Provider UI (Heading)
    // We use a longer timeout (10s) to account for:
    // 1. Vite dev server "cold start" latency
    // 2. Client-side hydration
    // 3. Entry animations (modalSlide)
    await expect(
      page.getByRole('heading', { name: /Inicia sesión en tu cuenta|Portal de Acceso/i })
    ).toBeVisible({ timeout: 10000 });

    // 7. Registro Hogares (incluye clic en Regístrate; no duplicar switchToRegister fuera del POM)
    await loginPage.completeHogaresRegistration({
      displayName: 'Prueba',
      email: uniqueEmail,
      password: 'securePassword123!',
    });

    // 8. Verify Redirection back to Client
    await expect(page).toHaveURL(/localhost:3000/);

    // 9. Verify Token Reception
    await mockPage.verifyTokenReceived();
  });

  test('Positive Flow: Login with Existing User and Receive Token', async ({ page }) => {
    test.skip(
      !canRunLoginE2E,
      'Activa E2E_AUTH_LOGIN=1 y define TEST_USER_EMAIL / TEST_USER_PASSWORD con un usuario existente en Firebase (.env.local).'
    );

    // 1. Initialize POMs
    const mockPage = new MockClientPage(page);
    const loginPage = new LoginPage(page);
    
    const email = TEST_USER.email;
    const password = TEST_USER.password;

    console.log(`[TEST] Logging in with Existing User: ${email}`);

    // DIRECT NAVIGATION STRATEGY
    const idpUrl = 'http://localhost:5173/?client_id=test-client&redirect_uri=http://localhost:3000&state=test-state';
    
    console.log(`[TEST] Navigating directly to IdP: ${idpUrl}`);
    await page.goto(idpUrl, { waitUntil: 'domcontentloaded' });

    // 4. Verify Redirection to IdP
    await expect(page).toHaveURL(/localhost:5173/);
    
    // 5. Fail Fast: Check for Security Error
    await expect(page.getByText('Acceso No Autorizado')).not.toBeVisible();
    await expect(
      page.getByRole('heading', { name: /Inicia sesión en tu cuenta|Portal de Acceso/i })
    ).toBeVisible({ timeout: 10000 });

    // 6. Perform Login (Directly)
    await loginPage.loginWithEmail(email, password);

    // 7. Verify Redirection back to Client
    await expect(page).toHaveURL(/localhost:3000/);

    // 8. Verify Token Reception
    await mockPage.verifyTokenReceived();
  });
});

test.describe('Security & Restrictions', () => {
  test('should block access with invalid redirect_uri', async ({ page }) => {
    const idpUrl = 'http://localhost:5173';
    const maliciousUrl = `${idpUrl}/?client_id=test-client&redirect_uri=https://evil.com&state=123`;

    await page.goto(maliciousUrl);

    // Verify Error Message
    // Use getByRole for the heading to avoid strict mode violation (multiple matches)
    await expect(page.getByRole('heading', { name: /no autorizado/i })).toBeVisible();
    
    // Ensure it did NOT redirect to evil.com (check origin, not query params)
    const currentUrl = new URL(page.url());
    expect(currentUrl.hostname).not.toBe('evil.com');
    // In local dev, hostname is localhost
    expect(currentUrl.hostname).toBe('localhost');
  });
});
