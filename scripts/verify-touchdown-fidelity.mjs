import { chromium } from 'playwright';

const ARTIFACT_DIR = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

async function shot(page, filename) {
  const path = `${ARTIFACT_DIR}/${filename}`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 Saved screenshot: ${filename}`);
}

async function run() {
  console.log('🚀 Running Touchdown Fidelity & 6-Wheel Terrain Contact Verification...');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    // Dismiss Initial Briefing
    const initBtn = await page.waitForSelector('button:has-text("INITIALIZE")', { timeout: 6000 }).catch(() => null);
    if (initBtn) {
      await initBtn.click({ force: true });
      console.log('  ✅ Mission Initialized');
    }
    await page.waitForTimeout(1000);

    // Open Diagnostics HUD with 'D' key
    await page.keyboard.press('d');
    await page.waitForTimeout(500);

    // Check Milestone: RADAR_LOCK
    console.log('\n--- 1. Testing RADAR_LOCK ---');
    const radarBtn = await page.waitForSelector('button[data-milestone="RADAR_LOCK"]', { timeout: 5000 }).catch(() => null);
    if (radarBtn) await radarBtn.click({ force: true });
    await page.waitForTimeout(1200);
    await shot(page, 'td_01_radar_lock_diag.png');

    // Check Milestone: TRN_HAZARD
    console.log('\n--- 2. Testing TRN_HAZARD ---');
    const trnBtn = await page.$('button[data-milestone="TRN_HAZARD"]');
    if (trnBtn) await trnBtn.click({ force: true });
    await page.waitForTimeout(1200);
    await shot(page, 'td_02_trn_hazard_diag.png');

    // Check Milestone: POWERED_DESCENT
    console.log('\n--- 3. Testing POWERED_DESCENT ---');
    const poweredBtn = await page.$('button[data-milestone="POWERED_DESCENT"]');
    if (poweredBtn) await poweredBtn.click({ force: true });
    await page.waitForTimeout(1200);
    await shot(page, 'td_03_powered_descent_diag.png');

    // Check Milestone: SKY_CRANE_TERMINAL
    console.log('\n--- 4. Testing SKY_CRANE_TERMINAL ---');
    const skyCraneBtn = await page.$('button[data-milestone="SKY_CRANE_TERMINAL"]');
    if (skyCraneBtn) await skyCraneBtn.click({ force: true });
    await page.waitForTimeout(1500);
    await shot(page, 'td_04_sky_crane_diag.png');

    // Check Milestone: TOUCHDOWN & let settling run
    console.log('\n--- 5. Testing TOUCHDOWN & Settling ---');
    const tdBtn = await page.$('button[data-milestone="TOUCHDOWN"]');
    if (tdBtn) await tdBtn.click({ force: true });
    
    // Wait for wheel contact, suspension settling, cable cut, and flyaway
    await page.waitForTimeout(2500);
    await shot(page, 'td_05_settling_touchdown.png');

    // Switch to close-up Chase / Orbit camera on rover
    await page.keyboard.press('1'); // Orbit Camera
    await page.waitForTimeout(1200);
    await shot(page, 'td_06_rover_ground_closeup.png');

    // Dismiss the Result Modal if open, so we can clearly see the rover wheels on the terrain
    const dismissModalBtn = await page.$('button:has-text("EXPLORE SURFACE")');
    if (dismissModalBtn) {
      await dismissModalBtn.click({ force: true });
      console.log('  ✅ Dismissed Mission Result Modal for Clear Surface View');
    }
    await page.waitForTimeout(800);
    await shot(page, 'td_07_rover_wheels_on_mola_regolith.png');

    // Extract live telemetry values from Diagnostics Overlay DOM
    const diagData = await page.evaluate(() => {
      const diagDiv = document.querySelector('div[style*="font-family: monospace"]');
      if (!diagDiv) return null;
      return diagDiv.innerText;
    });

    console.log('\n📊 Live Telemetry Diagnostics:');
    console.log(diagData);

    console.log('\n🚨 Console Errors:');
    if (consoleErrors.length === 0) {
      console.log('  ✅ ZERO console errors detected!');
    } else {
      consoleErrors.forEach((e) => console.warn('  ⚠️', e));
    }

  } catch (err) {
    console.error('❌ Verification failed:', err);
  } finally {
    await browser.close();
  }
}

run();
