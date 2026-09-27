import { chromium } from 'playwright';

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

  // 1. Jump to SKY CRANE milestone
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Sky Crane'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/check_skycrane_rover.png' });

  // 2. Jump to TOUCHDOWN milestone
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Touchdown'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82/check_touchdown_rover.png' });

  // Inspect Rover transform and visibility in Three.js
  const roverDebug = await page.evaluate(() => {
    const scene = window.__THREE_SCENE__;
    const camera = window.__THREE_CAMERA__;
    const roverRoot = scene?.getObjectByName('RoverRoot');
    
    if (!roverRoot) return { error: 'RoverRoot not found' };

    const getWPos = (o) => {
      const v = camera.position.clone();
      o.getWorldPosition(v);
      return [v.x, v.y, v.z];
    };
    const getWScale = (o) => {
      const v = camera.position.clone();
      o.getWorldScale(v);
      return [v.x, v.y, v.z];
    };

    let parentChain = [];
    let curr = roverRoot;
    while (curr) {
      parentChain.push({
        name: curr.name || curr.type,
        visible: curr.visible,
        pos: [curr.position.x, curr.position.y, curr.position.z],
        scale: [curr.scale.x, curr.scale.y, curr.scale.z],
      });
      curr = curr.parent;
    }

    return {
      roverVisible: roverRoot.visible,
      roverWorldPos: getWPos(roverRoot),
      roverWorldScale: getWScale(roverRoot),
      cameraPos: [camera.position.x, camera.position.y, camera.position.z],
      cameraLookAt: window.__EDL_CAMERA_DEBUG__?.lookTarget,
      cameraNear: camera.near,
      cameraFar: camera.far,
      parentChain,
      simState: {
        phase: window.__SIM_STATE_REF__?.current?.phase,
        alt: window.__SIM_STATE_REF__?.current?.altitude,
        grounded: window.__SIM_STATE_REF__?.current?.grounded,
      }
    };
  });

  console.log('Rover Debug:', JSON.stringify(roverDebug, null, 2));
  await browser.close();
}

main().catch(console.error);
