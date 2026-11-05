import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { name: 'landing', url: 'http://127.0.0.1:4173', heading: /Pick Your Lucky Card/i },
  { name: 'player', url: 'http://127.0.0.1:4174', heading: /Pick A Lucky Card/i },
  { name: 'admin', url: 'http://127.0.0.1:4175', heading: /Admin login/i },
  { name: 'p2p', url: 'http://127.0.0.1:4176', heading: /P2P desk login/i }
];

for (const pageCase of pages) {
  test(`${pageCase.name} renders without horizontal overflow`, async ({ page }) => {
    await page.goto(pageCase.url);
    await expect(page.getByRole('heading', { name: pageCase.heading })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });

  test(`${pageCase.name} has no serious accessibility violations @a11y`, async ({ page }) => {
    await page.goto(pageCase.url);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations.filter((violation) => ['critical', 'serious'].includes(violation.impact || ''))).toEqual([]);
  });
}

test('player registration provides direct phone and password registration', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174');
  await page.getByRole('button', { name: 'New Player Registration' }).click();
  await expect(page.getByRole('button', { name: 'Register & Play' })).toBeVisible();
  await expect(page.getByText(/Demo OTP is/i)).toHaveCount(0);
});

test('staff login forms do not publish desk phone numbers', async ({ page }) => {
  for (const url of ['http://127.0.0.1:4175', 'http://127.0.0.1:4176']) {
    await page.goto(url);
    await expect(page.getByPlaceholder('Phone')).toHaveValue('');
  }
});

const androidViewports = [
  { width: 320, height: 640 },
  { width: 360, height: 740 },
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 412, height: 915 },
  { width: 432, height: 960 }
];

for (const vp of androidViewports) {
  test(`player app layout at ${vp.width}px Android viewport has zero overflow`, async ({ page }) => {
    await page.setViewportSize(vp);
    await page.goto('http://127.0.0.1:4174');
    await expect(page.getByRole('heading', { name: /Pick A Lucky Card/i })).toBeVisible();
    
    // Check login view
    let dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);

    // Check registration view
    await page.getByRole('button', { name: 'New Player Registration' }).click();
    await expect(page.getByRole('button', { name: 'Register & Play' })).toBeVisible();
    dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);

    // Check forgot password modal
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.getByRole('button', { name: 'Forgot Password?' }).click();
    await expect(page.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      content: document.documentElement.scrollWidth
    }));
    expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport + 1);
  });
}
