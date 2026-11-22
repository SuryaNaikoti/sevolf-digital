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

async function verifyPhase1C() {
  const token = env.SUPABASE_SERVICE_ROLE_KEY;
  const baseUrl = env.NEXT_PUBLIC_SUPABASE_URL || 'https://kqoqdxoicqxulefnruvn.supabase.co';

  console.log('=== SEVOLF PHASE 1C POST-MIGRATION VERIFICATION ===\n');

  // 1. Check OpenAPI definition for newly added tables & columns
  const res = await fetch(`${baseUrl}/rest/v1/`, {
    headers: {
      'apikey': token,
      'Authorization': 'Bearer ' + token
    }
  });
  const data = await res.json();
  const tables = Object.keys(data.definitions || {});
  
  const expectedTables = [
    'payment_attempts',
    'refunds',
    'download_claims',
    'order_delivery_outbox'
  ];

  console.log('--- 1. Table Verification ---');
  for (const tbl of expectedTables) {
    const exists = tables.includes(tbl);
    console.log(`Table [${tbl}]: ${exists ? 'PRESENT' : 'MISSING'}`);
  }

  console.log('\n--- 2. Column Modifications ---');
  const ordersDef = data.definitions?.orders?.properties || {};
  console.log('orders.is_sandbox:', ordersDef.is_sandbox ? 'PRESENT' : 'MISSING');

  const assetsDef = data.definitions?.digital_assets?.properties || {};
  console.log('digital_assets.is_active:', assetsDef.is_active ? 'PRESENT' : 'MISSING');

  const paymentsDef = data.definitions?.payments?.properties || {};
  console.log('payments.payment_attempt_id:', paymentsDef.payment_attempt_id ? 'PRESENT' : 'MISSING');

  const entitlementsDef = data.definitions?.download_entitlements?.properties || {};
  console.log('download_entitlements.token_hash:', entitlementsDef.token_hash ? 'PRESENT' : 'MISSING');
  console.log('download_entitlements.is_revoked:', entitlementsDef.is_revoked ? 'PRESENT' : 'MISSING');

  // 2. Check 8 RPC Functions
  console.log('\n--- 3. RPC Functions Verification ---');
  const expectedRPCs = [
    'process_order_capture',
    'claim_download_entitlement',
    'finalize_download_claim',
    'fail_download_claim',
    'process_order_refund',
    'claim_pending_delivery_jobs',
    'complete_delivery_job',
    'fail_delivery_job'
  ];

  for (const rpcName of expectedRPCs) {
    // Calling RPC with empty/invalid payload to verify existence (should return 400 or function response, not 404)
    const rpcRes = await fetch(`${baseUrl}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: {
        'apikey': token,
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });
    
    if (rpcRes.status === 404) {
      console.log(`RPC [${rpcName}]: NOT FOUND (404)`);
    } else {
      console.log(`RPC [${rpcName}]: INSTALLED & ACCESSIBLE (Status ${rpcRes.status})`);
    }
  }

  // 3. Check Data Integrity (zero modification to existing products/coupons/orders)
  console.log('\n--- 4. Existing Data Invariant Checks ---');
  const countTable = async (tbl) => {
    const r = await fetch(`${baseUrl}/rest/v1/${tbl}?select=count`, {
      headers: {
        'apikey': token,
        'Authorization': 'Bearer ' + token,
        'Range': '0-0',
        'Prefer': 'count=exact'
      }
    });
    return r.headers.get('content-range');
  };

  const prodCount = await countTable('products');
  const couponCount = await countTable('coupons');
  const orderCount = await countTable('orders');
  console.log(`products content-range: ${prodCount}`);
  console.log(`coupons content-range:  ${couponCount}`);
  console.log(`orders content-range:   ${orderCount}`);
}

verifyPhase1C().catch(console.error);
