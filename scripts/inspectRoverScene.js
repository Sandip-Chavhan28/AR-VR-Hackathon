import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=default'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1000);

  const startBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(1000);
  }

  // Click Touchdown milestone button
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent?.includes('Touchdown Confirmed'));
    if (b) b.click();
  });
  await page.waitForTimeout(3000);

  // Click "EXPLORE SURFACE (FREE CAM)" if present
  const exploreBtn = await page.$('button:has-text("EXPLORE SURFACE")');
  if (exploreBtn) {
    console.log('Clicking EXPLORE SURFACE...');
    await exploreBtn.click();
    await page.waitForTimeout(1500);
  }

  const debugData = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    const lander = window.__EDL_LANDER_DEBUG__;
    
    // Find camera in Three.js
    const canvas = document.querySelector('canvas');
    let camInfo = null;
    let mainGroupInfo = null;
    let roverModelInfo = null;
    let surfaceInfo = null;

    if (canvas && window.__THREE_DEVTOOLS__) {
      // devtools if any
    }

    return {
      simState: {
        phase: s?.phase,
        grounded: s?.grounded,
        touchdownState: s?.touchdownState,
        alt: s?.altitude,
        radarAlt: s?.radarAltitude,
      },
      lander,
    };
  });

  console.log('DEBUG DATA:\n', JSON.stringify(debugData, null, 2));

  await page.screenshot({ path: 'scripts/inspect_explore_surface.png' });

  // Now test each camera mode via keyboard:
  // Key 1: EXPLORE_FRONT
  await page.keyboard.press('Digit1');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scripts/inspect_explore_key1_front.png' });

  // Key 3: EXPLORE_LOW
  await page.keyboard.press('Digit3');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scripts/inspect_explore_key3_low.png' });

  // Key F: FREE camera
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'scripts/inspect_explore_keyF_free.png' });

  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
