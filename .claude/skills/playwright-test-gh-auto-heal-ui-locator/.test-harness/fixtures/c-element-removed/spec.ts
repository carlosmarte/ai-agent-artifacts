import { test, expect } from '@playwright/test';

test('dismisses the promo banner', async ({ page }) => {
  await page.goto('/');
  await page.locator('#promo-banner').click();
  await expect(page.locator('#promo-banner')).toBeHidden();
});
