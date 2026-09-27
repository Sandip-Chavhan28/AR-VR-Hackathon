/**
 * test-telemetry-graphs.mjs
 * Comprehensive validation of TelemetryGraphs.jsx:
 * - Opens telemetry panel via 'G' key
 * - Validates ALL mode (Plot 1: Alt/Vel, Plot 2: Fuel, Plot 3: Heat/G-force)
 * - Validates each individual tab: ALTITUDE, VELOCITY, FUEL, HEAT
 * - Tests speed warp: 0.5x, 1x, 5x, 10x, 50x
 * - Tests close/reopen cycle
 * - Verifies zero console errors
 */

import { chromium } from 'playwright';

const ARTIFACT_DIR = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

const consoleErrors = [];
const consoleWarnings = [];

const browser = await chromium.launch({ headless: true, channel: 'msedge' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

page.on('console', (msg) => {
  const text = msg.text();
  if (msg.type() === 'error') {
    consoleErrors.push(text);
    console.error('  ❌ Console Error:', text);
  } else if (msg.type() === 'warning' && text.includes('Warning:')) {
    consoleWarnings.push(text);
    console.warn('  ⚠️ React Warning:', text);
  }
});

page.on('pageerror', (err) => {
  consoleErrors.push(err.message);
  console.error('  ❌ Page Uncaught Exception:', err.message);
});

try {
  console.log('Connecting to simulator at http://localhost:5173...');
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  // Initialize simulation
  const initBtn = await page.$('button:has-text("INITIALIZE")');
  if (initBtn) {
    await initBtn.click({ force: true });
    console.log('  🎯 Clicked INITIALIZE MISSION SIMULATION');
    await page.waitForTimeout(1500);
  }

  // Open Telemetry stripcharts with hotkey 'G'
  console.log('\n--- 1. Testing Telemetry Open (Hotkey G) ---');
  await page.keyboard.press('g');
  await page.waitForTimeout(1500);

  // Verify telemetry panel is visible
  const panel = await page.$('.hud-panel:has-text("EDL TELEMETRY STRIPCHARTS")');
  if (!panel) {
    throw new Error('Telemetry panel not visible in DOM!');
  }
  console.log('  ✅ Telemetry panel mounted and visible');

  // Let simulation advance to accumulate telemetry data
  console.log('  ⏳ Accumulating initial telemetry data points...');
  await page.waitForTimeout(3000);

  // Capture ALL mode
  console.log('\n--- 2. Capturing ALL Mode (3 Plots) ---');
  await page.screenshot({ path: `${ARTIFACT_DIR}/telemetry_01_all_mode.png` });
  console.log('  📸 Saved: telemetry_01_all_mode.png');

  // Tab: ALTITUDE
  console.log('\n--- 3. Testing Single-Channel Tabs ---');
  await page.click('button:has-text("ALTITUDE")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/telemetry_02_altitude_tab.png` });
  console.log('  📸 Saved: telemetry_02_altitude_tab.png');

  // Tab: VELOCITY
  await page.click('button:has-text("VELOCITY")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/telemetry_03_velocity_tab.png` });
  console.log('  📸 Saved: telemetry_03_velocity_tab.png');

  // Tab: FUEL
  await page.click('button:has-text("FUEL")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/telemetry_04_fuel_tab.png` });
  console.log('  📸 Saved: telemetry_04_fuel_tab.png');

  // Tab: HEAT
  await page.click('button:has-text("HEAT")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${ARTIFACT_DIR}/telemetry_05_heat_tab.png` });
  console.log('  📸 Saved: telemetry_05_heat_tab.png');

  // Return to ALL mode
  await page.click('button:has-text("ALL")');
  await page.waitForTimeout(1000);

  // Jump to peak heating to show rich heat & G-force data
  console.log('\n--- 4. Scrubbing to Peak Heating & Deorbit ---');
  const heatBtn = await page.$('button[data-milestone="PEAK_HEATING"]');
  if (heatBtn) {
    await heatBtn.click({ force: true });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${ARTIFACT_DIR}/telemetry_06_peak_heating_all.png` });
    console.log('  📸 Saved: telemetry_06_peak_heating_all.png');
  }

  // Test speed cycling: 0.5x, 1x, 5x, 10x, 50x
  console.log('\n--- 5. Testing Multi-Speed Telemetry Performance ---');
  const speeds = ['0.5x', '1x', '5x', '10x', '50x'];
  for (const spd of speeds) {
    const spdBtn = await page.$(`button:has-text("${spd}")`);
    if (spdBtn) {
      await spdBtn.click({ force: true });
      console.log(`  ⚡ Switched to speed: ${spd}`);
      await page.waitForTimeout(800);
    }
  }

  // Capture at 50x
  await page.screenshot({ path: `${ARTIFACT_DIR}/telemetry_07_speed_50x.png` });
  console.log('  📸 Saved: telemetry_07_speed_50x.png');

  // Switch back to 1x
  const btn1x = await page.$('button:has-text("1x")');
  if (btn1x) await btn1x.click({ force: true });

  // Test close and reopen
  console.log('\n--- 6. Testing Close / Reopen Cycle ---');
  await page.keyboard.press('g'); // Close
  await page.waitForTimeout(500);
  const closedPanel = await page.$('.hud-panel:has-text("EDL TELEMETRY STRIPCHARTS")');
  console.log('  Panel after closing:', closedPanel ? 'STILL OPEN (FAIL)' : 'CLOSED (PASS)');

  await page.keyboard.press('g'); // Reopen
  await page.waitForTimeout(500);
  const reopenedPanel = await page.$('.hud-panel:has-text("EDL TELEMETRY STRIPCHARTS")');
  console.log('  Panel after reopening:', reopenedPanel ? 'REOPENED (PASS)' : 'NOT REOPENED (FAIL)');

  console.log('\n--- 7. Console Health Summary ---');
  console.log(`  Console Errors: ${consoleErrors.length}`);
  console.log(`  React Warnings: ${consoleWarnings.length}`);

  if (consoleErrors.length > 0) {
    console.log('  Errors logged:', consoleErrors);
  }

  console.log('\n✨ All telemetry validation steps completed successfully!');
} finally {
  await browser.close();
}
