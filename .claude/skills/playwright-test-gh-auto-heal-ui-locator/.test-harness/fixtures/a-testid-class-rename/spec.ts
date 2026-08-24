import { test, expect } from '@playwright/test';

test('places an order', async ({ page }) => {
  await page.goto('/checkout');
  await page.locator('.btn-primary').click();
  await expect(page.getByText('Order confirmed')).toBeVisible();
});
