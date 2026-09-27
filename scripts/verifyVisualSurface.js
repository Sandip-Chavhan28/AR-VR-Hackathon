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
  await page.waitForTimeout(500);

  // Jump to Touchdown milestone
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Touchdown'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(3200);

  // Dismiss Mission Accomplished modal by clicking EXPLORE SURFACE
  const exploreBtn = await page.$('button:has-text("EXPLORE SURFACE")');
  if (exploreBtn) {
    await exploreBtn.click();
    await page.waitForTimeout(500);
  }

  // Pause the simulation
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);

  // Take screenshot 1: PAUSED in EXPLORE_DRAMATIC
  await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/surface_paused_dramatic.png' });

  // Switch to Key 1 (EXPLORE_FRONT) while PAUSED
  await page.keyboard.press('1');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/surface_paused_front.png' });

  // Switch to Key 3 (EXPLORE_LOW - wheel level) while PAUSED
  await page.keyboard.press('3');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/surface_paused_low.png' });

  // Switch to Key 2 (EXPLORE_HIGH - top down) while PAUSED
  await page.keyboard.press('2');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/surface_paused_high.png' });

  await browser.close();
  console.log('[PASS] Screenshots captured successfully.');
}

main().catch(console.error);
