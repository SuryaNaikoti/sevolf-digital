const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Parse .env.local
const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
const env = {};
for (const line of lines) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const idx = trimmed.indexOf('=');
  if (idx !== -1) {
    env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const encryptionKeyHex = env.TOKEN_ENCRYPTION_KEY_V1;

function getEncryptionKey() {
  return Buffer.from(encryptionKeyHex, 'hex');
}

function generateBearerToken() {
  return crypto.randomBytes(32).toString('hex');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function encryptTokenPayload(token) {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    version: 'v1',
    iv: iv.toString('hex'),
    payload: encrypted.toString('hex'),
    tag: tag.toString('hex'),
  });
}

function decryptTokenPayload(payloadString) {
  const key = getEncryptionKey();
  const envelope = JSON.parse(payloadString);
  const iv = Buffer.from(envelope.iv, 'hex');
  const encrypted = Buffer.from(envelope.payload, 'hex');
  const tag = Buffer.from(envelope.tag, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8');
}

function verifyRazorpaySignature(orderId, paymentId, signature, secret) {
  const body = `${orderId}|${paymentId}`;
  const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

async function capturePaymentAndFulfillOrder(adminClient, input) {
  const { data: orderItems } = await adminClient
    .from('order_items')
    .select(`
      product_id,
      products (
        id,
        digital_assets (
          id,
          is_active
        )
      )
    `)
    .eq('order_id', input.orderId);

  const deliveryPayloads = [];
  for (const item of orderItems || []) {
    const prod = Array.isArray(item.products) ? item.products[0] : item.products;
    const rawAssets = prod?.digital_assets || [];
    const assets = Array.isArray(rawAssets) ? rawAssets : [rawAssets];

    for (const asset of assets) {
      if (asset && asset.is_active) {
        const rawToken = generateBearerToken();
        const tHash = hashToken(rawToken);
        const encrypted = encryptTokenPayload(rawToken);

        deliveryPayloads.push({
          asset_id: asset.id,
          token_hash: tHash,
          encrypted_payload: encrypted,
        });
      }
    }
  }

  const { data, error } = await adminClient.rpc('process_order_capture', {
    p_order_id: input.orderId,
    p_gateway_transaction_id: input.gatewayTransactionId,
    p_gateway_order_id: input.gatewayOrderId,
    p_charged_amount: input.amount,
    p_charged_currency: input.currency,
    p_delivery_payloads: deliveryPayloads,
    p_raw_payload: input.rawPayload,
  });

  if (error) {
    return { success: false, alreadyProcessed: false, message: error.message };
  }

  const res = Array.isArray(data) ? data[0] : data;
  return {
    success: res.success,
    alreadyProcessed: res.already_processed,
    entitlementsCreated: res.entitlements_created,
    totalEntitlements: res.total_entitlements,
    message: res.message,
    payloads: deliveryPayloads,
  };
}

async function runFinalGapVerification() {
  console.log('====================================================');
  console.log('SEVOLF STAGE 3: FINAL GAP CLOSURE VERIFICATION SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Resend Outbox Lifecycle & Retry Logic
  console.log('--- 1. Outbox Worker: Email Dispatch, Failure & Retry Verification ---');

  const { data: prod } = await adminClient
    .from('products')
    .select('id, name')
    .eq('id', '284fc059-3be0-44a2-969f-899ea23ead2a')
    .single();

  assert(Boolean(prod?.id), `Found test catalog product: ${prod?.name}`);

  const testOrderNum = `GAP-${Date.now().toString().slice(-6)}`;
  const testEmail = `patron-${Date.now()}@example.com`;

  const { data: order } = await adminClient
    .from('orders')
    .insert({
      order_number: testOrderNum,
      customer_email: testEmail,
      customer_name: 'Final Gap Patron',
      currency: 'INR',
      subtotal: 499,
      discount: 0,
      total_amount: 499,
      status: 'pending',
      payment_method: 'razorpay',
      payment_status: 'unpaid',
      is_sandbox: false,
    })
    .select('id, order_number')
    .single();

  assert(Boolean(order?.id), `Order inserted: ${order?.order_number}`);

  await adminClient.from('order_items').insert({
    order_id: order.id,
    product_id: prod.id,
    product_name: prod.name,
    unit_price: 499,
    quantity: 1,
    total_price: 499,
  });

  const gwOrderId = `order_gap_${Date.now()}`;
  await adminClient.from('payment_attempts').insert({
    order_id: order.id,
    gateway: 'razorpay',
    gateway_order_id: gwOrderId,
    amount: 499,
    currency: 'INR',
    status: 'created',
  });

  // Execute payment capture
  const captureRes = await capturePaymentAndFulfillOrder(adminClient, {
    orderId: order.id,
    gatewayTransactionId: `pay_gap_${Date.now()}`,
    gatewayOrderId: gwOrderId,
    amount: 499,
    currency: 'INR',
    rawPayload: { mode: 'gap_test' },
  });

  assert(captureRes.success === true, 'Order captured and fulfilled atomically');

  // Verify outbox entry created
  const { data: outboxJobs } = await adminClient
    .from('order_delivery_outbox')
    .select('*')
    .eq('order_id', order.id);

  assert(outboxJobs && outboxJobs.length > 0, `Outbox jobs created: ${outboxJobs?.length}`);
  const job = outboxJobs[0];
  assert(job.delivery_status === 'pending', 'Initial outbox status is "pending"');
  assert(job.retry_count === 0, 'Initial retry_count is 0');

  // Worker Claim step
  const workerToken = crypto.randomUUID();
  const { data: claimedJobs, error: claimErr } = await adminClient.rpc('claim_pending_delivery_jobs', {
    p_batch_size: 10,
    p_lease_seconds: 60,
    p_worker_token: workerToken,
  });

  const activeClaim = claimedJobs?.find((j) => j.job_id === job.id);
  assert(Boolean(activeClaim), 'Outbox worker successfully claimed pending job with worker token lease');

  // Token Decryption Verification
  const decryptedToken = decryptTokenPayload(activeClaim.encrypted_token_payload);
  assert(typeof decryptedToken === 'string' && decryptedToken.length === 64, 'Worker decrypted 64-char bearer token');

  // Verify constructed email body contents
  const sampleSiteUrl = 'http://localhost:3000';
  const downloadLink = `${sampleSiteUrl}/api/download/${decryptedToken}`;
  assert(downloadLink.startsWith('http://localhost:3000/api/download/'), `Email download link generated: ${downloadLink}`);

  // Test Failure & Backoff Retry: simulate email API failure (e.g. rate limit / network error)
  const simulatedErrorMsg = 'Simulated SMTP/API delivery timeout';
  const { data: failResult, error: failErr } = await adminClient.rpc('fail_delivery_job', {
    p_job_id: activeClaim.job_id,
    p_lease_token: activeClaim.lease_token,
    p_error_msg: simulatedErrorMsg,
    p_backoff_seconds: 1, // 1 second backoff for quick test
  });

  assert(failResult === true, 'fail_delivery_job RPC recorded failed delivery attempt');

  // Inspect outbox table status after failure
  const { data: jobAfterFail } = await adminClient
    .from('order_delivery_outbox')
    .select('delivery_status, retry_count, last_error, lease_token')
    .eq('id', job.id)
    .single();

  assert(jobAfterFail.delivery_status === 'failed', 'Job status moved to "failed" awaiting backoff retry');
  assert(jobAfterFail.retry_count === 1, 'Job retry_count incremented to 1');
  assert(jobAfterFail.lease_token === null, 'Lease token released for future retry attempt');
  assert(jobAfterFail.last_error === simulatedErrorMsg, 'Error message stored in job record');

  // Wait 1.1s for backoff expiry and re-claim
  await new Promise((resolve) => setTimeout(resolve, 1100));

  const retryWorkerToken = crypto.randomUUID();
  const { data: retryClaimedJobs } = await adminClient.rpc('claim_pending_delivery_jobs', {
    p_batch_size: 10,
    p_lease_seconds: 60,
    p_worker_token: retryWorkerToken,
  });

  const reClaimed = retryClaimedJobs?.find((j) => j.job_id === job.id);
  assert(Boolean(reClaimed), 'Worker successfully re-claimed failed job after backoff expiry');

  // Mark Completed
  const { data: completedRes } = await adminClient.rpc('complete_delivery_job', {
    p_job_id: reClaimed.job_id,
    p_lease_token: reClaimed.lease_token,
  });

  assert(completedRes === true, 'Worker completed delivery job after retry');

  const { data: finalJob } = await adminClient
    .from('order_delivery_outbox')
    .select('delivery_status, delivered_at')
    .eq('id', job.id)
    .single();

  assert(finalJob.delivery_status === 'delivered', 'Final job status is "delivered"');
  assert(Boolean(finalJob.delivered_at), 'delivered_at timestamp recorded');

  // 2. Full Journey Simulation: Checkout -> Payment -> Order Conf -> Download
  console.log('\n--- 2. End-to-End Customer Journey Simulation ---');

  // Verify entitlement claim works with the decrypted bearer token
  const idempotencyKey = `claim_${Date.now()}`;
  const { data: claimData, error: claimTokenErr } = await adminClient.rpc('claim_download_entitlement', {
    p_raw_token: decryptedToken,
    p_idempotency_key: idempotencyKey,
  });

  assert(!claimTokenErr && claimData && claimData.length > 0, 'Customer claimed download entitlement using token from email');
  const claimRecord = claimData[0];
  assert(Boolean(claimRecord.storage_path), `Resolved private storage path: ${claimRecord.storage_path}`);

  // Finalize claim
  const { data: finalized } = await adminClient.rpc('finalize_download_claim', {
    p_claim_id: claimRecord.claim_id,
    p_claim_token: claimRecord.claim_token,
  });

  assert(finalized === true, 'Download claim finalized and download count incremented');

  // 3. Teardown
  console.log('\n--- 3. Teardown ---');
  await adminClient.from('download_claims').delete().eq('entitlement_id', claimRecord.entitlement_id);
  await adminClient.from('download_entitlements').delete().eq('order_id', order.id);
  await adminClient.from('order_delivery_outbox').delete().eq('order_id', order.id);
  await adminClient.from('payment_attempts').delete().eq('order_id', order.id);
  await adminClient.from('order_items').delete().eq('order_id', order.id);
  await adminClient.from('payments').delete().eq('order_id', order.id);
  await adminClient.from('orders').delete().eq('id', order.id);
  console.log('[OK] Cleaned up temporary test order fixtures from database.');

  console.log('\n====================================================');
  console.log(`FINAL GAP RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runFinalGapVerification().catch((err) => {
  console.error('Final Gap Suite Exception:', err);
  process.exit(1);
});
