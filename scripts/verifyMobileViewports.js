const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function runMobileVerification() {
  const outputDir = path.join(process.cwd(), 'public', 'verification-screenshots');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({
    channel: 'msedge',
    headless: true,
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();

  console.log('--- Step 1: Homepage Verification ---');
  await page.goto('http://localhost:3000', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const bottomNavStyles = await page.evaluate(() => {
    const el = document.querySelector('nav[aria-label="Mobile Navigation"]');
    if (!el) return null;
    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      display: computed.display,
      position: computed.position,
      bottom: computed.bottom,
      zIndex: computed.zIndex,
      rect: { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      windowHeight: window.innerHeight,
    };
  });
  console.log('Home Bottom Nav Styles:', JSON.stringify(bottomNavStyles, null, 2));

  await page.screenshot({
    path: path.join(outputDir, '01-home-390x844.png'),
    fullPage: false,
  });

  console.log('--- Step 2: Catalogue Verification & Scrolling ---');
  await page.goto('http://localhost:3000/shop', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  // Scroll 500px down
  await page.evaluate(() => window.scrollBy(0, 500));
  await page.waitForTimeout(500);

  const shopNavStyles = await page.evaluate(() => {
    const el = document.querySelector('nav[aria-label="Mobile Navigation"]');
    if (!el) return null;
    const computed = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      display: computed.display,
      position: computed.position,
      bottom: computed.bottom,
      rect: { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
      scrollY: window.scrollY,
    };
  });
  console.log('Shop Scrolled Bottom Nav Styles:', JSON.stringify(shopNavStyles, null, 2));

  await page.screenshot({
    path: path.join(outputDir, '02-catalogue-scrolled-390x844.png'),
    fullPage: false,
  });

  console.log('--- Step 3: Product Detail - Top Verification ---');
  await page.goto('http://localhost:3000/products/14-day-home-reset-kit', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);

  const productTopStyles = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile Navigation"]');
    const stickyBar = document.querySelector('.fixed.bottom-14');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const barRect = stickyBar ? stickyBar.getBoundingClientRect() : null;
    return {
      hasBottomNav: !!nav,
      hasStickyBar: !!stickyBar,
      navRect,
      barRect,
      barZIndex: stickyBar ? window.getComputedStyle(stickyBar).zIndex : null,
      navZIndex: nav ? window.getComputedStyle(nav).zIndex : null,
    };
  });
  console.log('Product Top Elements:', JSON.stringify(productTopStyles, null, 2));

  await page.screenshot({
    path: path.join(outputDir, '03-product-top-390x844.png'),
    fullPage: false,
  });

  console.log('--- Step 4: Product Detail - Scrolled Verification ---');
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(500);

  const productScrolledStyles = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile Navigation"]');
    const stickyBar = document.querySelector('.fixed.bottom-14');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const barRect = stickyBar ? stickyBar.getBoundingClientRect() : null;
    return {
      scrollY: window.scrollY,
      navRect,
      barRect,
      isStickyBarAboveNav: barRect && navRect ? barRect.bottom <= navRect.top + 1 : false,
    };
  });
  console.log('Product Scrolled Elements:', JSON.stringify(productScrolledStyles, null, 2));

  await page.screenshot({
    path: path.join(outputDir, '04-product-bottom-scrolled-390x844.png'),
    fullPage: false,
  });

  console.log('--- Step 5: Open Cart Drawer Verification ---');
  // Open drawer by clicking the View Shopping Bag button in Header
  await page.evaluate(() => {
    const btn = document.querySelector('button[aria-label="View Shopping Bag"]');
    if (btn) btn.click();
  });
  await page.waitForTimeout(800);

  const cartDrawerStyles = await page.evaluate(() => {
    const drawerDialog = document.querySelector('div[role="dialog"][aria-label="Shopping Bag Drawer"]');
    const drawerContainer = drawerDialog ? drawerDialog.querySelector('.fixed.inset-0.md\\:inset-y-0') : null;
    const nav = document.querySelector('nav[aria-label="Mobile Navigation"]');
    const stickyBar = document.querySelector('.fixed.bottom-14');

    const dialogRect = drawerDialog ? drawerDialog.getBoundingClientRect() : null;
    const containerRect = drawerContainer ? drawerContainer.getBoundingClientRect() : null;

    return {
      isDialogOpen: !!drawerDialog,
      dialogRect,
      containerRect,
      dialogZIndex: drawerDialog ? window.getComputedStyle(drawerDialog).zIndex : null,
      bodyOverflow: window.getComputedStyle(document.body).overflow,
      isStickyBarHiddenOrCovered: !stickyBar || window.getComputedStyle(stickyBar).display === 'none' || (dialogRect && dialogRect.top === 0),
    };
  });
  console.log('Cart Drawer Open State:', JSON.stringify(cartDrawerStyles, null, 2));

  await page.screenshot({
    path: path.join(outputDir, '05-cart-drawer-open-390x844.png'),
    fullPage: false,
  });

  console.log('--- Step 6: Close Cart Drawer Verification ---');
  // Click close button inside drawer
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label="Close cart"]');
    if (closeBtn) closeBtn.click();
  });
  await page.waitForTimeout(800);

  const closedState = await page.evaluate(() => {
    const drawerDialog = document.querySelector('div[role="dialog"][aria-label="Shopping Bag Drawer"]');
    const nav = document.querySelector('nav[aria-label="Mobile Navigation"]');
    const stickyBar = document.querySelector('.fixed.bottom-14');
    return {
      isDrawerPresent: !!drawerDialog,
      bodyOverflow: window.getComputedStyle(document.body).overflow,
      isNavVisible: nav ? window.getComputedStyle(nav).display !== 'none' : false,
      isStickyBarVisible: stickyBar ? window.getComputedStyle(stickyBar).display !== 'none' : false,
    };
  });
  console.log('Cart Drawer Closed State:', JSON.stringify(closedState, null, 2));

  await page.screenshot({
    path: path.join(outputDir, '06-cart-drawer-closed-390x844.png'),
    fullPage: false,
  });

  console.log('--- Step 7: Cart Page Verification ---');
  // First, add item directly using the product detail page Add to Shopping Bag button (desktop buy box button which is always in DOM)
  await page.evaluate(() => {
    // Find button containing "Add to Shopping Bag"
    const buttons = Array.from(document.querySelectorAll('button'));
    const addBtn = buttons.find(b => b.innerText.includes('Add to Shopping Bag'));
    if (addBtn) addBtn.click();
  });
  await page.waitForTimeout(500);

  // Close the cart drawer that opened after addToCart
  await page.evaluate(() => {
    const closeBtn = document.querySelector('button[aria-label="Close cart"]');
    if (closeBtn) closeBtn.click();
  });
  await page.waitForTimeout(500);

  // Now navigate to /cart
  await page.goto('http://localhost:3000/cart', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);

  const cartPageStyles = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="Mobile Navigation"]');
    const stickyCheckout = document.querySelector('.fixed.bottom-14');
    const navRect = nav ? nav.getBoundingClientRect() : null;
    const checkoutRect = stickyCheckout ? stickyCheckout.getBoundingClientRect() : null;
    return {
      hasNav: !!nav,
      hasStickyCheckout: !!stickyCheckout,
      navRect,
      checkoutRect,
      checkoutZIndex: stickyCheckout ? window.getComputedStyle(stickyCheckout).zIndex : null,
      navZIndex: nav ? window.getComputedStyle(nav).zIndex : null,
      noCollision: checkoutRect && navRect ? checkoutRect.bottom <= navRect.top + 1 : false,
    };
  });
  console.log('Cart Page Styles:', JSON.stringify(cartPageStyles, null, 2));

  await page.screenshot({
    path: path.join(outputDir, '07-cart-page-390x844.png'),
    fullPage: false,
  });

  await browser.close();
  console.log('ALL 7 VERIFICATION STEPS COMPLETED SUCCESSFULLY!');
}

runMobileVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
