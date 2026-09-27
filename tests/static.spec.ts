import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('header, method note and Index render', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('h1')).toHaveText('The week AI took the floor');
    await expect(page.locator('#idx-items tbody tr')).toHaveCount(133);
    await expect(page.locator('#idx-statements tbody tr')).toHaveCount(143);
    await expect(page.locator('#about')).toContainText('An item is an event, a session within a larger programme');
    await expect(page.locator('#about')).toContainText('Personal analysis, not an official UN publication.');
  });
});

test('no horizontal scroll and axe clean on first load', async ({ page }) => {
  await page.goto('./');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});
