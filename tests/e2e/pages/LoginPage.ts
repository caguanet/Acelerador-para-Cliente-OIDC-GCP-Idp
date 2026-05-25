import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly sendEmailLinkButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.locator('input[type="email"]');
    this.sendEmailLinkButton = page.getByRole('button', { name: /enviar enlace de acceso/i });
    this.errorMessage = page.locator('.error-message'); // Adjust selector based on actual implementation
  }

  async goto() {
    await this.page.goto('/');
  }

  async requestEmailLink(email: string) {
    await this.emailInput.fill(email);
    await this.sendEmailLinkButton.click();
    await expect(this.page.getByText(/Te enviamos un enlace seguro/i)).toBeVisible({ timeout: 12000 });
  }

  async switchToRegister() {
    await expect(this.page.getByTestId('go-register')).toBeVisible({ timeout: 30000 });
    await this.page.getByTestId('go-register').click();
  }

  /**
   * Registro Hogares: IDENTIFY → VERIFY → PASSWORD → BFF.
   */
  async completeHogaresRegistration(params: { displayName: string; email: string; password: string }) {
    await this.switchToRegister();
    const identifyForm = this.page.locator('form:has(#reg-doc-number)');
    await expect(identifyForm).toBeVisible({ timeout: 15000 });
    await this.page.locator('#reg-doc-number').fill('123456789');
    await identifyForm.locator('.reg-checkbox-row input[type="checkbox"]').nth(0).check();
    await identifyForm.locator('.reg-checkbox-row input[type="checkbox"]').nth(1).check();
    await this.page.getByRole('checkbox', { name: /Verificación de seguridad/i }).check();
    await this.page.getByRole('button', { name: /^Crear cuenta$/i }).click();
    await expect(this.page.getByRole('heading', { name: /Verifica tu cuenta/i })).toBeVisible({ timeout: 15000 });
    const otp = '123456';
    for (let i = 0; i < 6; i++) {
      await this.page.locator('.otp-box').nth(i).fill(otp[i]);
    }
    await expect(this.page.locator('#reg-final-password')).toBeVisible({ timeout: 12000 });
    await expect(this.page.locator('#reg-final-doc-number')).toHaveValue('123456789');
    await this.page.locator('#reg-final-phone').fill('3001234567');
    await this.page.locator('#reg-final-password').fill(params.password);
    await this.page.getByRole('button', { name: /Completar registro/i }).click();
  }

  /** Alias retrocompatible con el flujo multi-paso actual */
  async registerWithEmail(name: string, email: string, password: string) {
    await this.completeHogaresRegistration({ displayName: name, email, password });
  }

  async verifyErrorMessage(text: string) {
    await expect(this.errorMessage).toContainText(text);
  }
}
