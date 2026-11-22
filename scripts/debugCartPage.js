const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // Listen to console and page errors
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

  await page.goto('http://localhost:3000/cart', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const info = await page.evaluate(() => {
    return {
      title: document.title,
      url: window.location.href,
      nav: !!document.querySelector('nav[aria-label="Mobile Navigation"]'),
      navHtml: document.querySelector('nav[aria-label="Mobile Navigation"]')?.outerHTML?.substring(0, 100),
      bodyChildren: Array.from(document.body.children).map(c => c.tagName + '.' + c.className.substring(0, 30))
    };
  });
  console.log('INFO:', info);

  await browser.close();
})();
