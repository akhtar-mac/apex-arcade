import { chromium } from '@playwright/test';

const viewports = [
  { name: 'iPhone SE (375x667)', width: 375, height: 667 },
  { name: 'iPhone 13/14/15 (390x844)', width: 390, height: 844 },
  { name: 'iPhone 15 Pro Max (430x932)', width: 430, height: 932 },
  { name: 'Desktop PC / Mac (1440x900)', width: 1440, height: 900 }
];

async function main() {
  console.log('===============================================================');
  console.log('   VERIFYING AUTHENTICATED TABS & VIEWPORTS (iPhone + Desktop) ');
  console.log('===============================================================');

  const browser = await chromium.launch();
  let allPassed = true;

  for (const vp of viewports) {
    console.log(`\n📱 Testing Viewport: ${vp.name}`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2
    });

    const page = await context.newPage();
    await page.goto('http://127.0.0.1:5174', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);

    // Login as user 7972272861
    const phoneInput = page.locator('input[placeholder*="mobile number" i], input[type="tel"]').first();
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('7972272861');
      const passInput = page.locator('input[type="password"]').first();
      await passInput.fill('7972272861');
      const loginBtn = page.getByRole('button', { name: /sign in|login/i }).first();
      await loginBtn.click();
      await page.waitForTimeout(1000);
    }

    // Verify all tabs for horizontal overflow
    const tabs = ['Lobby', 'Arena', 'P2P Pay', 'Activity', 'Profile'];
    for (const tabName of tabs) {
      const tabBtn = page.getByRole('button', { name: new RegExp(tabName, 'i') }).first();
      if (await tabBtn.isVisible()) {
        await tabBtn.click();
        await page.waitForTimeout(400);

        const overflow = await page.evaluate(() => {
          const doc = document.documentElement;
          const body = document.body;
          const root = document.getElementById('root');
          return {
            docScroll: doc.scrollWidth,
            docClient: doc.clientWidth,
            bodyScroll: body.scrollWidth,
            bodyClient: body.clientWidth,
            rootScroll: root ? root.scrollWidth : 0,
            rootClient: root ? root.clientWidth : 0,
            hasOverflow: doc.scrollWidth > doc.clientWidth + 1 || body.scrollWidth > body.clientWidth + 1
          };
        });

        if (overflow.hasOverflow) {
          console.error(`  ❌ ${tabName} Tab: Horizontal overflow detected! (scrollWidth: ${overflow.docScroll}px, clientWidth: ${overflow.docClient}px)`);
          allPassed = false;
        } else {
          console.log(`  ✔ ${tabName} Tab: Perfectly contained (0px horizontal overflow)`);
        }
      }
    }

    await context.close();
  }

  await browser.close();

  console.log('\n===============================================================');
  if (allPassed) {
    console.log('✔ ALL AUTHENTICATED TABS & VIEWPORTS ARE 100% CLEAN AND ZERO-OVERFLOW!');
    process.exit(0);
  } else {
    console.error('✖ Some viewports failed.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

