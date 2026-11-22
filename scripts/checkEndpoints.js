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

async function checkEndpoints() {
  const token = env.SUPABASE_SERVICE_ROLE_KEY;
  const endpoints = [
    '/pg/query',
    '/database/query',
    '/query',
    '/sql'
  ];

  for (const ep of endpoints) {
    try {
      const res = await fetch(`https://kqoqdxoicqxulefnruvn.supabase.co${ep}`, {
        method: 'POST',
        headers: {
          'apikey': token,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: 'SELECT 1;' })
      });
      console.log(`Endpoint ${ep} status:`, res.status);
    } catch (e) {
      console.log(`Endpoint ${ep} error:`, e.message);
    }
  }
}

checkEndpoints().catch(console.error);
