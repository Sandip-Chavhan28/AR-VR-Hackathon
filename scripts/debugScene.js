import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=default'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://localhost:5173');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1000);

  const startBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(1000);
  }

  const debugInfo = await page.evaluate(() => {
    const s = window.__SIM_STATE_REF__?.current;
    const dbg = window.__EDL_LANDER_DEBUG__;
    const cam = window.__EDL_CAMERA_DEBUG__;
    
    // Look for three js canvas and webgl context
    const canvas = document.querySelector('canvas');
    return {
      state: s ? {
        phase: s.phase,
        alt: s.altitude,
        speed: s.speed,
        x: s.x,
        y: s.y,
        z: s.z,
        vx: s.vx,
        vy: s.vy,
        vz: s.vz,
        guidanceRefX: s.guidanceRefX,
        guidanceRefY: s.guidanceRefY,
      } : null,
      landerDbg: dbg,
      camDbg: cam,
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
    };
  });

  console.log('Scene Debug:', JSON.stringify(debugInfo, null, 2));
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
