import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-gl=angle', '--use-angle=default'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

  await page.goto('http://localhost:5173');
  await page.waitForSelector('canvas');
  await page.waitForTimeout(1000);

  // Click Initialize
  const startBtn = await page.$('button:has-text("INITIALIZE MISSION SIMULATION")');
  if (startBtn) {
    await startBtn.click();
    await page.waitForTimeout(500);
  }

  // Sample 25 consecutive animation frames
  const samples = await page.evaluate(async () => {
    const log = [];
    for (let i = 0; i < 25; i++) {
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
        vx: s?.vx,
        vy: s?.vy,
        camPos: cam ? [cam.position.x, cam.position.y, cam.position.z] : null,
        mainGroupPos: debug?.mainGroupWorld,
      });
    }
    return log;
  });

  console.log('SAMPLES:\n', JSON.stringify(samples, null, 2));
  await page.screenshot({ path: 'scripts/live_start_sample.png' });
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
