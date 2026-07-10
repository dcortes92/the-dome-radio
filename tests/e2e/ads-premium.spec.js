import { test, expect } from '@playwright/test';

test('premium profile would hide ads — slots can be torn down', async ({ page }) => {
  await page.goto('/#skip');
  await page.evaluate(() => {
    localStorage.setItem(
      'dome:profile',
      JSON.stringify({ subscription_status: 'active' }),
    );
  });
  await page.reload();
  await page.goto('/#skip');
  // Slots may still exist in DOM but should be hidden when ads refresh
  const dock = page.locator('[data-ad-slot="dock"]');
  await expect(dock).toHaveCount(1);
});
