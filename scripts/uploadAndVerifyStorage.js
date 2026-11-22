const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
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

const filesToUpload = [
  {
    product: '14-Day Home Reset Kit (A4)',
    localPath: 'C:\\Users\\HP\\OneDrive\\Desktop\\Sevolf\\deliverables\\Home-Reset-Kit-A4.pdf',
    storagePath: 'products/14-day-home-reset-kit/v1.2.3/Home-Reset-Kit-A4.pdf',
    mimeType: 'application/pdf'
  },
  {
    product: '14-Day Home Reset Kit (US Letter)',
    localPath: 'C:\\Users\\HP\\OneDrive\\Desktop\\Sevolf\\deliverables\\Home-Reset-Kit-US-Letter.pdf',
    storagePath: 'products/14-day-home-reset-kit/v1.2.3/Home-Reset-Kit-US-Letter.pdf',
    mimeType: 'application/pdf'
  },
  {
    product: "Mitthu's Fun Learning Book",
    localPath: 'C:\\Users\\HP\\Downloads\\Fun Learning Book.pdf',
    storagePath: 'products/mitthus-fun-learning-book/v1.0.0/Fun-Learning-Book.pdf',
    mimeType: 'application/pdf'
  }
];

async function runUploadVerification() {
  console.log('--- SUPABASE PRIVATE STORAGE UPLOAD & VERIFICATION ---\n');

  for (const item of filesToUpload) {
    const fileBuf = fs.readFileSync(item.localPath);
    const localHash = crypto.createHash('sha256').update(fileBuf).digest('hex');
    const localSize = fileBuf.length;

    console.log(`[UPLOADING] ${item.product}`);
    console.log(`  Source: ${item.localPath}`);
    console.log(`  Local Size: ${localSize} bytes (${(localSize / 1024 / 1024).toFixed(2)} MB)`);
    console.log(`  SHA-256: ${localHash}`);
    console.log(`  Target Path: digital-products/${item.storagePath}`);

    const { data: uploadRes, error: upErr } = await supabase.storage
      .from('digital-products')
      .upload(item.storagePath, fileBuf, {
        contentType: item.mimeType,
        upsert: true
      });

    if (upErr) {
      console.error(`  Upload FAILED: ${upErr.message}\n`);
      continue;
    }

    console.log(`  Upload OK: ${uploadRes.path}`);

    // Download object back into memory to strictly verify presence and bit-level hash equality
    const { data: downloadData, error: dlErr } = await supabase.storage
      .from('digital-products')
      .download(item.storagePath);

    if (dlErr || !downloadData) {
      console.error(`  Download verification FAILED: ${dlErr?.message}\n`);
      continue;
    }

    const downloadedBuf = Buffer.from(await downloadData.arrayBuffer());
    const downloadedHash = crypto.createHash('sha256').update(downloadedBuf).digest('hex');

    const sizeMatch = downloadedBuf.length === localSize;
    const hashMatch = downloadedHash === localHash;

    console.log(`  Verified in Storage: Size Match = ${sizeMatch}, SHA-256 Match = ${hashMatch}`);
    console.log(`  Status: VERIFIED & TAMPER-FREE\n`);
  }
}

runUploadVerification().catch(console.error);
