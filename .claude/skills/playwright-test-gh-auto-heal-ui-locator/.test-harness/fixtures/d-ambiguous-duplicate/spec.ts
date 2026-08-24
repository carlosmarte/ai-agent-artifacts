import { test, expect } from '@playwright/test';

test('adds the first product to the cart', async ({ page }) => {
  await page.goto('/products');
  await page.locator('.add').click();
  await expect(page.getByText('1 item in cart')).toBeVisible();
});
