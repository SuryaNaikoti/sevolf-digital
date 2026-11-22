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

async function inspectDbSchema() {
  const token = env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
    headers: {
      'apikey': token,
      'Authorization': `Bearer ${token}`
    }
  });
  const data = await res.json();
  const defs = data.definitions;

  const targetTables = [
    'products',
    'product_categories',
    'product_collections',
    'collection_products',
    'product_media',
    'product_prices',
    'digital_assets'
  ];

  for (const t of targetTables) {
    console.log(`\n=================== TABLE: ${t} ===================`);
    const def = defs[t];
    if (!def) {
      console.log(`Table ${t} not found in OpenAPI definitions.`);
      continue;
    }
    console.log('Required properties:', def.required || []);
    console.log('Properties & types:');
    for (const [propName, propDef] of Object.entries(def.properties || {})) {
      console.log(`  - ${propName}: ${propDef.type} ${propDef.format ? `(${propDef.format})` : ''} ${propDef.default !== undefined ? `[default: ${propDef.default}]` : ''}`);
    }
  }
}

inspectDbSchema().catch(console.error);
