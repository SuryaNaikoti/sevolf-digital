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

async function createStorageBuckets() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const buckets = [
    {
      id: 'product-covers',
      public: true,
      fileSizeLimit: 10485760, // 10MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
    },
    {
      id: 'product-previews',
      public: true,
      fileSizeLimit: 20971520, // 20MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    },
    {
      id: 'digital-products',
      public: false, // strictly private!
      fileSizeLimit: 104857600, // 100MB
      allowedMimeTypes: ['application/pdf', 'application/zip', 'application/octet-stream', 'application/x-zip-compressed']
    },
    {
      id: 'customer-uploads',
      public: false, // strictly private
      fileSizeLimit: 20971520, // 20MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf']
    }
  ];

  for (const b of buckets) {
    console.log(`Checking bucket: ${b.id}...`);
    const { data, error } = await supabase.storage.createBucket(b.id, {
      public: b.public,
      fileSizeLimit: b.fileSizeLimit,
      allowedMimeTypes: b.allowedMimeTypes
    });

    if (error) {
      if (error.message.includes('already exists')) {
        console.log(`Bucket ${b.id} already exists.`);
      } else {
        console.error(`Error creating bucket ${b.id}:`, error.message);
      }
    } else {
      console.log(`Created bucket ${b.id} successfully!`);
    }
  }

  const { data: currentBuckets, error: listErr } = await supabase.storage.listBuckets();
  console.log('Current buckets in project:', currentBuckets ? currentBuckets.map(b => ({ name: b.name, public: b.public })) : listErr);
}

createStorageBuckets().catch(console.error);
