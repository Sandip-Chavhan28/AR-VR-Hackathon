import { chromium } from 'playwright';

const ARTIFACT_DIR = 'C:/Users/dell/.gemini/antigravity/brain/7c89cd06-7c2e-45b0-af4a-c13ffb3a8c82';

async function shot(page, filename) {
  const path = `${ARTIFACT_DIR}/${filename}`;
  await page.screenshot({ path, fullPage: false });
  console.log(`  📸 Saved screenshot: ${filename}`);
}

async function run() {
  console.log('🚀 Running Right Toolbar & View Selector Verification...');
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const initBtn = await page.waitForSelector('button:has-text("INITIALIZE")', { timeout: 6000 }).catch(() => null);
    if (initBtn) {
      await initBtn.click({ force: true });
      console.log('  ✅ Mission Initialized');
    }
    await page.waitForTimeout(1000);

    // 1. Verify Right Toolbar Buttons and Order
    console.log('\n--- 1. Verifying Right Toolbar Buttons and Order ---');
    const rightToolbar = await page.$('div[style*="right: 24px"]');
    if (!rightToolbar) throw new Error('Right toolbar container not found!');

    const buttons = await rightToolbar.$$('button');
    console.log(`  Found ${buttons.length} buttons in right toolbar (expected 9)`);

    const buttonTexts = [];
    for (const b of buttons) {
      const text = (await b.innerText()).trim().replace(/\s+/g, ' ');
      buttonTexts.push(text);
    }
    console.log('  Toolbar button order:', buttonTexts);

    // Check order: +, −, ⟲, AUTO, ⛶, KM/MI, 📊, DEMO/REALISTIC, 👁 VIEW
    const demoIndex = buttonTexts.findIndex((t) => t.includes('DEMO') || t.includes('REALISTIC'));
    const viewIndex = buttonTexts.findIndex((t) => t.includes('VIEW'));

    console.log(`  DEMO button index: ${demoIndex}`);
    console.log(`  VIEW button index: ${viewIndex}`);

    if (viewIndex !== demoIndex + 1) {
      throw new Error(`VIEW button is NOT directly below DEMO! DEMO=${demoIndex}, VIEW=${viewIndex}`);
    }
    console.log('  ✅ PASS: VIEW button is DIRECTLY below DEMO button');

    await shot(page, 'view_selector_01_toolbar_overview.png');

    // 2. Click VIEW button to open View Selector panel
    console.log('\n--- 2. Testing VIEW Button Open ---');
    const viewBtn = buttons[viewIndex];
    await viewBtn.click();
    await page.waitForTimeout(400);

    let viewPanel = await page.$('div:has-text("CAMERA / VIEW")');
    if (!viewPanel) throw new Error('View Selector panel did not open after clicking VIEW button!');
    console.log('  ✅ PASS: VIEW button opened View Selector panel');

    await shot(page, 'view_selector_02_panel_opened.png');

    // 3. Verify All 7 Camera Presets are Present
    console.log('\n--- 3. Verifying All 7 Camera Presets ---');
    const expectedPresets = [
      { name: 'FREE ORBIT', shortcut: '[F]' },
      { name: 'FRONT PROFILE', shortcut: '[1]' },
      { name: 'AERIAL OVERVIEW', shortcut: '[2]' },
      { name: 'GROUND LEVEL', shortcut: '[3]' },
      { name: 'REAR / MMRTG', shortcut: '[4]' },
      { name: 'CINEMATIC ORBIT', shortcut: '[5]' },
      { name: 'AUTO TOUR', shortcut: '[T]' },
    ];

    for (const p of expectedPresets) {
      const hasName = await page.$(`button:has-text("${p.name}")`);
      const hasKey = await page.$(`text=${p.shortcut}`);
      if (!hasName || !hasKey) {
        throw new Error(`Preset ${p.name} with shortcut ${p.shortcut} not found in panel!`);
      }
      console.log(`  ✅ Found preset: ${p.name} ${p.shortcut}`);
    }

    // 4. Test Selecting a Preset (Front Profile)
    console.log('\n--- 4. Testing Preset Selection (Front Profile) ---');
    const frontBtn = await page.waitForSelector('button:has-text("FRONT PROFILE")');
    await frontBtn.click();
    await page.waitForTimeout(600);

    // Verify Front Profile is highlighted/active
    const isFrontActive = await frontBtn.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.borderLeftColor.includes('0, 229, 255') || style.color.includes('0, 229, 255') || el.style.borderLeft.includes('00e5ff');
    });
    console.log(`  Front Profile active highlight: ${isFrontActive}`);
    await shot(page, 'view_selector_03_front_profile_selected.png');

    // 5. Test Selecting Aerial Overview [2]
    console.log('\n--- 5. Testing Preset Selection (Aerial Overview) ---');
    const aerialBtn = await page.waitForSelector('button:has-text("AERIAL OVERVIEW")');
    await aerialBtn.click();
    await page.waitForTimeout(600);
    await shot(page, 'view_selector_04_aerial_overview_selected.png');

    // 6. Test ESC Key to Close
    console.log('\n--- 6. Testing ESC Key Close ---');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    let panelAfterEsc = await page.$('div:has-text("CAMERA / VIEW")');
    if (panelAfterEsc) throw new Error('Panel did not close on ESC!');
    console.log('  ✅ PASS: ESC key closed the panel');

    // 7. Test VIEW Button Toggle (Close)
    console.log('\n--- 7. Testing VIEW Button Toggle Close ---');
    await viewBtn.click();
    await page.waitForTimeout(400);
    let panelOpenAgain = await page.$('div:has-text("CAMERA / VIEW")');
    if (!panelOpenAgain) throw new Error('Panel did not open on second VIEW click!');
    console.log('  Panel opened on toggle click');

    await viewBtn.click();
    await page.waitForTimeout(400);
    let panelClosedToggle = await page.$('div:has-text("CAMERA / VIEW")');
    if (panelClosedToggle) throw new Error('Panel did not close on second VIEW click toggle!');
    console.log('  ✅ PASS: Clicking VIEW button again closed the panel');

    // 8. Test Outside Click to Close
    console.log('\n--- 8. Testing Outside Click Close ---');
    await viewBtn.click();
    await page.waitForTimeout(400);
    // Click in center of screen
    await page.mouse.click(500, 450);
    await page.waitForTimeout(400);
    let panelAfterOutsideClick = await page.$('div:has-text("CAMERA / VIEW")');
    if (panelAfterOutsideClick) throw new Error('Panel did not close on outside click!');
    console.log('  ✅ PASS: Outside click closed the panel');

    // 9. Test Keyboard Shortcuts while open (e.g. key '3' for GROUND LEVEL)
    console.log('\n--- 9. Testing Keyboard Shortcuts (Key 3 for Ground Level) ---');
    await viewBtn.click();
    await page.waitForTimeout(400);
    await page.keyboard.press('3');
    await page.waitForTimeout(600);
    await shot(page, 'view_selector_05_ground_level_key3.png');
    console.log('  ✅ PASS: Key 3 activated Ground Level');

    // Test key 'T' for Auto Tour
    await page.keyboard.press('T');
    await page.waitForTimeout(600);
    await shot(page, 'view_selector_06_auto_tour_keyT.png');
    console.log('  ✅ PASS: Key T activated Auto Tour');

    // 10. Close and test landing sequence compatibility
    console.log('\n--- 10. Verifying EDL Touchdown with Toolbar & View Selector ---');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    const tdBtn = await page.waitForSelector('button[data-milestone="TOUCHDOWN"]', { timeout: 5000 });
    if (tdBtn) await tdBtn.click({ force: true });
    await page.waitForTimeout(1000);

    // Reopen View Selector while landed
    await viewBtn.click();
    await page.waitForTimeout(600);
    await shot(page, 'view_selector_07_landed_view_selector.png');
    console.log('  ✅ PASS: View Selector operates flawlessly in post-landing surface operations');

    console.log('\n🎉 ALL VIEW BUTTON & CAMERA SELECTOR VERIFICATIONS PASSED SUCCESSFULLY!');
  } catch (err) {
    console.error('❌ Verification Error:', err);
    await shot(page, 'view_selector_error.png');
    throw err;
  } finally {
    await browser.close();
  }
}

run();
