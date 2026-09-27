import { chromium } from 'playwright';

async function diagnose() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', err => console.error(`[BROWSER ERROR] ${err}`));

  console.log('Navigating to http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Click start mission button
  const btn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (btn) await btn.click();
  await page.waitForTimeout(1000);

  // Inspect Three.js scene hierarchy and rover objects
  const sceneInfo = await page.evaluate(() => {
    const scene = window.__THREE_SCENE__;
    if (!scene) return { error: 'window.__THREE_SCENE__ not found' };

    // Traverse scene and collect all objects
    const meshes = [];
    const groups = [];

    scene.traverse((obj) => {
      if (obj.isMesh) {
        meshes.push({
          id: obj.id,
          name: obj.name,
          geom: obj.geometry?.type,
          visible: obj.visible,
          parent: obj.parent?.type,
          parentName: obj.parent?.name,
          castShadow: obj.castShadow,
          receiveShadow: obj.receiveShadow,
        });
      } else if (obj.isGroup) {
        groups.push({
          id: obj.id,
          name: obj.name,
          children: obj.children?.length,
          visible: obj.visible,
        });
      }
    });

    return {
      childrenCount: scene.children.length,
      meshCount: meshes.length,
      groupCount: groups.length,
      meshes: meshes.slice(0, 40),
    };
  });

  console.log('Scene Info:', JSON.stringify(sceneInfo, null, 2));

  await browser.close();
}

diagnose().catch(console.error);
