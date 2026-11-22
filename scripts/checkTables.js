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

async function inspectSchema() {
  const token = env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch('https://kqoqdxoicqxulefnruvn.supabase.co/rest/v1/', {
    headers: {
      'apikey': token,
      'Authorization': 'Bearer ' + token
    }
  });
  const data = await res.json();
  const tables = Object.keys(data.definitions || {});
  console.log('Tables detected in schema:', tables);
}

inspectSchema().catch(console.error);
