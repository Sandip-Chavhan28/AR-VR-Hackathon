import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=default'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);
  const startBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (startBtn) await startBtn.click();
  await page.waitForTimeout(1000);

  // Press 7 to switch to ORBIT_OVERVIEW
  await page.keyboard.press('Digit7');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/test_orbit_overview.png' });
  await browser.close();
}

main().catch(console.error);
