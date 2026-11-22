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

async function verifyLiveDatabase() {
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const anonClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  console.log('--- 1. Querying categories seeded in DB ---');
  const { data: cats, error: catErr } = await supabase.from('product_categories').select('id, name, slug');
  console.log('Categories seeded:', cats, 'Error:', catErr?.message);

  console.log('--- 2. Querying collections seeded in DB ---');
  const { data: cols, error: colErr } = await supabase.from('product_collections').select('id, name, slug');
  console.log('Collections seeded:', cols, 'Error:', colErr?.message);

  console.log('--- 3. Querying roles in DB ---');
  const { data: roles, error: roleErr } = await supabase.from('roles').select('id, name');
  console.log('Roles seeded:', roles, 'Error:', roleErr?.message);

  console.log('--- 4. Testing RLS with Anon client on products ---');
  const { data: anonProds, error: anonErr } = await anonClient.from('products').select('*');
  console.log('Anon query on products count:', anonProds?.length, 'Error:', anonErr?.message);

  console.log('--- 5. Testing RLS with Anon client on payments (MUST BE BLOCKED) ---');
  const { data: anonPay, error: payErr } = await anonClient.from('payments').select('*');
  console.log('Anon query on payments count:', anonPay?.length, 'Error:', payErr?.message);
}

verifyLiveDatabase().catch(console.error);
