import { test, expect } from '@playwright/test';

const IDP_URL = 'http://localhost:5173';
const MOCK_CLIENT_URL = 'http://localhost:3000';

test.describe('OIDC Functional Tests', () => {

  test('Positive Flow: Login via Mock Client', async ({ page }) => {
    // 1. Visit Mock Client
    await page.goto('/');
    await expect(page).toHaveTitle(/Mock Client/);
    await expect(page.locator('h1')).toContainText('Mock Client App');

    // 2. Click Login -> Redirect to IdP
    await page.click('#login-btn');
    await expect(page).toHaveURL(new RegExp(`^${IDP_URL}`));
    
    // 3. Verify IdP Interface (Service Status Page doesn't have login form on root, but with params it opens modal)
    // Note: The App.tsx logic renders "Service Ready" and opens LoginModal if params are present.
    // We need to verify the modal is visible.
    await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).toBeVisible();

    // 4. Fill Login Form (Mocked Auth)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button:has-text("Iniciar Sesión")');

    // 5. Verify Redirect back to Mock Client with Token
    await expect(page).toHaveURL(new RegExp(`^${MOCK_CLIENT_URL}`));
    await expect(page.locator('#token-section')).toBeVisible();
    const token = await page.textContent('#token-display');
    expect(token).toBeTruthy();
    expect(token?.length).toBeGreaterThan(10);
  });

  test('Negative Scenario: Direct Access to IdP without Params', async ({ page }) => {
    await page.goto(IDP_URL);
    // Should show "Identity Provider Service" and "Direct access restricted"
    await expect(page.getByText('Identity Provider Service')).toBeVisible();
    await expect(page.getByText('Direct access restricted')).toBeVisible();
    // Login modal should NOT be open
    await expect(page.getByRole('heading', { name: 'Iniciar Sesión' })).not.toBeVisible();
  });

  test('Negative Scenario: Invalid Redirect URI', async ({ page }) => {
    // Construct malicious URL
    const maliciousUrl = `${IDP_URL}/?client_id=test&redirect_uri=http://evil.com&response_type=token`;
    
    // Handle dialog (alert)
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('Error de seguridad');
      await dialog.accept();
    });

    await page.goto(maliciousUrl);
    
    // Should NOT redirect to evil.com
    await expect(page).not.toHaveURL(/evil\.com/);
    // Should stay on IdP or blank
    await expect(page.getByText('Identity Provider Service')).toBeVisible();
  });

});
