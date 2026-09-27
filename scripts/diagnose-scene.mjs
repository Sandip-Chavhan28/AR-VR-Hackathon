import { chromium } from 'playwright';

async function diagnose() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);
  const btn = await page.$('button');
  if (btn) await btn.click();
  await page.waitForTimeout(1000);
  
  // Jump to TOUCHDOWN
  const buttons = await page.$$('button');
  for (const b of buttons) {
    const text = await b.textContent();
    if (text && text.includes('TOUCHDOWN')) {
      await b.click();
      break;
    }
  }
  await page.waitForTimeout(2000);
  
  // Query scene diagnostics
  const report = await page.evaluate(() => {
    const scene = window.__THREE_SCENE__;
    const camera = window.__THREE_CAMERA__;
    if (!scene || !camera) return 'Scene or camera not exposed on window';
    
    const results = [];
    results.push(`Camera pos: ${camera.position.x.toFixed(2)}, ${camera.position.y.toFixed(2)}, ${camera.position.z.toFixed(2)}`);
    results.push(`Camera near: ${camera.near}, far: ${camera.far}`);
    
    scene.traverse(obj => {
      if (obj.geometry) {
        results.push(`Object: ${obj.name || obj.type} | visible: ${obj.visible} | pos: ${obj.position.x.toFixed(2)}, ${obj.position.y.toFixed(2)}, ${obj.position.z.toFixed(2)} | geom: ${obj.geometry.type} | mat: ${obj.material?.type} | color: ${obj.material?.color?.getHexString() || 'none'}`);
      }
    });
    return results.join('\n');
  });
  
  console.log('--- SCENE REPORT AT TOUCHDOWN ---');
  console.log(report);
  
  await browser.close();
}

diagnose();
