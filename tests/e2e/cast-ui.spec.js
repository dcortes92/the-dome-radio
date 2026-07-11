import { test, expect } from '@playwright/test';

test('cast control does not break local UI when unavailable', async ({ page }) => {
  await page.goto('/#skip');
  const cast = page.locator('#castBtn');
  if (await cast.count()) {
    await cast.click({ force: true }).catch(() => {});
  }
  await expect(page.locator('#playBtn')).toBeVisible();
});
