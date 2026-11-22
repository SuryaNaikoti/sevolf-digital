const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  // 1. Visit cart page first to set localStorage
  await page.goto('http://localhost:3000/cart', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const item = {
      product: {
        id: "prod-reset-kit",
        name: "14-Day Home Reset Kit",
        tagline: "A systematic framework",
        description: "Transform cluttered living spaces",
        category: "home-living",
        categoryLabel: "Home & Living",
        format: "pdf",
        formatLabel: "Digital PDF Workbook + Printables",
        price: 24,
        compareAtPrice: 38,
        coverImage: "/images/products/covers/home-reset.png",
        slug: "14-day-home-reset-kit",
        featured: true,
        badge: "Bestseller"
      },
      quantity: 1
    };
    localStorage.setItem('sevolf_digital_cart_v1', JSON.stringify([item]));
  });

  // 2. Reload /cart so CartProvider initializes with the items
  await page.reload({ waitUntil: 'networkidle' });

  const result = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile Navigation"]');
    const stickyCheckout = document.querySelector('.fixed.bottom-14');
    return {
      navRect: nav ? nav.getBoundingClientRect() : null,
      stickyCheckoutRect: stickyCheckout ? stickyCheckout.getBoundingClientRect() : null,
      isStickyCheckoutAboveNav: stickyCheckout && nav ? stickyCheckout.getBoundingClientRect().bottom <= nav.getBoundingClientRect().top + 1 : false
    };
  });

  console.log('Cart with item result:', JSON.stringify(result, null, 2));

  await browser.close();
})();
