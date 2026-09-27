import { chromium } from 'playwright';

async function test() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message, '\n', err.stack));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log('CONSOLE ERROR:', msg.text());
  });
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(2000);
  const initBtn = await page.$('button:has-text("INITIALIZE")');
  if (initBtn) await initBtn.click({ force: true });
  await page.waitForTimeout(1000);
  const tdBtn = await page.$('button[data-milestone="TOUCHDOWN"]');
  if (tdBtn) await tdBtn.click({ force: true });
  await page.waitForTimeout(3000);
  await browser.close();
}

test();
