import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  const introBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (introBtn) await introBtn.click();
  await page.waitForTimeout(500);

  // Jump to touchdown
  const tdBtn = await page.$('button:has-text("Touchdown"), .milestone-btn:has-text("Touchdown")');
  if (tdBtn) await tdBtn.click();
  await page.waitForTimeout(1000);

  // Dismiss modal
  const exploreBtn = await page.$('button:has-text("EXPLORE SURFACE (FREE CAM)")');
  if (exploreBtn) await exploreBtn.click();
  await page.waitForTimeout(800);

  const data = await page.evaluate(() => {
    const scene = window.__THREE_SCENE__;
    const camera = window.__THREE_CAMERA__;
    const THREE = window.THREE || { Vector3: camera.position.constructor };

    const visibleNear = [];
    scene.traverse(obj => {
      if (obj.isMesh) {
        let p = obj;
        let isVis = true;
        while (p) {
          if (!p.visible) { isVis = false; break; }
          p = p.parent;
        }
        if (isVis) {
          const wp = obj.getWorldPosition(new THREE.Vector3());
          if (Math.hypot(wp.x - 513.808, wp.z) < 15) {
            visibleNear.push({
              id: obj.id,
              geom: obj.geometry?.type,
              pos: [Number(wp.x.toFixed(3)), Number(wp.y.toFixed(3)), Number(wp.z.toFixed(3))],
              color: obj.material?.color ? '#' + obj.material.color.getHexString() : undefined,
              parent: obj.parent?.type,
              castShadow: obj.castShadow,
              receiveShadow: obj.receiveShadow
            });
          }
        }
      }
    });

    // Check light and shadow camera
    let lightInfo = null;
    scene.traverse(obj => {
      if (obj.isDirectionalLight) {
        lightInfo = {
          pos: [obj.position.x, obj.position.y, obj.position.z],
          target: [obj.target.position.x, obj.target.position.y, obj.target.position.z],
          castShadow: obj.castShadow,
          shadowCamBounds: obj.shadow?.camera ? {
            left: obj.shadow.camera.left,
            right: obj.shadow.camera.right,
            top: obj.shadow.camera.top,
            bottom: obj.shadow.camera.bottom,
            near: obj.shadow.camera.near,
            far: obj.shadow.camera.far
          } : null
        };
      }
    });

    return {
      visibleNearRoverCount: visibleNear.length,
      visibleNearRover: visibleNear,
      lightInfo
    };
  });

  console.log('Result:', JSON.stringify(data, null, 2));
  await browser.close();
}

main().catch(console.error);
