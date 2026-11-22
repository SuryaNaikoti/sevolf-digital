const http = require('http');

function get(path) {
  return new Promise((resolve, reject) => {
    http.get('http://localhost:3000' + path, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    }).on('error', reject);
  });
}

(async () => {
  console.log('--- 1. Testing Homepage Card Link Attributes ---');
  const home = await get('/');
  const homeMatches = [...home.body.matchAll(/href="(\/products\/[^"]+)"/g)].map(m => m[1]);
  console.log('Homepage product links found:', Array.from(new Set(homeMatches)));

  console.log('\n--- 2. Testing Shop Page Card Link Attributes ---');
  const shop = await get('/shop');
  const shopMatches = [...shop.body.matchAll(/href="(\/products\/[^"]+)"/g)].map(m => m[1]);
  console.log('Shop page product links found:', Array.from(new Set(shopMatches)));

  console.log('\n--- 3. Testing Product Detail Page Renderings ---');
  const slugs = [
    '14-day-home-reset-kit',
    'mitthus-fun-learning-book',
    'productivity-toolkit',
    'founders-operating-suite',
    'complete-mindful-living-bundle',
    'curiosity-nature-science-explorers'
  ];

  for (const s of slugs) {
    const res = await get('/products/' + s);
    const hasH1 = res.body.includes('<h1');
    const hasCartCTA = res.body.includes('Add to Shopping Bag');
    const hasTabs = res.body.includes('Overview &amp; Benefits') || res.body.includes('Overview');
    console.log(`Product /products/${s}: Status ${res.status} | H1: ${hasH1} | CartCTA: ${hasCartCTA} | Tabs: ${hasTabs}`);
  }

  console.log('\n--- 4. Testing 404 Response and Branded Not Found ---');
  const notFound = await get('/products/invalid-slug-test');
  const has404Heading = notFound.body.includes('This digital work could not be located');
  const hasReturnLink = notFound.body.includes('Return to Catalogue');
  console.log(`404 check: Status ${notFound.status} | Branded Heading: ${has404Heading} | ReturnLink: ${hasReturnLink}`);
})();
