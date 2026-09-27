import { chromium } from 'playwright';
import fs from 'fs';

async function testRoverVisual() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`[BROWSER ${msg.type().toUpperCase()}] ${msg.text()}`);
    }
  });

  console.log('1. Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');

  // Ensure screenshots directory exists
  if (!fs.existsSync('tests/screenshots')) {
    fs.mkdirSync('tests/screenshots', { recursive: true });
  }

  // 2. Handle MissionIntroModal if present
  console.log('2. Checking for MissionIntroModal startup overlay...');
  const introBtn = page.locator('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (await introBtn.isVisible()) {
    console.log('   Clicking INITIALIZE MISSION SIMULATION...');
    await introBtn.click();
    // Wait for the modal overlay to be completely hidden/detached
    await page.locator('text=MARS 2020 EDL FLIGHT SIMULATOR').waitFor({ state: 'hidden', timeout: 10000 });
    console.log('   MissionIntroModal dismissed and verified hidden.');
  }

  // Helper function to inspect any blocker element
  async function inspectBlocker(locator, elementName = 'Target Element') {
    const box = await locator.boundingBox();
    if (!box) {
      console.log(`[DIAGNOSTICS] ${elementName} has no bounding box (not rendered or hidden)`);
      return null;
    }
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;

    const blockerInfo = await page.evaluate(({ cx, cy }) => {
      const el = document.elementFromPoint(cx, cy);
      if (!el) return { found: false };
      const style = window.getComputedStyle(el);
      return {
        found: true,
        tagName: el.tagName,
        id: el.id || '(no id)',
        className: el.className || '(no class)',
        pointerEvents: style.pointerEvents,
        visibility: style.visibility,
        display: style.display,
        zIndex: style.zIndex,
        textContent: (el.textContent || '').trim().slice(0, 60),
        outerHTML: el.outerHTML.slice(0, 150),
      };
    }, { cx: centerX, cy: centerY });

    console.log(`[DIAGNOSTICS] Inspecting point (${centerX.toFixed(1)}, ${centerY.toFixed(1)}) for ${elementName}:`);
    console.log(`  - Target BoundingBox: x=${box.x.toFixed(1)}, y=${box.y.toFixed(1)}, w=${box.width.toFixed(1)}, h=${box.height.toFixed(1)}`);
    console.log(`  - Element at Point: <${blockerInfo.tagName}> id="${blockerInfo.id}" class="${blockerInfo.className}"`);
    console.log(`  - pointer-events: ${blockerInfo.pointerEvents}`);
    console.log(`  - visibility: ${blockerInfo.visibility}, display: ${blockerInfo.display}, z-index: ${blockerInfo.zIndex}`);
    console.log(`  - Text / HTML: "${blockerInfo.textContent}"`);
    return blockerInfo;
  }

  // 3. Test Sky Crane Terminal
  console.log('\n3. Testing Sky Crane Terminal...');
  const skyCraneBtn = page.locator('button:has-text("Sky Crane"), .milestone-btn:has-text("Sky Crane")').first();
  await skyCraneBtn.waitFor({ state: 'visible', timeout: 5000 });
  await inspectBlocker(skyCraneBtn, 'Sky Crane Button');
  await skyCraneBtn.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'tests/screenshots/01_sky_crane_1x.png' });
  console.log('   Saved screenshot: tests/screenshots/01_sky_crane_1x.png');

  // 4. Test Touchdown
  console.log('\n4. Testing Touchdown Milestone...');
  const tdBtn = page.locator('button:has-text("Touchdown"), .milestone-btn:has-text("Touchdown")').first();
  await tdBtn.waitFor({ state: 'visible', timeout: 5000 });
  await inspectBlocker(tdBtn, 'Touchdown Button');
  await tdBtn.click();
  await page.waitForTimeout(1000);

  // Take screenshot of touchdown before closing modal (showing evaluation report)
  await page.screenshot({ path: 'tests/screenshots/02_touchdown_with_modal.png' });
  console.log('   Saved screenshot: tests/screenshots/02_touchdown_with_modal.png');

  // 5. Inspect and Dismiss MissionResultModal before clicking speed controls
  console.log('\n5. Inspecting MissionResultModal blocking behavior...');
  const speedBtn05 = page.locator('button:has-text("0.5×")').first();
  console.log('   Running pre-click blocker inspection on 0.5× button...');
  const blocker = await inspectBlocker(speedBtn05, '0.5x Speed Button');

  // Check if MissionResultModal is the blocker
  const exploreBtn = page.locator('button:has-text("EXPLORE SURFACE (FREE CAM)")');
  if (await exploreBtn.isVisible()) {
    console.log('   MissionResultModal detected! Dismissing via "EXPLORE SURFACE (FREE CAM)"...');
    await exploreBtn.click();
    await exploreBtn.waitFor({ state: 'hidden', timeout: 5000 });
    console.log('   MissionResultModal successfully dismissed and hidden.');
  } else {
    const closeBtn = page.locator('button:has-text("✕")');
    if (await closeBtn.isVisible()) {
      await closeBtn.click();
      await closeBtn.waitFor({ state: 'hidden', timeout: 5000 });
    }
  }

  // Re-inspect 0.5x button now that modal is dismissed
  console.log('   Post-dismissal blocker inspection on 0.5× button:');
  await inspectBlocker(speedBtn05, '0.5x Speed Button (After Modal Dismissal)');

  // 6. Test playback speed changes across 0.5x, 1x, 5x, 10x, 50x
  console.log('\n6. Testing Playback Speeds on Surface Rover...');
  const speeds = ['0.5', '1', '5', '10', '50'];

  for (const speed of speeds) {
    console.log(`\nTesting Speed ${speed}×...`);
    const sBtn = page.locator(`button:has-text("${speed}×")`).first();
    await sBtn.waitFor({ state: 'visible', timeout: 5000 });
    await sBtn.click();
    await page.waitForTimeout(800);

    // Collect 3D scene transform data
    const transformData = await page.evaluate(() => {
      const scene = window.__THREE_SCENE__;
      const camera = window.__THREE_CAMERA__;
      const sim = window.__SIM_STATE_REF__?.current;

      // Find lander / rover in scene
      let roverPos = null;
      let roverRot = null;
      let roverWorldPos = null;
      scene?.traverse((obj) => {
        if (obj.isMesh && obj.geometry?.type === 'CylinderGeometry' && obj.geometry?.parameters?.radiusTop === 0.26) {
          // This is a rover wheel tire rim
          roverPos = [obj.parent?.position.x, obj.parent?.position.y, obj.parent?.position.z];
          const wp = obj.getWorldPosition(new (window.THREE || obj.position.constructor)());
          roverWorldPos = [wp.x, wp.y, wp.z];
        }
      });

      return {
        speed: sim?.timeScale,
        simAlt: sim?.altitude,
        simPhase: sim?.phase,
        camPos: camera ? [camera.position.x, camera.position.y, camera.position.z] : null,
        roverWorldPos,
      };
    });

    console.log(`   Speed ${speed}× info:`, JSON.stringify(transformData));
    const filename = `03_surface_speed_${speed}x.png`;
    await page.screenshot({ path: `tests/screenshots/${filename}` });
    console.log(`   Saved screenshot: tests/screenshots/${filename}`);
  }

  // 7. Test rapid speed cycling: 0.5 -> 1 -> 5 -> 10 -> 50 -> 10 -> 1 -> 0.5
  console.log('\n7. Testing Rapid Speed Cycling: 0.5 -> 1 -> 5 -> 10 -> 50 -> 10 -> 1 -> 0.5...');
  const cycle = ['0.5', '1', '5', '10', '50', '10', '1', '0.5'];
  for (const sp of cycle) {
    const sBtn = page.locator(`button:has-text("${sp}×")`).first();
    await sBtn.click();
    await page.waitForTimeout(200);
  }
  await page.screenshot({ path: 'tests/screenshots/04_after_rapid_cycling.png' });
  console.log('   Saved screenshot: tests/screenshots/04_after_rapid_cycling.png');

  console.log('\n✅ Automated test completed successfully.');
  await browser.close();
}

testRoverVisual().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
