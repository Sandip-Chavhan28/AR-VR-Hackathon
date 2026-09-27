import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=default'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1000);

  // Take screenshot of startup modal
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'startup_modal_verified.png') });

  const startBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (startBtn) {
    console.log('Clicking INITIALIZE MISSION SIMULATION...');
    await startBtn.click();
    await page.waitForTimeout(1000);
  }

  // Check initial orbit state
  console.log('Checking Orbit state...');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'orbit_start_verified.png') });

  // Switch to FREE or CHASE camera and zoom in slightly to inspect Perseverance Rover in orbit
  console.log('Switching camera to inspect rover closely in orbit...');
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'orbit_rover_close_verified.png') });

  // Check scene hierarchy visibility
  const visibilityData = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    const dbg = window.__EDL_LANDER_DEBUG__;
    return {
      phase: s?.phase,
      alt: s?.altitude,
      speed: s?.speed,
      landerDbg: dbg,
    };
  });
  console.log('Visibility data:', JSON.stringify(visibilityData, null, 2));

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
