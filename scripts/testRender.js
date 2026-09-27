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
  await page.waitForTimeout(1500);

  const res = await page.evaluate(() => {
    const renderer = window.__THREE_GL__;
    const scene = window.__THREE_SCENE__;
    const camera = window.__THREE_CAMERA__;
    if (!renderer || !scene || !camera) return 'missing three objects';
    
    // Disable shadow and boost light
    scene.traverse(node => {
      if (node.isDirectionalLight) {
        node.castShadow = false;
        node.intensity = 3.0;
      }
      if (node.isAmbientLight) {
        node.intensity = 1.0;
        node.color.setHex(0xffffff);
      }
    });

    // Explicitly render
    renderer.render(scene, camera);
    const gl = renderer.getContext();
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    // Sample across the buffer
    const px = new Uint8Array(4 * w * 10);
    // Read a 20x20 box around the projected rover center (x=720, y=420 in GL coords)
    const roverBox = new Uint8Array(4 * 20 * 20);
    gl.readPixels(710, 410, 20, 20, gl.RGBA, gl.UNSIGNED_BYTE, roverBox);
    const roverColors = [];
    for (let i = 0; i < roverBox.length; i += 4) {
      roverColors.push([roverBox[i], roverBox[i+1], roverBox[i+2], roverBox[i+3]]);
    }

    return {
      drawingBufferWidth: w,
      drawingBufferHeight: h,
      roverBoxPixels: roverColors.slice(0, 25),
      distinctColors: Array.from(new Set(roverColors.map(c => c.slice(0, 3).join(',')))),
    };
  });
  console.log('Result:', res);
  await browser.close();
}

main().catch(console.error);
