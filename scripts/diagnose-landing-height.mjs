import { chromium } from 'playwright';

async function run() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2500);

  const initBtn = await page.$('button:has-text("INITIALIZE")');
  if (initBtn) await initBtn.click({ force: true });
  await page.waitForTimeout(1000);

  const tdBtn = await page.$('button[data-milestone="TOUCHDOWN"]');
  if (tdBtn) await tdBtn.click({ force: true });
  await page.waitForTimeout(2000);

  const debug = await page.evaluate(() => {
    return window.__EDL_LANDER_DEBUG__;
  });

  console.log('EDL Lander Debug Info:');
  console.log(JSON.stringify(debug, null, 2));

  await browser.close();
}

run();
