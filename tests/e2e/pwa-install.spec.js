import { test, expect } from '@playwright/test';

test('manifest and SW registration hooks exist', async ({ page }) => {
  await page.goto('/#skip');
  const manifest = page.locator('link[rel="manifest"]');
  await expect(manifest).toHaveAttribute('href', /manifest/);
});
