const fs = require('fs');
const crypto = require('crypto');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

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

function verifyRazorpayWebhookSignature(rawBody, signature, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

async function capturePaymentAndFulfillOrder(adminClient, input) {
  const { data: orderItems, error: itemsError } = await adminClient
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

  if (itemsError || !orderItems || orderItems.length === 0) {
    return { success: false, alreadyProcessed: false, message: 'No items found' };
  }

  const deliveryPayloads = [];
  for (const item of orderItems) {
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
  };
}

async function runStage3Verification() {
  console.log('====================================================');
  console.log('SEVOLF STAGE 3: AUTOMATED WORKFLOW VERIFICATION SUITE');
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

  // 1. Cryptographic Security Engine
  console.log('--- 1. Cryptographic Security Engine ---');
  const sampleToken = generateBearerToken();
  const tokenHash = hashToken(sampleToken);
  const encrypted = encryptTokenPayload(sampleToken);
  const decrypted = decryptTokenPayload(encrypted);
  assert(sampleToken.length === 64, 'Bearer token is 64 hex characters (32 bytes)');
  assert(tokenHash.length === 64, 'SHA-256 hash digest is 64 hex characters');
  assert(decrypted === sampleToken, 'AES-256-GCM encryption & decryption round-trip matches exactly');

  // 2. Razorpay Signature Verification
  console.log('\n--- 2. Razorpay Signature & Webhook Verification ---');
  const secret = 'rzp_test_secret_key_12345';
  const orderId = 'order_test_98765';
  const paymentId = 'pay_test_12345';
  const body = `${orderId}|${paymentId}`;
  const validSignature = crypto.createHmac('sha256', secret).update(body).digest('hex');
  const invalidSignature = 'invalid_tampered_signature_hex';

  assert(
    verifyRazorpaySignature(orderId, paymentId, validSignature, secret) === true,
    'Valid payment signature passes HMAC-SHA256 check'
  );
  assert(
    verifyRazorpaySignature(orderId, paymentId, invalidSignature, secret) === false,
    'Tampered payment signature correctly fails closed'
  );

  const rawWebhook = JSON.stringify({ event: 'payment.captured', id: 'evt_123' });
  const validWebhookSig = crypto.createHmac('sha256', secret).update(rawWebhook).digest('hex');
  assert(
    verifyRazorpayWebhookSignature(rawWebhook, validWebhookSig, secret) === true,
    'Valid webhook payload passes header signature verification'
  );
  assert(
    verifyRazorpayWebhookSignature(rawWebhook, invalidSignature, secret) === false,
    'Tampered webhook payload rejected'
  );

  // 3. Database Order Creation & Payment Lifecycle
  console.log('\n--- 3. Database Order & Fulfilment Workflow ---');
  const adminClient = createClient(supabaseUrl, serviceKey);

  // Use the canonical product in the database that has active digital assets attached
  const { data: prod } = await adminClient
    .from('products')
    .select('id, name')
    .eq('id', '284fc059-3be0-44a2-969f-899ea23ead2a')
    .single();

  assert(Boolean(prod?.id), `Resolved canonical store product for test: ${prod?.name}`);

  const testOrderNumber = `TEST-${Date.now().toString().slice(-6)}`;
  const testEmail = `patron-${Date.now()}@example.com`;

  const { data: order, error: orderErr } = await adminClient
    .from('orders')
    .insert({
      order_number: testOrderNumber,
      customer_email: testEmail,
      customer_name: 'Test Patron',
      currency: 'INR',
      subtotal: 499,
      discount: 0,
      total_amount: 499,
      status: 'pending',
      payment_method: 'razorpay',
      payment_status: 'unpaid',
      is_sandbox: false
    })
    .select('id, order_number')
    .single();

  assert(!orderErr && Boolean(order?.id), `Test order created in DB: ${order?.order_number}`);

  await adminClient.from('order_items').insert({
    order_id: order.id,
    product_id: prod.id,
    product_name: prod.name,
    unit_price: 499,
    quantity: 1,
    total_price: 499
  });

  const gwOrderId = `order_sim_${Date.now()}`;

  // Pre-create payment attempt (as done in /api/checkout)
  await adminClient.from('payment_attempts').insert({
    order_id: order.id,
    gateway: 'razorpay',
    gateway_order_id: gwOrderId,
    amount: 499,
    currency: 'INR',
    status: 'created'
  });

  const testTxn = `pay_sim_${Date.now()}`;
  const capture1 = await capturePaymentAndFulfillOrder(adminClient, {
    orderId: order.id,
    gatewayTransactionId: testTxn,
    gatewayOrderId: gwOrderId,
    amount: 499,
    currency: 'INR',
    rawPayload: { test: true }
  });

  assert(capture1.success === true, `First capture successful (entitlements: ${capture1.entitlementsCreated})`);
  assert(capture1.alreadyProcessed === false, 'First capture marked as new processing');

  const { data: updatedOrder } = await adminClient
    .from('orders')
    .select('status, payment_status')
    .eq('id', order.id)
    .single();

  assert(updatedOrder.status === 'paid', 'Order status marked "paid" in database');
  assert(updatedOrder.payment_status === 'captured', 'Payment status marked "captured" in database');

  // 4. Idempotency & Duplicate Prevention
  console.log('\n--- 4. Idempotency & Duplicate Prevention ---');
  const capture2 = await capturePaymentAndFulfillOrder(adminClient, {
    orderId: order.id,
    gatewayTransactionId: testTxn,
    gatewayOrderId: gwOrderId,
    amount: 499,
    currency: 'INR',
    rawPayload: { test: true }
  });

  assert(capture2.success === true, 'Duplicate capture call handled gracefully');
  assert(capture2.alreadyProcessed === true, 'Duplicate capture detected and prevented duplicate fulfillment');

  // 5. Entitlement & Claim Token Lifecycle
  console.log('\n--- 5. Secure Digital Download Token Claims ---');
  const { data: entitlements } = await adminClient
    .from('download_entitlements')
    .select('id, token_hash, download_limit, download_count, is_active')
    .eq('order_id', order.id);

  assert(entitlements.length > 0, `Entitlements generated for order: ${entitlements.length}`);

  const { error: invalidClaimErr } = await adminClient.rpc('claim_download_entitlement', {
    p_raw_token: 'invalid_unauthorized_token_xyz',
    p_idempotency_key: `key-${Date.now()}`
  });

  assert(
    invalidClaimErr && invalidClaimErr.message.includes('ENTITLEMENT_NOT_FOUND'),
    'Unauthorized download attempt rejected with ENTITLEMENT_NOT_FOUND'
  );

  // 6. Test Fixture Teardown
  console.log('\n--- 6. Test Fixture Teardown ---');
  await adminClient.from('download_entitlements').delete().eq('order_id', order.id);
  await adminClient.from('order_delivery_outbox').delete().eq('order_id', order.id);
  await adminClient.from('payment_attempts').delete().eq('order_id', order.id);
  await adminClient.from('order_items').delete().eq('order_id', order.id);
  await adminClient.from('payments').delete().eq('order_id', order.id);
  await adminClient.from('orders').delete().eq('id', order.id);
  console.log('[OK] Cleaned up temporary test order fixtures from database.');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStage3Verification().catch(err => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
