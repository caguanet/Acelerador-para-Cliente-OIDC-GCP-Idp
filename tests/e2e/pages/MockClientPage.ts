import { expect, type Locator, type Page } from '@playwright/test';

export class MockClientPage {
  readonly page: Page;
  readonly loginButton: Locator;
  readonly tokenDisplay: Locator;
  readonly userDisplay: Locator;

  constructor(page: Page) {
    this.page = page;
    this.loginButton = page.getByRole('button', { name: /Login with Identity Provider/i });
    // Updated locators to match the actual MockThirdPartyApp component
    this.tokenDisplay = page.locator('#token-display'); // Using ID as defined in HTML
    this.userDisplay = page.getByText(/Authenticated/i);
  }

  async goto() {
    await this.page.goto('/');
  }

  async startLoginFlow() {
    await this.loginButton.click();
  }

  async verifyTokenReceived() {
    await expect(this.tokenDisplay).toBeVisible({ timeout: 15000 }); // Give time for redirect and processing
    const tokenText = await this.tokenDisplay.textContent();
    expect(tokenText).toBeTruthy();
    expect(tokenText?.length).toBeGreaterThan(20); // Basic check that it's not empty/short
  }
}
