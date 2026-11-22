import crypto from "crypto";

/**
 * SEVOLF Digital Encryption & Hashing Service
 * Manages CSPRNG token generation, SHA-256 digests, and AES-256-GCM envelope encryption.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

/**
 * Returns the configured 256-bit encryption key.
 * Strictly fails closed if the key is missing or invalid.
 */
export function getEncryptionKey(version = "v1"): Buffer {
  const envKey = process.env[`TOKEN_ENCRYPTION_KEY_${version.toUpperCase()}`] || process.env.TOKEN_ENCRYPTION_KEY;
  if (!envKey) {
    throw new Error(`Master token encryption key is not configured for version: ${version}`);
  }

  let keyBuf: Buffer;
  if (envKey.length === 64 && /^[0-9a-fA-F]+$/.test(envKey)) {
    keyBuf = Buffer.from(envKey, "hex");
  } else {
    keyBuf = Buffer.from(envKey, "utf8");
  }

  if (keyBuf.length !== 32) {
    throw new Error(`Invalid encryption key length: expected exactly 32 bytes, got ${keyBuf.length}`);
  }

  return keyBuf;
}

/**
 * Generates a cryptographically secure 32-byte (256-bit) bearer token formatted as hex.
 */
export function generateBearerToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Computes the SHA-256 hash of a bearer token for safe database lookups.
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Encrypts a raw bearer token using AES-256-GCM envelope encryption.
 * Output format: `v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function encryptTokenPayload(token: string, keyVersion = "v1"): string {
  const key = getEncryptionKey(keyVersion);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let ciphertext = cipher.update(token, "utf8", "hex");
  ciphertext += cipher.final("hex");

  const authTag = cipher.getAuthTag().toString("hex");
  const ivHex = iv.toString("hex");

  return `${keyVersion}:${ivHex}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token payload.
 * Expected format: `v1:<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 */
export function decryptTokenPayload(payload: string): string {
  const parts = payload.split(":");
  if (parts.length !== 4) {
    throw new Error("Invalid payload format.");
  }

  const [version, ivHex, authTagHex, ciphertextHex] = parts;
  if (version !== "v1") {
    throw new Error("Unsupported token payload version.");
  }

  const key = getEncryptionKey(version);
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  try {
    let decrypted = decipher.update(ciphertextHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch {
    throw new Error("Failed to decrypt payload.");
  }
}
