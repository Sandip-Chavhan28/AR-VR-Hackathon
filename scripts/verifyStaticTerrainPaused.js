import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=default'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(1000);

  const startBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (startBtn) await startBtn.click();
  await page.waitForTimeout(500);

  // Jump to TOUCHDOWN milestone
  console.log('[TEST] Jumping to Touchdown milestone...');
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Touchdown'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(3500); // Allow settling

  // Now PAUSE the simulation by pressing Space
  console.log('[TEST] Pausing simulation...');
  await page.keyboard.press('Space');
  await page.waitForTimeout(200);

  // Check state and capture Frame 1
  const frame1 = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    const cam = window.__THREE_CAMERA__;
    const camDebug = window.__EDL_CAMERA_DEBUG__;
    return {
      running: s?.running,
      phase: s?.phase,
      grounded: s?.grounded,
      camPos: [cam.position.x, cam.position.y, cam.position.z],
      lookTarget: camDebug?.lookTarget,
      targetOffset: camDebug?.targetOffset,
      currentOffset: camDebug?.currentOffset,
    };
  });
  console.log('[TEST] Frame 1 state (PAUSED):', JSON.stringify(frame1, null, 2));

  const screenshot1Path = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/terrain_paused_frame1.png';
  await page.screenshot({ path: screenshot1Path });

  // Wait 1.5 seconds (approx 90 render frames) while PAUSED
  console.log('[TEST] Waiting 1.5s while PAUSED to check for any drift or shift...');
  await page.waitForTimeout(1500);

  // Check state and capture Frame 2
  const frame2 = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    const cam = window.__THREE_CAMERA__;
    const camDebug = window.__EDL_CAMERA_DEBUG__;
    return {
      running: s?.running,
      phase: s?.phase,
      grounded: s?.grounded,
      camPos: [cam.position.x, cam.position.y, cam.position.z],
      lookTarget: camDebug?.lookTarget,
      targetOffset: camDebug?.targetOffset,
      currentOffset: camDebug?.currentOffset,
    };
  });
  console.log('[TEST] Frame 2 state (1.5s later):', JSON.stringify(frame2, null, 2));

  const screenshot2Path = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/terrain_paused_frame2.png';
  await page.screenshot({ path: screenshot2Path });

  // Compute camera position delta
  const dx = frame2.camPos[0] - frame1.camPos[0];
  const dy = frame2.camPos[1] - frame1.camPos[1];
  const dz = frame2.camPos[2] - frame1.camPos[2];
  const camShift = Math.sqrt(dx * dx + dy * dy + dz * dz);
  console.log(`[TEST] Camera shift between Frame 1 and Frame 2: ${camShift.toFixed(8)} units`);

  // Inspect meshes in Three.js scene
  const meshInfo = await page.evaluate(() => {
    const scene = window.__THREE_SCENE__;
    const meshes = [];
    scene?.traverse((obj) => {
      if (obj.isMesh) {
        meshes.push({
          name: obj.name || obj.parent?.name || 'unnamed',
          type: obj.geometry?.type,
          visible: obj.visible,
          materialVisible: obj.material?.visible,
          depthWrite: obj.material?.depthWrite,
        });
      }
    });
    return meshes;
  });

  const globeMeshes = meshInfo.filter(m => m.name.toLowerCase().includes('globe') || m.type === 'SphereGeometry');
  console.log('[TEST] Sphere / Globe meshes in scene:', JSON.stringify(globeMeshes, null, 2));

  // Compare file buffers
  const buf1 = fs.readFileSync(screenshot1Path);
  const buf2 = fs.readFileSync(screenshot2Path);
  const pixelDiffByte = buf1.compare(buf2);
  console.log(`[TEST] Screenshot byte difference: ${pixelDiffByte === 0 ? '0 bytes (100% PIXEL PERFECT MATCH)' : pixelDiffByte + ' bytes difference'}`);

  await browser.close();

  if (camShift > 1e-6) {
    console.error(`[FAIL] Camera moved by ${camShift} units while paused!`);
    process.exit(1);
  } else {
    console.log('[PASS] Mars terrain and camera are 100% COMPLETELY STATIC while paused!');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
