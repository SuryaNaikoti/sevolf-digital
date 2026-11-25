/**
 * SEVOLF Digital — Centralized Transaction Classifier
 * Authoritative commerce transaction environment classification.
 * 
 * Rules:
 * 1. Checks persisted transaction environment: 'test', 'live', or 'unknown'.
 * 2. If environment is explicitly persisted, uses that authoritative value.
 * 3. Falls back safely to order flags (`is_sandbox === true`).
 * 4. Checks raw gateway responses or transaction metadata for verified test mode markers.
 * 5. NEVER classifies a historical transaction as live merely because current API credentials are live.
 * 6. Explicitly handles and flags 'unknown' environments for operator review.
 */

export type TransactionEnvironment = "test" | "live" | "unknown";

export interface ClassifiableTransaction {
  id?: string;
  is_sandbox?: boolean | null;
  environment?: string | null;
  order_number?: string | null;
  gateway_transaction_id?: string | null;
  raw_response?: any;
  payments?: Array<{
    environment?: string | null;
    gateway_transaction_id?: string | null;
    raw_response?: any;
  }>;
}

/**
 * Classifies an order or payment into 'live', 'test', or 'unknown'.
 */
export function classifyTransactionEnvironment(tx: ClassifiableTransaction | null | undefined): TransactionEnvironment {
  if (!tx) return "unknown";

  // 1. Explicit persisted environment on transaction or order
  if (tx.environment === "test") return "test";
  if (tx.environment === "live") return "live";

  // 2. Attached payments check
  if (Array.isArray(tx.payments) && tx.payments.length > 0) {
    for (const payment of tx.payments) {
      if (payment.environment === "test") return "test";
      if (payment.environment === "live") return "live";
      
      // Check payment notes or raw payload
      if (payment.raw_response?.notes?.is_test === "true" || payment.raw_response?.notes?.environment === "test") {
        return "test";
      }
    }
  }

  // 3. Raw response on payment entity
  if (tx.raw_response) {
    if (tx.raw_response.notes?.is_test === "true" || tx.raw_response.notes?.environment === "test") {
      return "test";
    }
  }

  // 4. Canonical sandbox fixture flag
  if (tx.is_sandbox === true) {
    return "test";
  }

  // 5. Verified pre-launch historical test orders
  if (tx.order_number === "ORD-369819") {
    return "test";
  }

  // 6. If explicitly marked unknown or no verified live markers exist, return 'unknown'
  if (tx.environment === "unknown") {
    return "unknown";
  }

  // Default to unknown to prevent accidental commercial revenue inclusion
  return "unknown";
}

/**
 * Returns true if the transaction is definitely a test or sandbox transaction.
 */
export function isTestTransaction(tx: ClassifiableTransaction | null | undefined): boolean {
  return classifyTransactionEnvironment(tx) === "test";
}

/**
 * Returns true strictly if the transaction is verified as live commercial revenue.
 * Unknown or unverified transactions NEVER qualify as live commercial revenue.
 */
export function isLiveTransaction(tx: ClassifiableTransaction | null | undefined): boolean {
  return classifyTransactionEnvironment(tx) === "live";
}

/**
 * Resolves the authoritative Razorpay environment strictly from the server-side key ID.
 * Never trusts client-supplied environment flags.
 */
export function resolveRazorpayEnvironment(keyId?: string | null): TransactionEnvironment {
  if (!keyId || typeof keyId !== "string") return "unknown";
  const trimmed = keyId.trim();
  if (trimmed.startsWith("rzp_test_")) return "test";
  if (trimmed.startsWith("rzp_live_") && trimmed.length > 9) return "live";
  return "unknown";
}
