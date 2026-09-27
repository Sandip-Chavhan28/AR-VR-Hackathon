import { chromium } from 'playwright';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\dell\\.gemini\\antigravity\\brain\\7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

async function run() {
  console.log('Launching browser with WebGL...');
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=default'],
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });

  const page = await context.newPage();

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Dismiss intro modal
  const startBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (startBtn) {
    console.log('Clicking INITIALIZE MISSION SIMULATION...');
    await startBtn.click();
    await page.waitForTimeout(800);
  }

  // Scrub ONCE to Terminal Radar Lock
  console.log('Scrubbing ONCE to Terminal Radar Lock to start the continuous descent test...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent?.includes('Terminal Radar') || el.textContent?.includes('RADAR'));
    if (b) b.click();
  });
  await page.waitForTimeout(1200);

  // Press 'D' to toggle developer diagnostics overlay
  console.log('Enabling Developer Diagnostics Overlay (key D)...');
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(500);

  // Set running with timeScale = 5x so the 2.5-minute physical descent completes in ~30 seconds for test recording
  await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    if (s) {
      s.timeScale = 5.0;
      s.running = true;
    }
  });

  console.log('Starting continuous flight recording without ANY intermediate clicks...');

  let shot1 = false;
  let shot2 = false;
  let shot3 = false;
  let shot4 = false;
  let shot5 = false;
  let shot6 = false;
  let shot7 = false;

  const startTime = Date.now();
  while (Date.now() - startTime < 60000) {
    const s = await page.evaluate(() => {
      const state = window.__SIM_STATE_REF__?.current;
      return {
        phase: state?.phase,
        alt: state?.altitude,
        radarAlt: state?.radarAltitude,
        speed: state?.speed,
        vVert: state?.verticalVelocity,
        radarLocked: state?.radarLocked,
        trnActive: state?.trnActive,
        backshellSep: state?.backshellSeparated,
        enginesActive: state?.enginesActive,
        skyCrane: state?.skyCraneActive,
        grounded: state?.grounded,
      };
    });

    if (!s) {
      await page.waitForTimeout(200);
      continue;
    }

    // Shot 1: Immediately at Radar Lock
    if (!shot1 && s.alt <= 4050) {
      shot1 = true;
      console.log(`[CAPTURE 1] Radar Lock: Alt=${s.alt?.toFixed(0)}m RadarAlt=${s.radarAlt?.toFixed(0)}m Phase=${s.phase}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'continuous_01_radar_lock_start.png') });
    }

    // Shot 2: In-flight descent approaching TRN
    if (!shot2 && s.alt <= 3200) {
      shot2 = true;
      console.log(`[CAPTURE 2] In-Flight Descent: Alt=${s.alt?.toFixed(0)}m RadarAlt=${s.radarAlt?.toFixed(0)}m Phase=${s.phase}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'continuous_02_descending_toward_trn.png') });
    }

    // Shot 3: TRN optical scanning active
    if (!shot3 && s.trnActive && s.alt <= 2450) {
      shot3 = true;
      console.log(`[CAPTURE 3] TRN Active: Alt=${s.alt?.toFixed(0)}m RadarAlt=${s.radarAlt?.toFixed(0)}m Phase=${s.phase}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'continuous_03_trn_optical_scan.png') });
    }

    // Shot 4: Backshell separation free-fall
    if (!shot4 && s.backshellSep && s.alt <= 1800) {
      shot4 = true;
      console.log(`[CAPTURE 4] Backshell Sep: Alt=${s.alt?.toFixed(0)}m RadarAlt=${s.radarAlt?.toFixed(0)}m Phase=${s.phase}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'continuous_04_backshell_freefall.png') });
    }

    // Shot 5: Powered descent retro-propulsion
    if (!shot5 && s.enginesActive && s.alt <= 800) {
      shot5 = true;
      console.log(`[CAPTURE 5] Powered Descent: Alt=${s.alt?.toFixed(0)}m RadarAlt=${s.radarAlt?.toFixed(0)}m Phase=${s.phase}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'continuous_05_powered_descent_retro.png') });
    }

    // Shot 6: Terminal descent / Sky Crane lowering
    if (!shot6 && s.skyCrane && s.alt <= 28) {
      shot6 = true;
      console.log(`[CAPTURE 6] Sky Crane: Alt=${s.alt?.toFixed(1)}m RadarAlt=${s.radarAlt?.toFixed(1)}m Phase=${s.phase}`);
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'continuous_06_sky_crane_hover.png') });
    }

    // Shot 7: Touchdown confirmed
    if (!shot7 && s.grounded) {
      shot7 = true;
      console.log(`[CAPTURE 7] Touchdown: Alt=${s.alt?.toFixed(2)}m RadarAlt=${s.radarAlt?.toFixed(2)}m Phase=${s.phase}`);
      await page.waitForTimeout(1000); // allow dust puff & cable release to render
      await page.screenshot({ path: path.join(ARTIFACT_DIR, 'continuous_07_touchdown_settled.png') });
      break;
    }

    await page.waitForTimeout(100);
  }

  console.log('Continuous descent test run finished successfully.');
  await browser.close();
}

run().catch(err => {
  console.error('Run error:', err);
  process.exit(1);
});
