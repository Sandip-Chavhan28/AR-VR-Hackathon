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

  // Jump to Touchdown milestone
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Touchdown'));
    if (btn) btn.click();
  });
  await page.waitForTimeout(3200);

  const inspectMeshes = await page.evaluate(() => {
    const scene = window.__THREE_SCENE__;
    const camera = window.__THREE_CAMERA__;
    const results = [];

    scene.traverse((obj) => {
      if (obj.isMesh && obj.visible) {
        // Check if ancestors are visible
        let p = obj.parent;
        let ancestorVisible = true;
        while (p) {
          if (!p.visible) { ancestorVisible = false; break; }
          p = p.parent;
        }
        if (!ancestorVisible) return;

        const mat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
        results.push({
          name: obj.name || 'unnamed',
          parentName: obj.parent?.name || obj.parent?.type,
          geomType: obj.geometry?.type,
          vertCount: obj.geometry?.attributes?.position?.count,
          matType: mat?.type,
          matColor: mat?.color?.getHexString ? '#' + mat.color.getHexString() : null,
          opacity: mat?.opacity,
          transparent: mat?.transparent,
          depthWrite: mat?.depthWrite,
          depthTest: mat?.depthTest,
          renderOrder: obj.renderOrder,
          pos: [obj.position.x, obj.position.y, obj.position.z],
        });
      }
    });

    return results;
  });

  console.log('Visible meshes count:', inspectMeshes.length);
  for (const m of inspectMeshes) {
    if (m.transparent || m.opacity < 1.0 || m.geomType?.includes('Cylinder') || m.geomType?.includes('Cone') || m.geomType?.includes('Plane') || m.name?.includes('Grid') || m.name?.includes('Trajectory') || m.name?.includes('Atmo') || m.name?.includes('Sky')) {
      console.log(JSON.stringify(m));
    }
  }

  await browser.close();
}

main().catch(console.error);
