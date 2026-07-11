import { test, expect } from '@playwright/test';

test('auth form is present for registration', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#auForm')).toBeVisible();
  await expect(page.locator('#auGuest')).toBeVisible();
});
