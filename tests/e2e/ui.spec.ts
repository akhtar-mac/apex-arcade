import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = [
  { name: 'landing', url: 'http://127.0.0.1:4173', heading: /Pick Your Symbol/i },
  { name: 'player', url: 'http://127.0.0.1:4174', heading: /Pick a card/i },
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

test('player registration requires phone verification', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174');
  await page.getByRole('button', { name: 'New Player Registration' }).click();
  await expect(page.getByRole('button', { name: 'Verify phone to continue' })).toBeVisible();
  await expect(page.getByText(/Demo OTP is/i)).toHaveCount(0);
});

test('staff login forms do not publish desk phone numbers', async ({ page }) => {
  for (const url of ['http://127.0.0.1:4175', 'http://127.0.0.1:4176']) {
    await page.goto(url);
    await expect(page.getByPlaceholder('Phone')).toHaveValue('');
  }
});
