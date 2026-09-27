/**
 * capture-phases.mjs — Visual validation screenshots for all 7 EDL phases.
 * Run: node scripts/capture-phases.mjs
 */
import { chromium } from 'playwright';

const ARTIFACT_DIR = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

async function shot(page, name) {
  await page.waitForTimeout(1000);
  const file = `${ARTIFACT_DIR}/${name}`;
  await page.screenshot({ path: file });
  console.log(`  📸  ${name}`);
}

// Click a milestone button by partial text match
async function clickMilestone(page, partialText) {
  // Try the timeline milestone buttons
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = (await btn.textContent().catch(() => '')).trim().toUpperCase();
    if (text.includes(partialText.toUpperCase())) {
      await btn.click({ force: true }).catch(() => {});
      console.log(`  🎯  Clicked: ${text}`);
      return true;
    }
  }
  // Try data attributes
  const nodes = await page.$$('[data-milestone]');
  for (const node of nodes) {
    const val = (await node.getAttribute('data-milestone') || '').toUpperCase();
    if (val.includes(partialText.toUpperCase())) {
      await node.click({ force: true }).catch(() => {});
      console.log(`  🎯  Clicked milestone: ${val}`);
      return true;
    }
  }
  console.warn(`  ⚠️   Milestone not found: ${partialText}`);
  return false;
}

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  // ── Start mission
  const btn = await page.$('button:has-text("INITIALIZE")');
  if (btn) await btn.click({ force: true });
  await page.waitForTimeout(2000);

  // ── A: Phase 1 — ORBIT (rover must be hidden inside aeroshell)
  console.log('\nA: Phase 1 — ORBIT (rover hidden inside aeroshell)');
  await page.keyboard.press('Space'); // pause
  await page.waitForTimeout(400);
  await page.keyboard.press('7'); // ORBIT_OVERVIEW camera
  await shot(page, 'A_phase1_orbit.png');

  // ── B: Cruise stage separation — cruise stage separates
  console.log('\nB: Cruise Stage Separation');
  await page.keyboard.press('Space'); // unpause
  await page.waitForTimeout(300);
  const gotCruise = await clickMilestone(page, 'CRUISE');
  if (!gotCruise) await clickMilestone(page, 'ENTRY');
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  await shot(page, 'B_cruise_sep.png');

  // ── C: Parachute phase — aeroshell + parachute visible, rover hidden
  console.log('\nC: Parachute Phase');
  await page.keyboard.press('Space'); // unpause
  await clickMilestone(page, 'PARACHUTE');
  await page.keyboard.press('3'); // parachute lookup camera
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  await shot(page, 'C_parachute.png');

  // ── D: Backshell separation — descent stage + rover become visible
  console.log('\nD: Backshell Separation');
  await page.keyboard.press('Space');
  await clickMilestone(page, 'BACKSHELL');
  await page.keyboard.press('5'); // powered descent camera
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  await shot(page, 'D_backshell_sep.png');

  // ── E: Sky crane — rover hanging below descent stage
  console.log('\nE: Sky Crane Deployment');
  await page.keyboard.press('Space');
  await clickMilestone(page, 'POWERED');
  await page.waitForTimeout(600);
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  await shot(page, 'E_skycrane.png');

  // ── F: Touchdown — rover wheels on terrain
  console.log('\nF: Touchdown');
  await page.keyboard.press('Space');
  await clickMilestone(page, 'TOUCHDOWN');
  await page.waitForTimeout(1800);
  await page.keyboard.press('Space');
  await page.waitForTimeout(400);
  await shot(page, 'F_touchdown.png');

  // ── G: Final — rover alone on Mars
  console.log('\nG: Final — Rover alone on Mars');
  await page.keyboard.press('Space');
  await page.waitForTimeout(2500);
  await page.keyboard.press('Space');
  await page.keyboard.press('8'); // FREE cam
  await page.waitForTimeout(1000);
  await shot(page, 'G_final_rover.png');

  console.log('\n✅ All 7 phase screenshots captured successfully.\n');
} finally {
  await browser.close();
}
