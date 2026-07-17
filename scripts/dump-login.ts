import { chromium } from 'playwright';

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/auth');
  await page.fill('input[type="email"]', '123@gmail.com');
  const pwd = await page.locator('input[type="password"]');
  if (await pwd.isVisible()) await pwd.fill('password123');
  await page.click('button[type="submit"], button:has-text("Masuk")');
  await page.waitForTimeout(1000);
  try { await page.waitForSelector('[role="alert"], [data-sonner-toast]', { timeout: 2000 }); } catch (e) {}
  await page.screenshot({ path: 'scripts/dump_error.png' });
  const text = await page.evaluate(() => document.body.innerText);
  console.log("PAGE TEXT:", text);
  await browser.close();
}
main();
