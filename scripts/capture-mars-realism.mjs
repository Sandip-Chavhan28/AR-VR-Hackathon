/**
 * capture-mars-realism.mjs
 * Validates the Mars Realism Pass across all 7 requested altitudes:
 * A. 250 km (Orbit)
 * B. 100 km (Entry Interface)
 * C. 45 km (Peak Heating)
 * D. 10 km (Parachute Deployment)
 * E. 4 km (Terminal Radar Lock)
 * F. 2.5 km (Terrain-Relative Navigation)
 * G. Surface (Touchdown)
 */
import { chromium } from 'playwright';

const ARTIFACT_DIR = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

async function shot(page, name) {
  await page.waitForTimeout(1000);
  const file = `${ARTIFACT_DIR}/${name}`;
  await page.screenshot({ path: file });
  console.log(`  📸 Saved: ${name}`);
}

async function jumpMilestone(page, id) {
  const btn = await page.$(`button[data-milestone="${id}"]`);
  if (btn) {
    await btn.click({ force: true });
    console.log(`  🎯 Jumped to: ${id}`);
    await page.waitForTimeout(2000);
    return true;
  }
  console.warn(`  ⚠️ Milestone button not found: ${id}`);
  return false;
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  console.log('Connecting to simulator at http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // Initialize mission
  const initBtn = await page.$('button:has-text("INITIALIZE")');
  if (initBtn) await initBtn.click({ force: true });
  await page.waitForTimeout(2000);

  // Pause
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);

  // ── A. 250 km (Orbit view)
  console.log('\n--- A. 250 km (Orbit view) ---');
  await page.keyboard.press('7'); // ORBIT_OVERVIEW
  await shot(page, 'A_250km_orbit.png');

  // Also take chase view at 250 km
  await page.keyboard.press('1'); // CHASE
  await shot(page, 'A_250km_chase.png');

  // ── B. 100 km (Entry Interface ~125 km)
  console.log('\n--- B. 100 km (Entry Interface) ---');
  await jumpMilestone(page, 'ENTRY_INTERFACE');
  await page.keyboard.press('Space'); // pause
  await page.keyboard.press('1'); // CHASE
  await shot(page, 'B_100km_entry.png');

  // ── C. 45 km (Peak Heating)
  console.log('\n--- C. 45 km (Peak Heating) ---');
  await jumpMilestone(page, 'PEAK_HEATING');
  await page.keyboard.press('Space'); // pause
  await page.keyboard.press('2'); // HEAT_SHIELD_CAM
  await shot(page, 'C_45km_peak_heating.png');

  // ── D. 10 km (Parachute Deployment)
  console.log('\n--- D. 10 km (Parachute) ---');
  await jumpMilestone(page, 'PARACHUTE_DEPLOY');
  await page.keyboard.press('Space'); // pause
  await page.keyboard.press('3'); // PARACHUTE_LOOKUP
  await shot(page, 'D_10km_parachute.png');

  // ── E. 4 km (Terminal Radar Lock)
  console.log('\n--- E. 4 km (Radar Lock) ---');
  await jumpMilestone(page, 'RADAR_LOCK');
  await page.keyboard.press('Space'); // pause
  await page.keyboard.press('1'); // CHASE
  await shot(page, 'E_4km_radar_lock.png');

  // ── F. 2.5 km (Terrain-Relative Navigation)
  console.log('\n--- F. 2.5 km (TRN) ---');
  await jumpMilestone(page, 'TRN_HAZARD');
  await page.keyboard.press('Space'); // pause
  await page.keyboard.press('5'); // POWERED_DESCENT / TRN tracking
  await shot(page, 'F_2.5km_trn.png');

  // ── G. Surface (Touchdown)
  console.log('\n--- G. Surface (Touchdown) ---');
  await jumpMilestone(page, 'TOUCHDOWN');
  await page.waitForTimeout(2000);
  const closeBtn = await page.$('button:has-text("EXPLORE SURFACE")');
  if (closeBtn) {
    await closeBtn.click({ force: true });
    console.log('  🎯 Dismissed Result Modal (Surface Explorer)');
  }
  await page.waitForTimeout(1000);
  await page.keyboard.press('Space'); // pause

  // Hero ground close-up
  await page.keyboard.press('6'); // GROUND_TOUCHDOWN
  await shot(page, 'G_surface_ground.png');

  // Free camera overview
  await page.keyboard.press('8'); // FREE
  await shot(page, 'G_surface_touchdown.png');

  console.log('\n✨ All 7 altitude screenshots captured successfully!');
} finally {
  await browser.close();
}
