import { test, expect } from '@playwright/test';

test.describe('guest play smoke', () => {
  test('loads app and shows explore without forcing auth wall forever with #skip', async ({ page }) => {
    await page.goto('/#skip');
    await expect(page.locator('#app')).toBeVisible();
    // Auth screen should be bypassed with #skip
    const authHidden =
      (await page.locator('#authScr').count()) === 0 ||
      (await page.locator('#authScr').evaluate((el) => getComputedStyle(el).display === 'none' || el.hidden));
    expect(authHidden).toBeTruthy();
    await expect(page.locator('nav [data-view="explore"]')).toBeVisible();
  });
});
