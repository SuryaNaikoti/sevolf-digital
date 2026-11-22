import {
  generateBearerToken,
  hashToken,
  encryptTokenPayload,
  decryptTokenPayload,
  getEncryptionKey,
} from "../src/services/security/tokenEncryption";
import {
  verifyRazorpaySignature,
  verifyRazorpayWebhookSignature,
} from "../src/services/payments/paymentCaptureService";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passedCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failedCount++;
  }
}

console.log("=== RUNNING CORRECTED UNIT & SECURITY TEST SUITE ===\n");

// 1. Bearer Token Generation & Entropy
const token1 = generateBearerToken();
const token2 = generateBearerToken();
assert(token1.length === 64, "TC-CRYPTO-01: Token 1 has 64 hex characters (32 bytes)");
assert(token2.length === 64, "TC-CRYPTO-02: Token 2 has 64 hex characters (32 bytes)");
assert(token1 !== token2, "TC-CRYPTO-03: Tokens generated consecutively are unique");

// 2. SHA-256 Digest Consistency
const hash1 = hashToken(token1);
const hash2 = hashToken(token1);
const hashDiff = hashToken(token2);
assert(hash1.length === 64, "TC-CRYPTO-04: Hash output has 64 hex characters");
assert(hash1 === hash2, "TC-CRYPTO-05: Hash computation is deterministic");
assert(hash1 !== hashDiff, "TC-CRYPTO-06: Distinct tokens yield distinct hashes");

// 3. Environment Key Validation (Fail-closed)
delete process.env.TOKEN_ENCRYPTION_KEY_V1;
delete process.env.TOKEN_ENCRYPTION_KEY;

let keyErrorCaught = false;
try {
  getEncryptionKey("v1");
} catch (e: any) {
  keyErrorCaught = true;
  assert(e.message.includes("not configured"), "TC-KEY-01: Missing key causes controlled failure");
}
assert(keyErrorCaught, "TC-KEY-02: Fail-closed when encryption key is missing");

// Set valid 32-byte key
const validKeyHex = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.TOKEN_ENCRYPTION_KEY_V1 = validKeyHex;

const loadedKey = getEncryptionKey("v1");
assert(loadedKey.length === 32, "TC-KEY-03: Valid 64-hex key decodes to exactly 32 bytes");

// 4. AES-256-GCM Envelope Encryption & Decryption
const encryptedPayload = encryptTokenPayload(token1);
assert(encryptedPayload.startsWith("v1:"), "TC-CRYPTO-07: Ciphertext includes version prefix v1");
const parts = encryptedPayload.split(":");
assert(parts.length === 4, "TC-CRYPTO-08: Payload has 4 segments (version, iv, tag, ciphertext)");
assert(parts[1].length === 24, "TC-CRYPTO-09: IV has 12 bytes (24 hex characters)");
assert(parts[2].length === 32, "TC-CRYPTO-10: Auth tag has 16 bytes (32 hex characters)");

const decryptedToken = decryptTokenPayload(encryptedPayload);
assert(decryptedToken === token1, "TC-CRYPTO-11: Decrypted token matches original bearer token");

// 5. Tamper Resistance
const tamperedPayload = encryptedPayload.slice(0, -4) + "ffff";
let tamperCaught = false;
try {
  decryptTokenPayload(tamperedPayload);
} catch {
  tamperCaught = true;
}
assert(tamperCaught, "TC-CRYPTO-12: Tampered ciphertext fails GCM auth tag verification");

// 6. Razorpay Signature Verification
const secret = "test_webhook_secret_123456";
const orderId = "order_rzp_mock_123";
const paymentId = "pay_rzp_mock_456";
const crypto = require("crypto");
const validSig = crypto
  .createHmac("sha256", secret)
  .update(`${orderId}|${paymentId}`)
  .digest("hex");

assert(
  verifyRazorpaySignature(orderId, paymentId, validSig, secret),
  "TC-GATEWAY-01: Valid payment checkout signature verified"
);
assert(
  !verifyRazorpaySignature(orderId, paymentId, "invalid_signature_hex", secret),
  "TC-GATEWAY-02: Invalid payment checkout signature rejected"
);

// 7. Razorpay Webhook Signature Verification
const webhookBody = JSON.stringify({ event: "payment.captured", id: "evt_123" });
const validWebhookSig = crypto
  .createHmac("sha256", secret)
  .update(webhookBody)
  .digest("hex");

assert(
  verifyRazorpayWebhookSignature(webhookBody, validWebhookSig, secret),
  "TC-GATEWAY-03: Valid webhook signature verified"
);
assert(
  !verifyRazorpayWebhookSignature(webhookBody, "wrong_signature", secret),
  "TC-GATEWAY-04: Invalid webhook signature rejected"
);

console.log(`\n=== TEST SUITE RESULTS: ${passedCount} PASSED, ${failedCount} FAILED ===`);
if (failedCount > 0) {
  process.exit(1);
}
