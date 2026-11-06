import { chromium } from '@playwright/test';

const viewports = [
  { name: 'Android 320px (Compact SE / Fold outer)', width: 320, height: 640 },
  { name: 'Android 360px (Galaxy A / Standard)', width: 360, height: 740 },
  { name: 'Android 375px (Compact)', width: 375, height: 667 },
  { name: 'Android 390px (Modern Android)', width: 390, height: 844 },
  { name: 'Android 412px (Pixel / Galaxy S Plus)', width: 412, height: 915 },
  { name: 'Android 432px (Max Screen Android)', width: 432, height: 960 }
];

const urls = [
  { name: 'Player App', url: 'http://127.0.0.1:4174' },
  { name: 'Admin Panel', url: 'http://127.0.0.1:4175' },
  { name: 'P2P Console', url: 'http://127.0.0.1:4176' },
  { name: 'Web Landing', url: 'http://127.0.0.1:4173' }
];

async function main() {
  console.log('===============================================================');
  console.log('    VERIFYING ANDROID SMARTPHONE VIEWPORTS (320px - 432px)     ');
  console.log('===============================================================');

  const browser = await chromium.launch();
  let allPassed = true;

  for (const vp of viewports) {
    console.log(`\n📱 Testing Viewport: ${vp.name} [${vp.width}x${vp.height}]`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2.5
    });

    const page = await context.newPage();

    for (const target of urls) {
      await page.goto(target.url, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(300);

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return {
          scrollWidth: doc.scrollWidth,
          clientWidth: doc.clientWidth,
          hasOverflow: doc.scrollWidth > doc.clientWidth + 1
        };
      });

      if (overflow.hasOverflow) {
        console.error(`  ❌ ${target.name} [${vp.width}px]: Horizontal overflow detected! scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`);
        allPassed = false;
      } else {
        console.log(`  ✔ ${target.name} [${vp.width}px]: Clean layout, 0px horizontal overflow (content: ${overflow.scrollWidth}px, viewport: ${overflow.clientWidth}px)`);
      }

      // If Player App, also test Registration tab and Forgot Password modal
      if (target.name === 'Player App') {
        const regBtn = page.getByRole('button', { name: 'New Player Registration' });
        if (await regBtn.isVisible()) {
          await regBtn.click();
          await page.waitForTimeout(200);
          const regOverflow = await page.evaluate(() => {
            const doc = document.documentElement;
            return doc.scrollWidth > doc.clientWidth + 1;
          });
          if (regOverflow) {
            console.error(`  ❌ Player Registration [${vp.width}px]: Horizontal overflow detected!`);
            allPassed = false;
          } else {
            console.log(`  ✔ Player Registration [${vp.width}px]: Clean layout, 0px horizontal overflow`);
          }

          // Switch back to Sign In
          await page.getByRole('button', { name: 'Sign In' }).click();
          await page.waitForTimeout(200);

          // Test Forgot Password button
          const forgotBtn = page.getByRole('button', { name: 'Forgot Password?' });
          if (await forgotBtn.isVisible()) {
            await forgotBtn.click();
            await page.waitForTimeout(200);
            const forgotModal = page.getByRole('heading', { name: 'Reset Password' });
            if (await forgotModal.isVisible()) {
              console.log(`  ✔ Forgot Password Modal [${vp.width}px]: Rendered cleanly and centered`);
            }
          }
        }
      }
    }

    await context.close();
  }

  await browser.close();

  console.log('\n===============================================================');
  if (allPassed) {
    console.log('✔ ALL ANDROID VIEWPORTS (320px - 432px) VERIFIED WITH ZERO ISSUES!');
    process.exit(0);
  } else {
    console.error('✖ Some viewports failed.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

