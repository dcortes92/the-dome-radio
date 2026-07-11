import { test, expect } from '@playwright/test';

test('ad slots exist for free tier markup', async ({ page }) => {
  await page.goto('/#skip');
  await expect(page.locator('[data-ad-slot="dock"]')).toHaveCount(1);
  await expect(page.locator('[data-ad-slot="explore-inline"]')).toHaveCount(1);
});
