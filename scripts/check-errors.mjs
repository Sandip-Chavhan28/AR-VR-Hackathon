import { chromium } from 'playwright';

async function check() {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('ERROR:', err.message));
  await page.goto('http://localhost:5173');
  await page.waitForTimeout(3000);
  const btn = await page.$('button');
  if (btn) await btn.click();
  await page.waitForTimeout(2000);
  await browser.close();
}

check();
