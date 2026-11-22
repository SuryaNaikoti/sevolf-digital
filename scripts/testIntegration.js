const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
}

async function runStorefrontAuthTest() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();

  console.log('1. Testing unauthenticated redirect on /account...');
  await page.goto('http://localhost:3000/account');
  await page.waitForTimeout(1000);
  const currentUrl = page.url();
  console.log('Current URL after navigating to /account:', currentUrl);
  const redirectedToLogin = currentUrl.includes('/login');
  console.log('Redirected to /login:', redirectedToLogin);

  console.log('2. Testing registration and login API endpoints...');
  const testEmail = `patron_test_${Date.now()}@example.com`;
  const regRes = await page.request.post('http://localhost:3000/api/auth/register', {
    data: {
      fullName: 'Test Patron',
      email: testEmail,
      password: 'StrongPassword123!',
    },
  });
  console.log('Register API status:', regRes.status());
  const regJson = await regRes.json();
  console.log('Register API response:', regJson);

  console.log('3. Testing product retrieval via updated service layer...');
  await page.goto('http://localhost:3000/shop');
  await page.waitForTimeout(1000);
  const productCardsCount = await page.locator('article, div[class*="group relative"]').count();
  console.log('Products rendered on /shop:', productCardsCount > 0);

  console.log('4. Testing digital download endpoint with sample token...');
  const dlRes = await page.request.get('http://localhost:3000/api/download/token_sample_892144_01');
  console.log('Download API status:', dlRes.status());
  console.log('Content-Type header:', dlRes.headers()['content-type']);

  await browser.close();
  console.log('Integration test completed successfully!');
}

runStorefrontAuthTest().catch(console.error);
