import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { MockClientPage } from '../pages/MockClientPage';

/**
 * Login E2E: envío de email link con proyecto Firebase real + opt-in explícito.
 * Ej.: `E2E_AUTH_LOGIN=1 TEST_USER_EMAIL=cliente@dominio.com npx playwright test --project=chromium`
 */
const canRunLoginE2E =
  process.env.E2E_AUTH_LOGIN === '1' || process.env.E2E_AUTH_LOGIN === 'true';

test.describe('Mock launcher OIDC request', () => {
  test('builds the configured ETB implicit request parameters', async ({ page }) => {
    const mockPage = new MockClientPage(page);

    await mockPage.goto();
    await mockPage.startLoginFlow();
    await expect(page).toHaveURL(/localhost:5173/);

    const url = new URL(page.url());
    expect(url.searchParams.get('client_id')).toBe('etb-identity-omnicanal');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://pedrocasas.pau.solutions/firebase/callback.php'
    );
    expect(url.searchParams.get('response_type')).toBe('token');
    expect(url.searchParams.get('scope')).toBe('openid profile email');
    expect(url.searchParams.get('state')).toMatch(/^login-[a-z0-9]+-[a-f0-9]{32}$/);
    expect(url.searchParams.get('state')).not.toBe('domn4');
    expect(url.searchParams.get('nonce')).toMatch(/^nonce-[a-z0-9]+-[a-f0-9]{24}$/);
    expect(url.searchParams.get('nonce')).not.toBe('mvbjqb');
  });

  test('rejects callback fragments when state and nonce do not match the stored request', async ({ page }) => {
    await page.goto('/#id_token=fake-token&state=domn4&nonce=mvbjqb');

    await expect(
      page.getByText(/No pudimos validar la respuesta del IdP/i)
    ).toBeVisible();
  });

  test('accepts callback fragments in a new tab when state and nonce exist in localStorage', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('mock_oidc_state', 'login-cross-tab');
      window.localStorage.setItem('mock_oidc_nonce', 'nonce-cross-tab');
    });

    const callbackPage = await page.context().newPage();
    await callbackPage.goto('/#id_token=fake-token&state=login-cross-tab&nonce=nonce-cross-tab');

    await expect(callbackPage.getByText(/Sesión simulada activa/i)).toBeVisible();
    await expect(callbackPage.getByText(/Parámetros recibidos en el callback/i)).toBeVisible();
    await expect(callbackPage.getByText('login-cross-tab')).toBeVisible();
    await expect(callbackPage.getByText('nonce-cross-tab')).toBeVisible();
    await expect(callbackPage.getByText(/No pudimos validar la respuesta del IdP/i)).not.toBeVisible();
  });
});

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

  test('Positive Flow: Request Email Link Login', async ({ page }) => {
    test.skip(
      !canRunLoginE2E || !process.env.TEST_USER_EMAIL,
      'Activa E2E_AUTH_LOGIN=1 y TEST_USER_EMAIL para ejecutar envío real de email link.'
    );

    const loginPage = new LoginPage(page);
    
    console.log('[TEST] Requesting Firebase email link');

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

    // 6. Request email link. Completing the link requires mailbox access and is covered manually.
    await loginPage.requestEmailLink(process.env.TEST_USER_EMAIL!);
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
