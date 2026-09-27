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

  // Wait for canvas to mount
  await page.waitForSelector('canvas', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // Dismiss intro modal if open
  const startBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (startBtn) {
    console.log('Clicking INITIALIZE MISSION SIMULATION...');
    await startBtn.click();
    await page.waitForTimeout(800);
  }

  // 1. Verify Entry / Cruise Phase
  console.log('Checking ORBIT / CRUISE phase...');
  let state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    return {
      phase: s?.phase,
      altitude: s?.altitude,
      speed: s?.speed,
      parachuteState: s?.parachuteState,
      backshellSeparated: s?.backshellSeparated,
      heatShieldSeparated: s?.heatShieldSeparated,
      grounded: s?.grounded
    };
  });
  console.log('Orbit state:', state);

  // Take screenshot 1: Orbit / Cruise
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_01_orbit.png') });

  // 2. Jump to PARACHUTE_DEPLOY
  console.log('Jumping to PARACHUTE_DEPLOY...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(el => el.textContent?.toUpperCase().includes('PARACHUTE'));
    if (target) target.click();
  });
  await page.waitForTimeout(1200);

  // Take screenshot 2: Parachute Descent
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_02_parachute.png') });

  // 3. Jump to POWERED_DESCENT
  console.log('Jumping to POWERED_DESCENT...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(el => el.textContent?.toUpperCase().includes('POWERED'));
    if (target) target.click();
  });
  await page.waitForTimeout(1500);

  // Check state at Powered Descent
  state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    // Extract HUD countdown / ETA text
    const hudEls = Array.from(document.querySelectorAll('*'));
    const etaEl = hudEls.find(el => el.textContent?.includes('TOUCHDOWN ETA:') || el.textContent?.includes('TOUCHDOWN IN:'));
    return {
      phase: s?.phase,
      altitude: s?.altitude,
      speed: s?.speed,
      parachuteState: s?.parachuteState,
      backshellSeparated: s?.backshellSeparated,
      heatShieldSeparated: s?.heatShieldSeparated,
      grounded: s?.grounded,
      hudEtaText: etaEl ? etaEl.textContent.trim() : 'NOT_FOUND'
    };
  });
  console.log('Powered Descent state:', state);

  // Take screenshot 3: Powered Descent (verify NO parachute attached, NO giant disk)
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_03_powered_descent.png') });

  // 4. Jump to SKY_CRANE_TERMINAL
  console.log('Jumping to SKY CRANE...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const target = btns.find(el => el.textContent?.toUpperCase().includes('SKY CRANE') || el.textContent?.toUpperCase().includes('CRANE'));
    if (target) target.click();
  });
  await page.waitForTimeout(1500);

  state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    const hudEls = Array.from(document.querySelectorAll('*'));
    const etaEl = hudEls.find(el => el.textContent?.includes('TOUCHDOWN ETA:') || el.textContent?.includes('TOUCHDOWN IN:'));
    return {
      phase: s?.phase,
      altitude: s?.altitude,
      speed: s?.speed,
      skyCraneActive: s?.skyCraneActive,
      grounded: s?.grounded,
      hudEtaText: etaEl ? etaEl.textContent.trim() : 'NOT_FOUND'
    };
  });
  console.log('Sky Crane state:', state);

  // Take screenshot 4: Sky Crane Lowering
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_04_sky_crane.png') });

  // 5. Allow simulation to touch down naturally at 1x speed
  console.log('Setting simulation to 1x speed and waiting for physical touchdown...');
  await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    if (s) {
      s.timeScale = 1.0;
      s.running = true;
    }
  });

  // Wait until grounded is true
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

  await page.waitForTimeout(2000);

  state = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    const hudEls = Array.from(document.querySelectorAll('*'));
    const etaEl = hudEls.find(el => el.textContent?.includes('TOUCHDOWN ETA:') || el.textContent?.includes('TOUCHDOWN IN:'));
    return {
      phase: s?.phase,
      altitude: s?.altitude,
      verticalVelocity: s?.verticalVelocity,
      grounded: s?.grounded,
      peakGForce: s?.peakGForce,
      fuel: s?.fuel,
      hudEtaText: etaEl ? etaEl.textContent.trim() : 'NOT_FOUND'
    };
  });
  console.log('Touchdown state:', state);

  // Take screenshot 5: Touchdown on Jezero regolith
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'verify_05_touchdown.png') });

  console.log('All verification stages captured successfully.');
  await browser.close();
}

run().catch(err => {
  console.error('Test run error:', err);
  process.exit(1);
});
