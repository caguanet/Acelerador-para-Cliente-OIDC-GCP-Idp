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
    await this.page.getByRole('button', { name: /regístrate/i }).click();
  }

  async registerWithEmail(name: string, email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    // Fill Name if present (it should be in Register mode)
    const nameInput = this.page.locator('input[placeholder="Nombre completo"]');
    if (await nameInput.isVisible()) {
        await nameInput.fill(name);
    }
    // Click Register (same button selector usually, but text changes. The locator uses regex /ingresar|sign in/i. 
    // Wait, BrandLoginForm changes text to "Registrarse". 
    // We need to update the loginButton locator or click the generic submit button.
    await this.page.getByRole('button', { name: /registrarse/i }).click();
  }

  async verifyErrorMessage(text: string) {
    await expect(this.errorMessage).toContainText(text);
  }
}
