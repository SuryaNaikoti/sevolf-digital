const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const envLines = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of envLines) {
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

async function inspectStorageKeys() {
  console.log('--- INSPECTING ACTUAL OBJECT KEYS IN digital-products ---');

  // Check 14-day home reset kit directory
  const { data: homeFiles, error: homeErr } = await supabase.storage
    .from('digital-products')
    .list('products/14-day-home-reset-kit/v1.2.3');
  console.log('Home Reset Kit v1.2.3 files:', homeFiles, 'Error:', homeErr?.message);

  // Check mitthu directory
  const { data: mitthuFiles, error: mitthuErr } = await supabase.storage
    .from('digital-products')
    .list('products/mitthus-fun-learning-book/v1.0.0');
  console.log('Mitthu v1.0.0 files:', mitthuFiles, 'Error:', mitthuErr?.message);

  // Test createSignedUrl with bucket-relative path
  const testPath = 'products/14-day-home-reset-kit/v1.2.3/Home-Reset-Kit-A4.pdf';
  const { data: signedRes, error: signErr } = await supabase.storage
    .from('digital-products')
    .createSignedUrl(testPath, 60);

  console.log('\nTest Signed URL for "' + testPath + '":');
  console.log('Success:', !!signedRes?.signedUrl, 'Error:', signErr?.message);
}

inspectStorageKeys().catch(console.error);
