const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

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

async function createDigitalProductsBucket() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  console.log('Attempting to create digital-products bucket with 50MB (52428800 bytes)...');
  const { data, error } = await supabase.storage.createBucket('digital-products', {
    public: false,
    fileSizeLimit: 52428800, // 50MB (Supabase free tier max is 50MB)
    allowedMimeTypes: ['application/pdf', 'application/zip', 'application/octet-stream', 'application/x-zip-compressed']
  });

  if (error) {
    console.log('50MB error:', error.message);
    console.log('Attempting without explicit fileSizeLimit...');
    const res2 = await supabase.storage.createBucket('digital-products', {
      public: false
    });
    console.log('Without limit result:', res2);
  } else {
    console.log('Successfully created digital-products bucket with 50MB limit!');
  }

  const { data: currentBuckets } = await supabase.storage.listBuckets();
  console.log('Current buckets:', currentBuckets ? currentBuckets.map(b => ({ name: b.name, public: b.public, fileSizeLimit: b.file_size_limit })) : []);
}

createDigitalProductsBucket().catch(console.error);
