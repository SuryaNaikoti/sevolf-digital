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

async function testStorageOps() {
  const testData = Buffer.from('SEVOLF DIGITAL SECURE ASSET CONTENT');
  const { data: uploadData, error: upErr } = await supabase.storage
    .from('digital-products')
    .upload('test/sample.pdf', testData, { contentType: 'application/pdf', upsert: true });
  console.log('Upload result:', { uploadData, upErr: upErr ? upErr.message : null });

  // Try creating signed URL (short-lived, 60 seconds)
  const { data: signedData, error: signErr } = await supabase.storage
    .from('digital-products')
    .createSignedUrl('test/sample.pdf', 60);
  console.log('Signed URL created:', { hasUrl: !!signedData?.signedUrl, signErr: signErr ? signErr.message : null });

  // Also test downloading via anon client without signing (MUST FAIL because it's private)
  const anonSupabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data: publicUrlData } = anonSupabase.storage.from('digital-products').getPublicUrl('test/sample.pdf');
  console.log('Public URL generated for private bucket:', publicUrlData.publicUrl);
  
  const pubFetch = await fetch(publicUrlData.publicUrl);
  console.log('Direct public access HTTP status (should be 400/404/403):', pubFetch.status);

  // Clean up test file
  await supabase.storage.from('digital-products').remove(['test/sample.pdf']);
  console.log('Cleaned up test file from storage');
}

testStorageOps().catch(console.error);
