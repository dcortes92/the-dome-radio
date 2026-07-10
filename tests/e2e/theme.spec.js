import { test, expect } from '@playwright/test';

test('theme toggle does not remove audio element', async ({ page }) => {
  await page.goto('/#skip');
  await page.locator('#profBtn').click();
  const toggle = page.locator('#themeToggle');
  if (await toggle.count()) {
    await toggle.click();
  }
  await expect(page.locator('#audio')).toHaveCount(1);
});
