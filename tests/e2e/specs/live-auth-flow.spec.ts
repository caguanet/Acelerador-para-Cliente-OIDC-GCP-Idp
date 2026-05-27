import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { MockClientPage } from '../pages/MockClientPage';

const runLiveQa = process.env.E2E_LIVE_QA === '1' || process.env.E2E_LIVE_QA === 'true';
const liveOtp = process.env.LIVE_OTP_CODE || '386987';
const livePassword = process.env.LIVE_TEST_PASSWORD || 'SecureQa123!';
const idpUrl = 'http://localhost:5173/?client_id=test-client&redirect_uri=http://localhost:3000&state=live-qa';

type LiveUser = {
  label: string;
  docType: string;
  docNumber: string;
  email?: string;
};

const liveUsers: LiveUser[] = [
  {
    label: 'varios servicios diversificados',
    docType: 'CC',
    docNumber: '2005062026',
    email: 'sqdmpruebasqa@yopmail.com',
  },
  {
    label: 'activo con facturas pendientes',
    docType: 'CC',
    docNumber: '455222222',
    email: 'andres.lopezqa@yopmail.com',
  },
  {
    label: 'activo sin facturas pendientes',
    docType: 'CC',
    docNumber: '1031145',
    email: 'cristian.orteqa@yopmail.com',
  },
  {
    label: 'activo sin falla masiva',
    docType: 'CC',
    docNumber: '1029382923',
    email: 'beupazeunnoipri-4106@yopmail.com',
  },
  {
    label: 'activo con traslado pendiente',
    docType: 'NIT',
    docNumber: '1031031032',
    email: 'huella.qa@yopmail.com',
  },
  {
    label: 'activo con diferentes servicios',
    docType: 'CC',
    docNumber: '1356536',
    email: 'maritza.pardoqa@yopmail.com',
  },
  {
    label: 'producto adicional DGO',
    docType: 'CC',
    docNumber: '4782100',
    email: 'andres.moraqa@yopmail.com',
  },
  {
    label: 'suspendido por mora',
    docType: 'CC',
    docNumber: '3166662865',
    email: 'rillayoveiro-5820@yopmail.com',
  },
];

function decodeJwtPayload(token: string) {
  const [, payload] = token.split('.');
  const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
}

test.describe('Live QA registration against MuleSoft QA', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!runLiveQa, 'Set E2E_LIVE_QA=1 to run live QA registrations.');
  test.setTimeout(180_000);

  for (const user of liveUsers) {
    test(`registers ${user.label} (${user.docType} ${user.docNumber}) and returns document claims`, async ({ page }) => {
      const mockPage = new MockClientPage(page);
      const loginPage = new LoginPage(page);

      await page.goto(idpUrl, { waitUntil: 'domcontentloaded' });
      await expect(page.getByText('Acceso No Autorizado')).not.toBeVisible();
      await expect(
        page.getByRole('heading', { name: /Inicia sesión en tu cuenta|Portal de Acceso/i })
      ).toBeVisible({ timeout: 10000 });

      await loginPage.completeHogaresRegistration({
        displayName: 'Prueba QA',
        email: user.email ?? `qa-${user.docNumber}@yopmail.com`,
        password: livePassword,
        docType: user.docType,
        docNumber: user.docNumber,
        otp: liveOtp,
      });

      await expect(page).toHaveURL(/localhost:3000/, { timeout: 30000 });
      await mockPage.verifyTokenReceived();

      const token = await mockPage.tokenDisplay.textContent();
      expect(token).toBeTruthy();
      const claims = decodeJwtPayload(token!);
      expect(claims.documentType).toBe(user.docType);
      expect(claims.documentNumber).toBe(user.docNumber);
      expect(claims.auth_level).toBe('otp_verified');
    });
  }
});
