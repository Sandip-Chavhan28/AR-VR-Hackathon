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

  // Jump to TOUCHDOWN milestone
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Touchdown'));
    if (btn) btn.click();
  });
  // Wait 3.5s for evaluation modal to appear
  await page.waitForTimeout(3500);
  const exploreBtn = await page.$('button:has-text("EXPLORE SURFACE")');
  if (exploreBtn) {
    await exploreBtn.click();
    await page.waitForTimeout(1000);
  }

  // Switch to Key 1 (EXPLORE_FRONT)
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/check_surface_front.png' });

  // Switch to Key 3 (EXPLORE_LOW)
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/check_surface_low.png' });

  await browser.close();
}

main().catch(console.error);
