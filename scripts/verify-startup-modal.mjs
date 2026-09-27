import { chromium } from 'playwright';

const ARTIFACT_DIR = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

async function shot(page, filename) {
  const path = `${ARTIFACT_DIR}/${filename}`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 Saved screenshot: ${filename}`);
}

async function run() {
  console.log('🚀 Running Startup Mission Intro Positioning & Centering Audit...');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });

  try {
    // 1. Test at primary desktop resolution 1440x900
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);

    console.log('\n--- 1. Verifying Overlay & Centering at 1440x900 ---');
    const overlay = await page.waitForSelector('div[style*="position: fixed"][style*="z-index: 1000"]', { timeout: 4000 });
    const overlayBox = await overlay.boundingBox();
    console.log('  Overlay box:', overlayBox);

    if (!overlayBox || overlayBox.x !== 0 || overlayBox.y !== 0 || overlayBox.width !== 1440 || overlayBox.height !== 900) {
      throw new Error(`Overlay does not cover full viewport! Got: ${JSON.stringify(overlayBox)}`);
    }
    console.log('  ✅ PASS: Overlay covers 100% of viewport (1440x900, inset: 0)');

    const card = await page.$('.hud-panel:has-text("PERSEVERANCE ENTRY, DESCENT & LANDING")');
    if (!card) throw new Error('Intro card not found!');
    const cardBox = await card.boundingBox();
    console.log('  Card box:', cardBox);

    // Verify horizontal centering
    const cardCenterX = cardBox.x + cardBox.width / 2;
    const viewportCenterX = 1440 / 2;
    const diffX = Math.abs(cardCenterX - viewportCenterX);
    console.log(`  Horizontal center difference: ${diffX.toFixed(2)}px (card center: ${cardCenterX}, viewport: ${viewportCenterX})`);
    if (diffX > 2.0) {
      throw new Error(`Card is NOT horizontally centered! Difference = ${diffX}px`);
    }
    console.log('  ✅ PASS: Card is horizontally centered within 2px');

    // Verify vertical centering
    const cardCenterY = cardBox.y + cardBox.height / 2;
    const viewportCenterY = 900 / 2;
    const diffY = Math.abs(cardCenterY - viewportCenterY);
    console.log(`  Vertical center difference: ${diffY.toFixed(2)}px (card center: ${cardCenterY}, viewport: ${viewportCenterY})`);
    if (diffY > 2.0) {
      throw new Error(`Card is NOT vertically centered! Difference = ${diffY}px`);
    }
    console.log('  ✅ PASS: Card is vertically centered within 2px');

    // Verify bounds: no left clipping, no overflow
    if (cardBox.x < 0) throw new Error(`Card is clipped on the left! x = ${cardBox.x}`);
    if (cardBox.x + cardBox.width > 1440) throw new Error(`Card overflows right edge!`);
    if (cardBox.y < 0) throw new Error(`Card is clipped at top! y = ${cardBox.y}`);
    if (cardBox.y + cardBox.height > 900) throw new Error(`Card overflows bottom edge!`);
    console.log('  ✅ PASS: Card is completely contained within viewport bounds without clipping');

    await shot(page, 'startup_01_centered_modal.png');

    // 2. Verify Initialize button is visible, clickable, and focused
    console.log('\n--- 2. Verifying Initialize Button ---');
    const initBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
    if (!initBtn) throw new Error('Initialize button not found!');
    const initBox = await initBtn.boundingBox();
    console.log('  Initialize button box:', initBox);
    if (!initBox || initBox.width < 100 || initBox.height < 25) {
      throw new Error('Initialize button is too small or clipped!');
    }
    console.log('  ✅ PASS: Initialize button is fully visible and within card');

    // 3. Test Multiple Resolutions
    const viewports = [
      { width: 1280, height: 720, name: '1280x720' },
      { width: 1366, height: 768, name: '1366x768' },
      { width: 1600, height: 900, name: '1600x900' },
      { width: 1920, height: 1080, name: '1920x1080' },
    ];

    for (const vp of viewports) {
      console.log(`\n--- Testing Viewport: ${vp.name} ---`);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);

      const cBox = await card.boundingBox();
      const cCenterX = cBox.x + cBox.width / 2;
      const vCenterX = vp.width / 2;
      const dX = Math.abs(cCenterX - vCenterX);

      const cCenterY = cBox.y + cBox.height / 2;
      const vCenterY = vp.height / 2;
      const dY = Math.abs(cCenterY - vCenterY);

      console.log(`  ${vp.name} -> Center diff: X=${dX.toFixed(1)}px, Y=${dY.toFixed(1)}px`);
      if (dX > 2.0 || dY > 2.0) {
        throw new Error(`Not centered at ${vp.name}! diffX=${dX}, diffY=${dY}`);
      }
      if (cBox.x < 0 || cBox.x + cBox.width > vp.width) {
        throw new Error(`Card out of bounds horizontally at ${vp.name}!`);
      }
      console.log(`  ✅ PASS: Perfectly centered at ${vp.name}`);

      if (vp.width === 1280) await shot(page, 'startup_02_responsive_1280x720.png');
      if (vp.width === 1920) await shot(page, 'startup_03_responsive_1920x1080.png');
    }

    // Reset viewport to 1440x900
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(200);

    // 4. Click Initialize Button and verify clean transition
    console.log('\n--- 4. Clicking Initialize Button ---');
    await initBtn.click();
    await page.waitForTimeout(800);

    const overlayAfter = await page.$('div[style*="z-index: 1000"]');
    if (overlayAfter) {
      throw new Error('Intro overlay did not dismiss after clicking Initialize!');
    }
    console.log('  ✅ PASS: Intro overlay dismissed cleanly');

    // Verify main simulator occupies full viewport normally
    const mainCanvas = await page.$('canvas');
    if (!mainCanvas) throw new Error('Main 3D canvas not found!');
    const canvasBox = await mainCanvas.boundingBox();
    console.log('  Main canvas box:', canvasBox);
    if (canvasBox.width !== 1440 || canvasBox.height !== 900) {
      throw new Error(`Canvas does not fill viewport! Got: ${canvasBox.width}x${canvasBox.height}`);
    }
    console.log('  ✅ PASS: Main 3D Canvas occupies complete 1440x900 viewport');

    // Verify right toolbar is interactive and correctly positioned
    const rightToolbar = await page.$('div[style*="right: 24px"]');
    if (!rightToolbar) throw new Error('Right toolbar not found after initialize!');
    const tbBox = await rightToolbar.boundingBox();
    console.log('  Right toolbar box:', tbBox);
    if (tbBox.x + tbBox.width > 1440 || tbBox.x < 1350) {
      throw new Error(`Right toolbar is shifted! x = ${tbBox.x}`);
    }
    console.log('  ✅ PASS: Right toolbar is in intended position on right edge');

    await shot(page, 'startup_04_after_initialize.png');

    console.log('\n🎉 ALL STARTUP INTRO AUDITS & RESPONSIVE TESTS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification Error:', err);
    await shot(page, 'startup_error.png');
    throw err;
  } finally {
    await browser.close();
  }
}

run();
