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

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function checkStorageContents() {
  const buckets = ['product-covers', 'product-previews', 'digital-products', 'customer-uploads'];
  for (const b of buckets) {
    const { data, error } = await supabase.storage.from(b).list();
    console.log(`Bucket ${b}: ${data ? data.length : 0} objects. Error: ${error?.message || 'none'}`);
    if (data && data.length > 0) {
      console.log(` - Items in ${b}:`, data.map(item => item.name));
    }
  }
}

checkStorageContents().catch(console.error);
