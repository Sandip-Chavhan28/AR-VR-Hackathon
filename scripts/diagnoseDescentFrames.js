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
    await page.waitForTimeout(500);
  }

  // Jump to Radar Lock
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const b = btns.find(el => el.textContent?.includes('Terminal Radar') || el.textContent?.includes('RADAR'));
    if (b) b.click();
  });
  await page.waitForTimeout(1000);

  // Sample 40 consecutive frames around Radar Lock and TRN
  const samples = await page.evaluate(async () => {
    const log = [];
    for (let i = 0; i < 40; i++) {
      await new Promise(r => requestAnimationFrame(r));
      const s = window.__SIM_STATE_REF__?.current;
      const cam = window.__THREE_CAMERA__;
      const debug = window.__EDL_LANDER_DEBUG__;
      log.push({
        i,
        time: s?.elapsed,
        phase: s?.phase,
        running: s?.running,
        x: s?.x,
        y: s?.y,
        alt: s?.altitude,
        radarAlt: s?.radarAltitude,
        vx: s?.vx,
        vy: s?.vy,
        camPos: cam ? [cam.position.x, cam.position.y, cam.position.z] : null,
        mainGroupPos: debug?.mainGroupWorld,
      });
    }
    return log;
  });

  console.log('DESCENT SAMPLES:\n', JSON.stringify(samples, null, 2));
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
