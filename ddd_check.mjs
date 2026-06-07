import { chromium } from 'playwright';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:5173/movie/979', { waitUntil: 'networkidle' });
// wait for the streamed DDD section to resolve
await page.waitForTimeout(4000);
const chip = await page.locator('.chip-ddd-value').innerText().catch(() => '(none)');
const liCount = await page.locator('li.ddd-tag').count();
const bodyText = await page.locator('.ddd-body').innerText().catch(() => '(none)');
console.log('CHIP:', chip.trim());
console.log('DETAIL li.ddd-tag count:', liCount);
console.log('DETAIL body text (first 200):', bodyText.slice(0, 200).replace(/\n/g, ' | '));
await browser.close();
