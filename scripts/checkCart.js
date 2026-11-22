const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // Test cart page
  await page.goto('http://localhost:3000/cart', { waitUntil: 'networkidle' });
  
  const navPresent = await page.evaluate(() => {
    const el = document.querySelector('nav[aria-label="Mobile Navigation"]');
    return el ? {
      rect: el.getBoundingClientRect(),
      computed: window.getComputedStyle(el).display
    } : null;
  });
  console.log('Nav on /cart:', navPresent);

  await browser.close();
})();
