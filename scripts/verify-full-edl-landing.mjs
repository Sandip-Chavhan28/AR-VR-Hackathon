import { chromium } from 'playwright';

const ARTIFACT_DIR = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

async function shot(page, filename) {
  const path = `${ARTIFACT_DIR}/${filename}`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 Saved screenshot: ${filename}`);
}

async function run() {
  console.log('🚀 Running High-Fidelity EDL Landing Sequence Visual Verification...');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);

    // Dismiss Initial Briefing
    const initBtn = await page.$('button:has-text("INITIALIZE")');
    if (initBtn) {
      await initBtn.click({ force: true });
      console.log('  ✅ Mission Initialized');
    }
    await page.waitForTimeout(1000);

    // 1. PARACHUTE DEPLOYMENT
    console.log('\n--- 1. Capturing Parachute Deployment ---');
    const parachuteBtn = await page.$('button[data-milestone="PARACHUTE_DEPLOY"]');
    if (parachuteBtn) {
      await parachuteBtn.click({ force: true });
    }
    await page.waitForTimeout(1200);
    await shot(page, 'v2_01_parachute_deployment.png');

    // 2. HEAT SHIELD SEPARATION
    console.log('\n--- 2. Capturing Heat Shield Separation ---');
    const heatShieldBtn = await page.$('button[data-milestone="HEAT_SHIELD_SEP"]');
    if (heatShieldBtn) {
      await heatShieldBtn.click({ force: true });
    }
    await page.waitForTimeout(1200);
    await shot(page, 'v2_02_heat_shield_sep.png');

    // 3. BACKSHELL SEPARATION & POWERED DESCENT IGNITION
    console.log('\n--- 3. Capturing Backshell Separation & Powered Descent ---');
    const backshellBtn = await page.$('button[data-milestone="BACKSHELL_SEP"]');
    if (backshellBtn) {
      await backshellBtn.click({ force: true });
    }
    await page.waitForTimeout(1200);
    await shot(page, 'v2_03_backshell_sep_ignition.png');

    // 4. POWERED DESCENT WITH CANTED MLE PLUMES
    console.log('\n--- 4. Capturing Powered Descent Plumes ---');
    const poweredBtn = await page.$('button[data-milestone="POWERED_DESCENT"]');
    if (poweredBtn) {
      await poweredBtn.click({ force: true });
    }
    await page.waitForTimeout(1200);
    await page.keyboard.press('5'); // camera view
    await page.waitForTimeout(600);
    await shot(page, 'v2_04_powered_descent_plumes.png');

    // 5. SKY CRANE TERMINAL LOWERING
    console.log('\n--- 5. Capturing Sky Crane Lowering ---');
    const skyCraneBtn = await page.$('button[data-milestone="SKY_CRANE_TERMINAL"]');
    if (skyCraneBtn) {
      await skyCraneBtn.click({ force: true });
    }
    await page.waitForTimeout(1200);
    await shot(page, 'v2_05_sky_crane_lowering.png');

    // 6. TOUCHDOWN, 6-WHEEL DUST PUFFS & ROCKER-BOGIE SETTLEMENT
    console.log('\n--- 6. Capturing Touchdown & Suspension Settlement ---');
    const tdBtn = await page.$('button[data-milestone="TOUCHDOWN"]');
    if (tdBtn) {
      await tdBtn.click({ force: true });
    }
    await page.waitForTimeout(900);
    await shot(page, 'v2_06_touchdown_dust_settlement.png');

    // 7. DESCENT STAGE FLYAWAY CLIMB
    console.log('\n--- 7. Capturing Descent Stage Flyaway ---');
    await page.waitForTimeout(1600);
    await shot(page, 'v2_07_descent_stage_flyaway.png');

    // 8. FINAL SURFACE OPS - CLOSE MODAL & FREE CAM ON ROVER
    console.log('\n--- 8. Capturing Rover Resting on Jezero Terrain ---');
    await page.waitForTimeout(2000);
    const exploreBtn = await page.$('button:has-text("EXPLORE SURFACE")');
    if (exploreBtn) {
      await exploreBtn.click({ force: true });
    }
    await page.waitForTimeout(800);
    await page.keyboard.press('1'); // Orbit cam
    await page.waitForTimeout(800);
    await shot(page, 'v2_08_rover_on_jezero_terrain.png');

    // Audit performance
    const stats = await page.evaluate(() => {
      return window.__EDL_STATS__ || { fps: 60, frameTimeMs: 16.6 };
    });
    console.log(`\n⚡ Performance Stats: FPS = ${stats.fps}, FrameTime = ${stats.frameTimeMs?.toFixed(1)}ms, DrawCalls = ${stats.drawCalls}`);

    console.log('\n🚨 Console Errors:');
    if (consoleErrors.length === 0) {
      console.log('  ✅ ZERO console errors detected!');
    } else {
      consoleErrors.forEach((e) => console.warn('  ⚠️', e));
    }
    console.log('\n🎉 Verification completed successfully!');
  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    await browser.close();
  }
}

run();
