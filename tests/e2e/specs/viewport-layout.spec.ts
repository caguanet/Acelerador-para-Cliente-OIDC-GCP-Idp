import { test, expect } from '@playwright/test';

/** Misma URL OIDC que en auth-flow (redirect al mock permitido en dev). */
const IDP_OIDC_URL =
  'http://localhost:5173/?client_id=test-client&redirect_uri=http://localhost:3000&state=viewport-check';

const VIEWPORTS = [
  { width: 320, height: 568, label: 'iPhone SE' },
  { width: 375, height: 667, label: 'iPhone 8' },
  { width: 414, height: 896, label: 'iPhone 11' },
  { width: 768, height: 1024, label: 'iPad portrait' },
];

test.describe('Layout responsive (IdP + mock)', () => {
  for (const { width, height, label } of VIEWPORTS) {
    test(`IdP: tarjeta y tiendas visibles en ${width}x${height} (${label})`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height });
      await page.goto(IDP_OIDC_URL);

      await expect(page.getByText('Acceso No Autorizado')).not.toBeVisible();

      await expect(
        page.getByRole('heading', { name: /Inicia sesión en tu cuenta|Portal de Acceso/i })
      ).toBeVisible({ timeout: 20_000 });

      const card = page.locator('.login-page-card').first();
      await expect(card).toBeVisible();
      const box = await card.boundingBox();
      expect(box).toBeTruthy();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(width + 4);
        expect(box.x).toBeGreaterThanOrEqual(-4);
        expect(box.x + box.width).toBeLessThanOrEqual(width + 8);
      }

      const stores = page.locator('.login-mobile-app-stores');
      await expect(stores).toBeVisible();
      await expect(stores.locator('.app-badge')).toHaveCount(3);

      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollW).toBeLessThanOrEqual(clientW + 8);
    });
  }

  test('IdP desktop ≥1024: bloque móvil de tiendas oculto', async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(IDP_OIDC_URL);
    await expect(page.locator('.login-mobile-app-stores')).toBeHidden();
  });

  for (const { width, height, label } of VIEWPORTS) {
    test(`Mock cliente: layout sin overflow en ${width}x${height} (${label})`, async ({ page }) => {
      test.setTimeout(60_000);
      await page.setViewportSize({ width, height });
      await page.goto('/');

      await expect(page.getByRole('button', { name: /Iniciar sesión con el proveedor de identidad/i })).toBeVisible({
        timeout: 20_000,
      });

      const scrollW = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientW = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollW).toBeLessThanOrEqual(clientW + 8);
    });
  }
});
