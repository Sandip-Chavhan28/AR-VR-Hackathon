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
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('[SANITY CHECK]') || text.includes('ERROR') || text.includes('WARN')) {
      console.log('[PAGE]', text);
    }
  });

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

  // Helper to click milestone button
  async function jumpTo(id) {
    await page.evaluate((mId) => {
      const btns = Array.from(document.querySelectorAll('button'));
      const target = btns.find(el => el.getAttribute('data-milestone-id') === mId || el.textContent?.toUpperCase().includes(mId.replace('_', ' ')));
      if (target) {
        target.click();
      } else {
        // Fallback: jump via window
        const s = window.__SIM_STATE_REF__?.current;
        if (s && window.__JUMP_TO_MILESTONE__) {
          window.__JUMP_TO_MILESTONE__(s, mId);
        }
      }
    }, id);
    await page.waitForTimeout(1200);
  }

  // 1. RADAR_LOCK
  console.log('Stage 1: RADAR_LOCK...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent?.includes('Terminal Radar') || el.textContent?.includes('RADAR'));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  let state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    return {
      phase: s?.phase,
      altitude: s?.altitude?.toFixed(0),
      radarAltitude: s?.radarAltitude?.toFixed(0),
      speed: s?.speed?.toFixed(1),
      radarLocked: s?.radarLocked,
    };
  });
  console.log('RADAR_LOCK state:', state);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'descent_01_radar_lock.png') });

  // 2. TRN_HAZARD
  console.log('Stage 2: TRN_HAZARD...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent?.includes('Terrain-Relative') || el.textContent?.includes('TRN'));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    return {
      phase: s?.phase,
      altitude: s?.altitude?.toFixed(0),
      radarAltitude: s?.radarAltitude?.toFixed(0),
      trnActive: s?.trnActive,
    };
  });
  console.log('TRN_HAZARD state:', state);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'descent_02_trn_hazard.png') });

  // 3. BACKSHELL_SEP
  console.log('Stage 3: BACKSHELL_SEP...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent?.includes('Backshell Separation') || el.textContent?.includes('BACKSHELL'));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    return {
      phase: s?.phase,
      altitude: s?.altitude?.toFixed(0),
      backshellSeparated: s?.backshellSeparated,
      enginesActive: s?.enginesActive,
    };
  });
  console.log('BACKSHELL_SEP state:', state);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'descent_03_backshell_sep.png') });

  // 4. POWERED_DESCENT
  console.log('Stage 4: POWERED_DESCENT...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent?.includes('Powered Descent') || el.textContent?.includes('POWERED'));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    return {
      phase: s?.phase,
      altitude: s?.altitude?.toFixed(0),
      enginesActive: s?.enginesActive,
      poweredDescentActive: s?.poweredDescentActive,
    };
  });
  console.log('POWERED_DESCENT state:', state);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'descent_04_powered_descent.png') });

  // 5. SKY_CRANE_TERMINAL
  console.log('Stage 5: SKY CRANE...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent?.includes('Sky Crane') || el.textContent?.includes('CRANE'));
    if (b) b.click();
  });
  await page.waitForTimeout(1500);
  state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    return {
      phase: s?.phase,
      altitude: s?.altitude?.toFixed(1),
      skyCraneActive: s?.skyCraneActive,
      loweringProgress: s?.skyCraneLoweringProgress?.toFixed(2),
    };
  });
  console.log('SKY CRANE state:', state);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'descent_05_sky_crane.png') });

  // 6. TOUCHDOWN
  console.log('Stage 6: TOUCHDOWN...');
  await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    if (s) {
      s.timeScale = 1.0;
      s.running = true;
    }
  });

  let waited = 0;
  while (waited < 16000) {
    const isGrounded = await page.evaluate(() => window.__SIM_STATE_REF__?.current?.grounded);
    if (isGrounded) {
      console.log(`Touchdown confirmed after ${waited}ms!`);
      break;
    }
    await page.waitForTimeout(500);
    waited += 500;
  }
  await page.waitForTimeout(1500);
  state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    return {
      phase: s?.phase,
      altitude: s?.altitude?.toFixed(2),
      grounded: s?.grounded,
      landingError: s?.landingError?.toFixed(1),
    };
  });
  console.log('TOUCHDOWN state:', state);
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'descent_06_touchdown.png') });

  console.log('All descent verification screenshots saved successfully.');
  await browser.close();
}

run().catch(err => {
  console.error('Run error:', err);
  process.exit(1);
});
