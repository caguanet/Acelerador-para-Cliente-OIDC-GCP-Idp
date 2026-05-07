import { expect, type Locator, type Page } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly nextButton: Locator;
  readonly googleLoginButton: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;
    // Locators based on standard HTML elements or data-testid attributes
    // We assume standard Firebase/Identity Platform UI elements or our custom UI
    this.emailInput = page.locator('input[type="email"]');
    this.passwordInput = page.locator('input[type="password"]');
    this.loginButton = page.getByRole('button', { name: /ingresa|sign in/i });
    this.nextButton = page.getByRole('button', { name: /siguiente|next/i });
    this.googleLoginButton = page.getByRole('button', { name: /google/i });
    this.errorMessage = page.locator('.error-message'); // Adjust selector based on actual implementation
  }

  async goto() {
    await this.page.goto('/');
  }

  async loginWithEmail(email: string, password: string) {
    await this.emailInput.fill(email);
    // Handle split login flows (email -> next -> password) if applicable, 
    // otherwise just fill both. Assuming single form for now based on typical custom UI.
    // If it's pure FirebaseUI, it might be split.
    // Let's assume standard custom form:
    await this.passwordInput.fill(password);
    await this.loginButton.click();
  }

  async loginWithGoogle() {
    await this.googleLoginButton.click();
  }

  async switchToRegister() {
    await expect(this.page.getByTestId('go-register')).toBeVisible({ timeout: 30000 });
    await this.page.getByTestId('go-register').click();
  }

  /**
   * Registro Hogares: IDENTIFY → VERIFY (cualquier OTP de 6 dígitos) → PASSWORD → Firebase.
   */
  async completeHogaresRegistration(params: { displayName: string; email: string; password: string }) {
    await this.switchToRegister();
    const identifyForm = this.page.locator('form:has(#reg-doc-number)');
    await expect(identifyForm).toBeVisible({ timeout: 15000 });
    await this.page.locator('#reg-doc-number').fill('123456789');
    await this.page.locator('#reg-last-name').fill(params.displayName);
    await this.page.locator('#reg-exp-date').fill('2030-06-15');
    await identifyForm.locator('.reg-checkbox-row input[type="checkbox"]').nth(0).check();
    await identifyForm.locator('.reg-checkbox-row input[type="checkbox"]').nth(1).check();
    await this.page.getByRole('checkbox', { name: /Verificación de seguridad/i }).check();
    await this.page.getByRole('button', { name: /^Crear cuenta$/i }).click();
    await expect(this.page.getByRole('heading', { name: /Verifica tu cuenta/i })).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 6; i++) {
      await this.page.locator('.otp-box').nth(i).fill(String((i % 9) + 1));
    }
    await expect(this.page.locator('#reg-final-password')).toBeVisible({ timeout: 12000 });
    await this.page
      .locator('label.reg-checkbox-row')
      .filter({ hasText: /Conservar correo/i })
      .locator('input[type="checkbox"]')
      .uncheck();
    await this.page.locator('#reg-final-email').fill(params.email);
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
