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

  const result = await page.evaluate(() => {
    const scene = window.__THREE_SCENE__;
    const camera = window.__THREE_CAMERA__;
    if (!scene || !camera) return { error: 'Scene or Camera not found' };

    // Traverse scene to find Lander and Rover
    let roverNode = null;
    let landerNode = null;
    let marsGlobeNode = null;

    scene.traverse(node => {
      if (node.name === 'ROVER_ROOT' || (node.type === 'Group' && node.children.some(c => c.name?.includes('WEB')))) {
        roverNode = node;
      }
      if (node.name === 'LANDER_ROOT' || (node.type === 'Group' && node.children.some(c => c.name === 'BACKSHELL_CONE'))) {
        landerNode = node;
      }
      if (node.geometry?.type === 'SphereGeometry' && node.geometry.parameters?.radius > 1000) {
        marsGlobeNode = node;
      }
    });

    const getTransform = (obj) => {
      if (!obj) return null;
      return {
        name: obj.name,
        type: obj.type,
        visible: obj.visible,
        pos: [obj.position.x, obj.position.y, obj.position.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        childrenCount: obj.children.length,
      };
    };

    const list = [];
    const p = camera.position.clone();
    scene.traverse(node => {
      node.getWorldPosition(p);
      if (Math.abs(p.y - 250) < 5) {
        list.push({
          type: node.type,
          name: node.name,
          visible: node.visible,
          pos: [p.x, p.y, p.z],
          children: node.children.length,
          isMesh: !!node.isMesh,
          material: node.material ? (Array.isArray(node.material) ? node.material.map(m => m.type) : { type: node.material.type, color: node.material.color?.getHexString(), opacity: node.material.opacity, transparent: node.material.transparent }) : null,
          geometry: node.geometry ? node.geometry.type : null,
        });
      }
    });

    const roverGroup = scene.getObjectByName('RoverRoot');
    const pts = [];
    if (roverGroup) {
      roverGroup.traverse(m => {
        if (m.isMesh) {
          m.getWorldPosition(p);
          const proj = p.clone().project(camera);
          pts.push({
            name: m.name,
            world: [p.x, p.y, p.z],
            ndc: [proj.x, proj.y, proj.z],
            pixel: [
              Math.round((proj.x * 0.5 + 0.5) * 1440),
              Math.round((-proj.y * 0.5 + 0.5) * 900)
            ]
          });
        }
      });
    }

    const renderer = window.__THREE_GL__;
    const glCtx = renderer?.getContext();
    const pixels = new Uint8Array(4 * 10 * 10);
    let nonZero = [];
    if (glCtx) {
      glCtx.readPixels(715, 415, 10, 10, glCtx.RGBA, glCtx.UNSIGNED_BYTE, pixels);
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i] > 2 || pixels[i+1] > 2 || pixels[i+2] > 2) {
          nonZero.push([pixels[i], pixels[i+1], pixels[i+2], pixels[i+3]]);
        }
      }
    }

    return {
      camera: {
        pos: [camera.position.x, camera.position.y, camera.position.z],
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
      },
      roverMeshCount: pts.length,
      sampleRoverMeshes: pts.slice(0, 10),
      sampledPixelsNonZero: nonZero.length,
      sampleColors: nonZero.slice(0, 10),
    };
  });

  console.log('Result:', JSON.stringify(result, null, 2));
  await browser.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
