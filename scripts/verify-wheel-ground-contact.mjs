import { chromium } from 'playwright';

const ARTIFACT_DIR = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

async function shot(page, filename) {
  const path = `${ARTIFACT_DIR}/${filename}`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 Saved screenshot: ${filename}`);
}

async function run() {
  console.log('🚀 Running High-Precision Wheel-Ground Contact Visual Audit...');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const initBtn = await page.waitForSelector('button:has-text("INITIALIZE")', { timeout: 6000 }).catch(() => null);
    if (initBtn) {
      await initBtn.click({ force: true });
      console.log('  ✅ Mission Initialized');
    }
    await page.waitForTimeout(1000);

    // Open Diagnostics HUD
    await page.keyboard.press('d');
    await page.waitForTimeout(500);

    // Jump directly to TOUCHDOWN
    console.log('\n--- Clicking TOUCHDOWN milestone ---');
    const tdBtn = await page.waitForSelector('button[data-milestone="TOUCHDOWN"]', { timeout: 5000 });
    if (tdBtn) await tdBtn.click({ force: true });

    // Wait for Mission Result Modal to open after its 2.8s delay
    console.log('Waiting for Mission Result Modal...');
    const dismissBtn = await page.waitForSelector('button:has-text("EXPLORE SURFACE (FREE CAM)")', { timeout: 7000 });
    if (dismissBtn) {
      await dismissBtn.click({ force: true });
      console.log('  ✅ Dismissed Mission Result Modal via EXPLORE SURFACE (FREE CAM)');
    }
    await page.waitForTimeout(1000);

    // Camera 1: GROUND_TOUCHDOWN (Key '6')
    console.log('\n--- 1. GROUND_TOUCHDOWN View ---');
    await page.keyboard.press('6');
    await page.waitForTimeout(1200);
    await shot(page, 'wheel_audit_01_ground_touchdown.png');

    // Camera 2: EXPLORE_LOW (Ground Level wheel shot)
    console.log('\n--- 2. GROUND LEVEL (Wheel-Height) View ---');
    const groundLevelBtn = await page.waitForSelector('button:has-text("GROUND LEVEL")', { timeout: 3000 }).catch(() => null);
    if (groundLevelBtn) {
      await groundLevelBtn.click({ force: true });
    }
    await page.waitForTimeout(1200);
    await shot(page, 'wheel_audit_02_ground_level_wheels.png');

    // Camera 3: FRONT PROFILE View
    console.log('\n--- 3. FRONT PROFILE View ---');
    const frontBtn = await page.waitForSelector('button:has-text("FRONT PROFILE")', { timeout: 3000 }).catch(() => null);
    if (frontBtn) {
      await frontBtn.click({ force: true });
    }
    await page.waitForTimeout(1200);
    await shot(page, 'wheel_audit_03_front_profile.png');

    // Log EDL debug values
    const debug = await page.evaluate(() => window.__EDL_LANDER_DEBUG__);
    console.log('\n🔍 Debug Info:');
    console.log(JSON.stringify(debug, null, 2));

  } catch (err) {
    console.error('❌ Audit failed:', err);
  } finally {
    await browser.close();
  }
}

run();
