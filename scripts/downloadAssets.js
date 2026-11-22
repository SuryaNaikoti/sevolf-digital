const fs = require('fs');
const https = require('https');
const path = require('path');

const downloads = [
  // Collections
  { url: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/collections/home-living/cover.jpg' },
  { url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/collections/sevolf-little/cover.jpg' },
  { url: 'https://images.unsplash.com/photo-1507842229451-7f01be8860ee?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/collections/productivity/cover.jpg' },
  { url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/collections/business/cover.jpg' },

  // 1. Home Reset Kit
  { url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/products/home-reset-kit/cover.jpg' },
  { url: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=1000&q=80', dest: 'public/images/products/home-reset-kit/interior-1.jpg' },
  { url: 'https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1000&q=80', dest: 'public/images/products/home-reset-kit/interior-2.jpg' },
  { url: 'https://images.unsplash.com/photo-1598928506311-c55ded91a20c?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/products/home-reset-kit/spotlight-mockup.jpg' },

  // 2. Mitthu's Fun Learning Book
  { url: 'https://images.unsplash.com/photo-1588072432836-e10032774350?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/products/mitthus-fun-learning/cover.jpg' },
  { url: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1000&q=80', dest: 'public/images/products/mitthus-fun-learning/sample-pages.jpg' },
  { url: 'https://images.unsplash.com/photo-1516627145497-ae6968895b74?auto=format&fit=crop&w=1000&q=80', dest: 'public/images/products/mitthus-fun-learning/flashcards.jpg' },

  // 3. Productivity Toolkit
  { url: 'https://images.unsplash.com/photo-1517842645767-c639042777db?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/products/productivity-toolkit/cover.jpg' },
  { url: 'https://images.unsplash.com/photo-1499750310107-5fef28a66643?auto=format&fit=crop&w=1000&q=80', dest: 'public/images/products/productivity-toolkit/planner-screen.jpg' },
  { url: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?auto=format&fit=crop&w=1000&q=80', dest: 'public/images/products/productivity-toolkit/time-blocking.jpg' },

  // 4. Founder's Operating Suite
  { url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/products/founders-operating-suite/cover.jpg' },
  { url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1000&q=80', dest: 'public/images/products/founders-operating-suite/financial-model.jpg' },
  { url: 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1000&q=80', dest: 'public/images/products/founders-operating-suite/pitch-deck.jpg' },

  // 5. Mindful Living Bundle & Curiosity Nature
  { url: 'https://images.unsplash.com/photo-1507089947368-19c1da9775ae?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/products/mindful-living-bundle/cover.jpg' },
  { url: 'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=1200&q=80', dest: 'public/images/products/curiosity-nature/cover.jpg' },

  // Editorial
  { url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80', dest: 'public/images/editorial/philosophy-interior.jpg' },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed ${url}: ${res.statusCode}`));
      }
      const dir = path.dirname(dest);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

(async () => {
  for (const item of downloads) {
    try {
      console.log(`Downloading ${item.dest}...`);
      await download(item.url, item.dest);
    } catch (e) {
      console.error(e.message);
    }
  }
  console.log('Finished all downloads.');
})();
