import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const btn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (btn) await btn.click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'scratch_live.png' });
  console.log('Live flight screenshot saved to scratch_live.png');
  await browser.close();
}

main().catch(console.error);
