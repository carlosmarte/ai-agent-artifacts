import { test, expect } from '@playwright/test';

test('opens the cart', async ({ page }) => {
  await page.goto('/');
  await page.locator('.nav-cart').click();
  await expect(page).toHaveURL(/\/cart/);
});
