import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);

  const initBtn = await page.$('button:has-text("INITIALIZE")');
  if (initBtn) await initBtn.click();
  await page.waitForTimeout(1000);

  const tdBtn = await page.$('button[data-milestone="TOUCHDOWN"]');
  if (tdBtn) await tdBtn.click({ force: true });
  await page.waitForTimeout(2500);

  const exploreBtn = await page.$('button:has-text("EXPLORE SURFACE")');
  if (exploreBtn) await exploreBtn.click({ force: true });
  await page.waitForTimeout(1000);

  // GROUND_TOUCHDOWN mode 6 (hero ground level view)
  await page.keyboard.press('6');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'test_td_ground.png' });
  console.log('Saved test_td_ground.png');

  await browser.close();
}

main().catch(console.error);
