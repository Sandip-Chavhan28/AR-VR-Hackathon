import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);

  const initBtn = await page.$('button:has-text("INITIALIZE")');
  if (initBtn) await initBtn.click();
  await page.waitForTimeout(1000);

  // Click milestone by data-milestone
  const tdBtn = await page.$('button[data-milestone="TOUCHDOWN"]');
  if (tdBtn) {
    console.log('Found TOUCHDOWN milestone button! Clicking...');
    await tdBtn.click({ force: true });
  } else {
    console.log('Could not find button[data-milestone="TOUCHDOWN"]');
  }
  await page.waitForTimeout(2500);

  // Dismiss modal if present
  const exploreBtn = await page.$('button:has-text("EXPLORE SURFACE")');
  if (exploreBtn) {
    console.log('Dismissing result modal...');
    await exploreBtn.click({ force: true });
    await page.waitForTimeout(1000);
  }

  // Switch to FREE camera (key 8) or GROUND_TOUCHDOWN (key 6)
  await page.keyboard.press('8');
  await page.waitForTimeout(1000);

  await page.screenshot({ path: 'test_td_debug.png' });
  console.log('Saved test_td_debug.png');
  await browser.close();
}

main().catch(console.error);
