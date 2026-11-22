const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local manually
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

async function testConnection() {
  console.log('Target URL:', env.NEXT_PUBLIC_SUPABASE_URL);
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  
  try {
    const { data, error } = await supabase.from('products').select('*').limit(1);
    console.log('Query products table result:', { 
      error: error ? error.message : null, 
      code: error ? error.code : null, 
      dataCount: data ? data.length : 0 
    });
  } catch (e) {
    console.log('Exception querying products:', e.message);
  }

  try {
    const { data: buckets, error: bError } = await supabase.storage.listBuckets();
    console.log('Storage listBuckets result:', { 
      error: bError ? bError.message : null, 
      buckets: buckets ? buckets.map(b => b.name) : [] 
    });
  } catch (e) {
    console.log('Exception listing buckets:', e.message);
  }
}

testConnection();
