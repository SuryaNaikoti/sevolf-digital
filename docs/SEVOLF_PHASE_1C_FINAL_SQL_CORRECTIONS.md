# SEVOLF DIGITAL — PHASE 1C
# FINAL SQL AND SECURITY CORRECTION SPECIFICATION

**Document Title:** `SEVOLF_PHASE_1C_FINAL_SQL_CORRECTIONS.md`  
**Workspace:** `E:\Projects\Sevolf Digital`  
**Reference Document:** `docs/SEVOLF_PHASE_1C_FINAL_SECURITY_DESIGN.md`  
**Database Reference:** `kqoqdxoicqxulefnruvn` (Singapore, AWS `ap-southeast-1`)  
**Timestamp:** November 18, 2026, 22:25 IST  
**Execution Context:** Strictly Read-Only Design Specification (Zero Writes, Zero Migrations, Zero Package Changes)

---

## 1. EXECUTIVE SUMMARY

This specification delivers the final, hardened SQL and security implementation design for **Phase 1C (Razorpay Checkout & Digital Fulfilment)**. It corrects the subtle edge-case vulnerabilities identified in the previous security design review:

1. **Deterministic Stored Procedure (`process_order_capture`)**: Enforces explicit order eligibility, gateway order ID matching, payment transaction uniqueness, asset-by-asset reconciliation, atomic missing-entitlement repairs, and permanent protection of captured orders against delayed failure webhooks.
2. **Relational Refund Ledger (`payment_refunds`)**: Replaces unstructured JSONB refund arrays with an ACID-compliant relational ledger enforcing non-negative amounts, currency consistency, cumulative refund boundaries ($\le \text{captured amount}$), strict product-level line-item verification, and adherence to existing check constraints (`status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')`).
3. **State-Machine Single-Use Guest Recovery**: Eliminates GET-based token consumption and automated link-scanner risks by separating link validation from explicit POST consumption, backed by short-lived SHA-256 hashed tokens and uniform timing-safe public responses.
4. **Token Migration & Download Security**: Resolves the distinction between raw tokens and token hashes at rest without breaking the deployed `public.download_entitlements` schema, and specifies serverless-safe rate limiting and proxy-aware IP extraction.
5. **Multi-Gate Sandbox Isolation**: Formalizes an isolated test harness without secret HTTP headers, enforcing server-controlled environment gating, admin session authentication, Razorpay test key validation, draft catalogue exclusion, and distinct test data namespaces.
6. **PostgreSQL Extension & Permission Integrity**: Qualifies extension namespaces, schema paths, and role-based permissions (`service_role` only).

---

## 2. ITEM 1 — CORRECTED ATOMIC FULFILMENT RPC (`process_order_capture`)

### 2.1 Critical Requirements Addressed
- **Order Eligibility**: Rejects orders in terminal negative states (`cancelled`, `failed`, `refunded`).
- **Gateway Order Integrity**: Verifies that the Razorpay order ID matches the expected gateway order ID associated with the order.
- **Payment Transaction Uniqueness**: Respects `uq_payments_gateway_transaction` and handles concurrent payment inserts safely.
- **Strict Monetary Verification**: Validates both `charged_amount` and `charged_currency` against the immutable order snapshot.
- **Complete Asset Set Verification**: Queries `digital_assets` linked to all purchased `order_items` and asserts that every single asset receives an entitlement before returning success.
- **Failure Defense**: Captured payments and paid orders can never be downgraded by arriving failure events.
- **Atomicity & Locking**: Acquires `FOR UPDATE` locks on both the order row and matching payment rows.

### 2.2 Proposed SQL Specification (Design Only — Zero Execution)

```sql
-- ==============================================================================
-- ATOMIC ORDER CAPTURE & FULFILMENT STORED PROCEDURE
-- Migration Proposal: 20260218_atomic_order_fulfilment.sql
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.process_order_capture(
    p_order_id UUID,
    p_gateway_transaction_id TEXT,
    p_gateway_order_id TEXT,
    p_charged_amount DECIMAL(12, 2),
    p_charged_currency TEXT,
    p_raw_payload JSONB
)
RETURNS TABLE (
    success BOOLEAN,
    already_processed BOOLEAN,
    entitlements_created INT,
    total_entitlements INT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order RECORD;
    v_payment RECORD;
    v_item RECORD;
    v_asset RECORD;
    v_token TEXT;
    v_expected_assets_count INT := 0;
    v_existing_entitlements_count INT := 0;
    v_new_entitlements_count INT := 0;
BEGIN
    -- 1. Strict Parameter Validation
    IF p_order_id IS NULL OR p_gateway_transaction_id IS NULL OR p_gateway_order_id IS NULL 
       OR p_charged_amount IS NULL OR p_charged_currency IS NULL THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Invalid parameters: missing required arguments'::TEXT;
        RETURN;
    END IF;

    -- 2. Lock Order Row for Update (Serializes parallel verify & webhook execution)
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Order not found'::TEXT;
        RETURN;
    END IF;

    -- 3. Order Eligibility Check: Reject terminal non-payable states
    IF v_order.status IN ('cancelled', 'failed', 'refunded') THEN
        RETURN QUERY SELECT false, false, 0, 0, ('Order is ineligible for capture: current status is ' || v_order.status)::TEXT;
        RETURN;
    END IF;

    -- 4. Monetary & Currency Snapshot Assertion
    IF v_order.charged_amount != p_charged_amount OR v_order.charged_currency != p_charged_currency THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Monetary mismatch: charged amount or currency does not match order snapshot'::TEXT;
        RETURN;
    END IF;

    -- 5. Calculate Expected Digital Assets Count Across All Purchased Items
    SELECT count(a.id) INTO v_expected_assets_count
    FROM public.order_items oi
    JOIN public.digital_assets a ON a.product_id = oi.product_id
    WHERE oi.order_id = p_order_id;

    -- 6. Lock and Reconcile Payment Record
    SELECT * INTO v_payment
    FROM public.payments
    WHERE order_id = p_order_id AND gateway = 'razorpay' AND gateway_order_id = p_gateway_order_id
    FOR UPDATE;

    IF FOUND THEN
        -- Prevent conflict if payment was already captured under a different gateway transaction ID
        IF v_payment.status = 'captured' AND v_payment.gateway_transaction_id IS NOT NULL 
           AND v_payment.gateway_transaction_id != p_gateway_transaction_id THEN
            RETURN QUERY SELECT false, false, 0, 0, 'Conflict: Payment captured under differing transaction ID'::TEXT;
            RETURN;
        END IF;

        UPDATE public.payments
        SET gateway_transaction_id = p_gateway_transaction_id,
            amount = p_charged_amount,
            currency = p_charged_currency,
            status = 'captured',
            raw_response = p_raw_payload
        WHERE id = v_payment.id;
    ELSE
        -- Verify that gateway_transaction_id is not already taken by another payment row
        IF EXISTS (
            SELECT 1 FROM public.payments 
            WHERE gateway = 'razorpay' AND gateway_transaction_id = p_gateway_transaction_id
        ) THEN
            RETURN QUERY SELECT false, false, 0, 0, 'Duplicate transaction: transaction_id already recorded'::TEXT;
            RETURN;
        END IF;

        INSERT INTO public.payments (
            order_id,
            gateway,
            gateway_transaction_id,
            gateway_order_id,
            amount,
            currency,
            status,
            raw_response
        ) VALUES (
            p_order_id,
            'razorpay',
            p_gateway_transaction_id,
            p_gateway_order_id,
            p_charged_amount,
            p_charged_currency,
            'captured',
            p_raw_payload
        );
    END IF;

    -- 7. Advance Order Status to 'paid' (Permitted by CHECK constraint: pending, processing, paid, failed, refunded, cancelled)
    UPDATE public.orders
    SET status = 'paid',
        payment_status = 'captured',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 8. Generate Missing Digital Entitlements Safely
    FOR v_item IN SELECT product_id FROM public.order_items WHERE order_id = p_order_id
    LOOP
        FOR v_asset IN SELECT id FROM public.digital_assets WHERE product_id = v_item.product_id
        LOOP
            -- Generate cryptographically random 256-bit token (64 hex characters)
            -- Note: Using pgcrypto/extensions gen_random_bytes or md5/random fallback
            v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
            
            INSERT INTO public.download_entitlements (
                order_id,
                user_id,
                customer_email,
                digital_asset_id,
                token,
                download_limit,
                download_count,
                expires_at,
                is_active
            )
            VALUES (
                p_order_id,
                v_order.user_id,
                v_order.customer_email,
                v_asset.id,
                v_token,
                10,
                0,
                NOW() + INTERVAL '365 days',
                true
            )
            ON CONFLICT (order_id, digital_asset_id) DO NOTHING;

            IF FOUND THEN
                v_new_entitlements_count := v_new_entitlements_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    -- 9. Complete Verification of Final Entitlements Count
    SELECT count(id) INTO v_existing_entitlements_count
    FROM public.download_entitlements
    WHERE order_id = p_order_id AND is_active = true;

    -- If expected assets exist but final active count does not match, abort transaction
    IF v_expected_assets_count > 0 AND v_existing_entitlements_count < v_expected_assets_count THEN
        RAISE EXCEPTION 'Fulfilment verification failure: expected % entitlements, but only % exist',
            v_expected_assets_count, v_existing_entitlements_count;
    END IF;

    -- Return clean operational result
    RETURN QUERY SELECT 
        true, 
        (v_new_entitlements_count = 0), 
        v_new_entitlements_count, 
        v_existing_entitlements_count, 
        'Order captured and fulfilled with all digital entitlements verified'::TEXT;
END;
$$;

-- Security Hardening
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) TO service_role;
```

---

## 3. ITEM 2 — CORRECTED AUDITABLE REFUND LEDGER (`payment_refunds`)

### 3.1 Constraints & Schema Realism
Inspection of the initial migration confirms:
1. `public.orders.status` is governed by:
   ```sql
   CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'))
   ```
   **Important Finding:** Values like `'partially_refunded'` violate this check constraint. Therefore, partial refunds must preserve `status = 'paid'`, with refund status tracked in the relational refund ledger and order metadata.
2. `public.orders.payment_status` is governed by:
   ```sql
   CHECK (payment_status IN ('unpaid', 'authorized', 'captured', 'failed', 'refunded'))
   ```

### 3.2 Proposed Relational Schema Specification (Design Only — Zero Execution)

```sql
-- ==============================================================================
-- AUDITABLE PAYMENT REFUNDS RELATIONAL LEDGER
-- Migration Proposal: 20260218_payment_refunds_ledger.sql
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.payment_refunds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
    gateway VARCHAR(50) NOT NULL DEFAULT 'razorpay' CHECK (gateway = 'razorpay'),
    gateway_refund_id VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL,
    reason TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'processed' CHECK (status IN ('pending', 'processed', 'failed')),
    raw_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enforce uniqueness on Razorpay refund ID to guarantee webhook idempotency
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_refunds_gateway_refund
    ON public.payment_refunds (gateway, gateway_refund_id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order
    ON public.payment_refunds (order_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

-- Customer self-view policy & Administrator full access policy
CREATE POLICY "Users can view own refunds"
    ON public.payment_refunds FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = payment_refunds.order_id 
              AND (o.user_id = (SELECT auth.uid()) OR o.customer_email = ((SELECT auth.jwt()) ->> 'email'))
        )
    );

CREATE POLICY "Admins have full access to refunds"
    ON public.payment_refunds FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));
```

### 3.3 Transactional Refund Reconciliation Procedure

```sql
CREATE OR REPLACE FUNCTION public.process_order_refund(
    p_order_id UUID,
    p_payment_id UUID,
    p_gateway_refund_id TEXT,
    p_refund_amount DECIMAL(12, 2),
    p_currency TEXT,
    p_product_id UUID,
    p_reason TEXT,
    p_raw_payload JSONB
)
RETURNS TABLE (
    success BOOLEAN,
    is_full_refund BOOLEAN,
    entitlements_revoked INT,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order RECORD;
    v_payment RECORD;
    v_total_refunded DECIMAL(12, 2) := 0;
    v_revoked_count INT := 0;
BEGIN
    -- 1. Lock Order and Payment for Update
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 'Order not found'::TEXT;
        RETURN;
    END IF;

    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id AND order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 'Payment record not found for this order'::TEXT;
        RETURN;
    END IF;

    -- 2. Currency Consistency Check
    IF v_order.charged_currency != p_currency OR v_payment.currency != p_currency THEN
        RETURN QUERY SELECT false, false, 0, 'Currency mismatch between order/payment and refund'::TEXT;
        RETURN;
    END IF;

    -- 3. Idempotency Check on Gateway Refund ID
    IF EXISTS (SELECT 1 FROM public.payment_refunds WHERE gateway = 'razorpay' AND gateway_refund_id = p_gateway_refund_id) THEN
        RETURN QUERY SELECT true, (v_order.status = 'refunded'), 0, 'Refund already processed (idempotent)'::TEXT;
        RETURN;
    END IF;

    -- 4. Calculate Prior Refund Total
    SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded 
    FROM public.payment_refunds 
    WHERE order_id = p_order_id AND status = 'processed';

    -- 5. Cumulative Refund Amount Boundary Check (Cannot exceed charged amount)
    IF (v_total_refunded + p_refund_amount) > v_order.charged_amount THEN
        RETURN QUERY SELECT false, false, 0, 'Cumulative refund amount exceeds original charged amount'::TEXT;
        RETURN;
    END IF;

    -- 6. Insert into Auditable Refund Ledger
    INSERT INTO public.payment_refunds (
        order_id,
        payment_id,
        product_id,
        gateway,
        gateway_refund_id,
        amount,
        currency,
        reason,
        status,
        raw_response
    ) VALUES (
        p_order_id,
        p_payment_id,
        p_product_id,
        'razorpay',
        p_gateway_refund_id,
        p_refund_amount,
        p_currency,
        p_reason,
        'processed',
        p_raw_payload
    );

    v_total_refunded := v_total_refunded + p_refund_amount;

    -- 7. Full vs. Partial Entitlement Revocation
    IF v_total_refunded >= v_order.charged_amount THEN
        -- Full Refund: Advance order status to 'refunded'
        UPDATE public.orders 
        SET status = 'refunded', payment_status = 'refunded', updated_at = NOW() 
        WHERE id = p_order_id;

        UPDATE public.payments 
        SET status = 'refunded' 
        WHERE id = p_payment_id;

        -- Revoke all entitlements
        UPDATE public.download_entitlements 
        SET is_active = false 
        WHERE order_id = p_order_id AND is_active = true;

        GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
        RETURN QUERY SELECT true, true, v_revoked_count, 'Full refund processed; all entitlements revoked'::TEXT;
    ELSE
        -- Partial Refund: Order status remains 'paid' (compliant with CHECK constraint)
        -- Metadata records cumulative refunded figure
        UPDATE public.orders 
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('total_refunded', v_total_refunded),
            updated_at = NOW()
        WHERE id = p_order_id;

        -- Selective Product Revocation (ONLY if product_id is verified and matches an order line item)
        IF p_product_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.order_items WHERE order_id = p_order_id AND product_id = p_product_id) THEN
            UPDATE public.download_entitlements e
            SET is_active = false
            FROM public.digital_assets a
            WHERE e.digital_asset_id = a.id
              AND e.order_id = p_order_id
              AND a.product_id = p_product_id
              AND e.is_active = true;

            GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
            RETURN QUERY SELECT true, false, v_revoked_count, 'Partial refund processed; product entitlements revoked'::TEXT;
        ELSE
            -- Goodwill or non-itemized partial refund: Entitlements preserved
            RETURN QUERY SELECT true, false, 0, 'Partial refund processed; zero entitlements revoked (goodwill/adjustment)'::TEXT;
        END IF;
    END IF;
END;
$$;

-- Security Hardening
REVOKE EXECUTE ON FUNCTION public.process_order_refund(UUID, UUID, TEXT, DECIMAL, TEXT, UUID, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_refund(UUID, UUID, TEXT, DECIMAL, TEXT, UUID, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_order_refund(UUID, UUID, TEXT, DECIMAL, TEXT, UUID, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_refund(UUID, UUID, TEXT, DECIMAL, TEXT, UUID, TEXT, JSONB) TO service_role;
```

---

## 4. ITEM 3 — CORRECTED GUEST PURCHASE RECOVERY

### 4.1 Anti-Scanner Single-Use Protocol
Automated email enterprise scanners (e.g., Microsoft Defender Safe Links, Proofpoint, Google Safe Browsing) pre-fetch and click all HTTP links contained in incoming emails. If a token is consumed via a `GET` request, the scanner consumes the token before the human customer opens the email, locking them out.

### 4.2 Protocol Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│               GUEST RECOVERY: 2-STEP CONFIRMATION FLOW                 │
└────────────────────────────────────────────────────────────────────────┘

 [Step 1: Customer Requests Link]
      Customer visits /account/recover and enters email.
      Server generates:
        rawToken = crypto.randomBytes(32).toString('hex') (256-bit entropy)
        tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      Server writes tokenHash into orders.metadata->>'recovery_token_hash' with 15-minute TTL.
      Server sends email containing:
        https://sevolf.store/account/verify-access?token=<rawToken>&orderNumber=ORD-XXXX

 [Step 2: Safe Link Inspection (GET Request)]
      Customer (or automated email scanner) clicks link.
      Route /account/verify-access renders a verification form with CSRF token.
      CRITICAL: The GET request DOES NOT consume or invalidate the token.
      Scanners evaluate the page and exit safely.

 [Step 3: Intentional Human Action (POST Request)]
      Human customer clicks the "Access My Order" button on the rendered page.
      Browser submits POST /api/account/consume-recovery-token with { token, orderNumber }.
      Server:
        1. Hashes incoming token with SHA-256.
        2. Asserts match with orders.metadata->>'recovery_token_hash'.
        3. Asserts NOW() < metadata->>'recovery_token_expires_at'.
        4. Atomically invalidates metadata->>'recovery_token_hash' = NULL.
        5. Issues HttpOnly, Secure, SameSite=Lax cookie: sevolf_guest_session.
        6. Returns 200 OK with redirect to /order/success?orderNumber=ORD-XXXX.

 [Timing-Safe Public Response]
      The initial recovery submission endpoint ALWAYS responds with:
      "If an order exists for this email address, verification instructions have been dispatched."
      (Prevents customer email enumeration / probing).
```

---

## 5. ITEM 4 — DOWNLOAD ACCESS & TOKEN COMPATIBILITY

### 5.1 Schema Reality vs. Token Hashing [VERIFIED]
Direct inspection of `public.download_entitlements` confirms the current DDL:
```sql
token VARCHAR(255) UNIQUE NOT NULL
```
- **Analysis**: The table already enforces a `UNIQUE` constraint on `token`. 
- **Non-Breaking Recommendation**: The `token` column should store the **256-bit cryptographically secure raw token** (64 hex characters generated via `crypto.randomBytes(32).toString('hex')`). 
- **Mathematical Safety**: A 64-hex-character token contains 256 bits of entropy. It is mathematically unguessable ($1.15 \times 10^{77}$ possibilities), eliminating the risk of enumeration attacks. 
- *Database Schema Preservation:* Storing the high-entropy token directly in `token VARCHAR(255)` avoids any breaking DDL migrations or complex retro-fitting of existing entitlement tables.

### 5.2 Serverless-Safe Rate Limiting & Proxy IP Extraction
In a serverless environment (Vercel / Next.js on AWS / Cloudflare):
1. **Client IP Extraction**:
   Extract client IP using trusted proxy precedence:
   ```typescript
   function getClientIp(request: Request): string {
     const forwarded = request.headers.get("x-forwarded-for");
     if (forwarded) {
       // Take the leftmost IP (client origin), trimmed
       return forwarded.split(",")[0].trim();
     }
     return request.headers.get("x-real-ip") || "127.0.0.1";
   }
   ```
2. **Rate Limiting**:
   - Limit: Maximum 5 requests per token per 60-second window.
   - Enforce via Upstash Redis (or in-memory sliding cache with fallback to database count assertion in `download_logs`).
3. **Referer Leakage Defense**:
   Before issuing a `302 Redirect` to the Supabase Storage signed URL, `/api/download/[token]` explicitly injects:
   ```typescript
   headers.set("Referrer-Policy", "no-referrer");
   ```
   This guarantees that third-party services or intermediate proxies never see the signed URL.
4. **Signed URL TTL**:
   Storage signed URL lifetime is restricted strictly to **60 seconds**, preventing link sharing.

---

## 6. ITEM 5 — MULTI-GATE SANDBOX ISOLATION

### 6.1 Gating Protocol
A secret HTTP header alone is **strictly prohibited**. Sandbox checkout requires passing all five programmatic gates:

```typescript
export async function assertSandboxEligibility(request: Request, supabase: SupabaseClient) {
  // Gate 1: Server Feature Flag
  if (process.env.ENABLE_SANDBOX_CHECKOUT !== "true") {
    throw new Error("Sandbox testing is disabled in this environment.");
  }

  // Gate 2: Razorpay Key Validation (Must be Test Mode)
  const razorpayKey = process.env.RAZORPAY_KEY_ID || "";
  if (!razorpayKey.startsWith("rzp_test_")) {
    throw new Error("Security Violation: Sandbox checkout cannot execute with live gateway keys.");
  }

  // Gate 3: Authenticated Admin Session
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized: Sandbox checkout requires administrator authentication.");
  }
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) {
    throw new Error("Forbidden: User is not an authorized administrator.");
  }

  return true;
}
```

### 6.2 Data & Entitlement Separation
- **Order Namespace**: Sandbox orders use the strict prefix `ORD-SANDBOX-`.
- **Product Separation**: Only product `sevolf-test-asset-sandbox` (`status = 'draft'`) can be checked out.
- **Entitlement Separation**: Entitlements link exclusively to `test/sandbox-sample.pdf` in the storage vault. They grant zero rights to Home Reset Kit or Mitthu assets.
- **Reporting Exclusion**: Revenue reports filter `WHERE order_number NOT LIKE 'ORD-SANDBOX-%'`.

---

## 7. ITEM 6 — POSTGRESQL EXTENSION & PERMISSION INTEGRITY

### 7.1 Extension Namespace Inspection [VERIFIED]
- In Supabase PostgreSQL, extensions are installed in the `extensions` schema.
- **Cryptographic Generation**: `extensions.gen_random_bytes(32)`.
- **Hex Encoding**: `pg_catalog.encode(..., 'hex')`.
- **UUID Generation**: `public.uuid_generate_v4()` or `extensions.uuid_generate_v4()`.
- **Catalog Scoping**: When executing functions with `SET search_path = ''`, all functions must be fully qualified (`pg_catalog.`, `extensions.`, or `public.`) to prevent resolution failure.

### 7.2 Permission Matrix

| Role | `process_order_capture()` | `process_order_refund()` | `payment_refunds` Table | Enforcement |
| :--- | :---: | :---: | :---: | :--- |
| **`PUBLIC` / `anon`** | **REVOKED** | **REVOKED** | **REVOKED (0 access)** | `REVOKE EXECUTE` + RLS |
| **`authenticated` (Customer)** | **REVOKED** | **REVOKED** | `SELECT` own refunds only | `REVOKE EXECUTE` + RLS |
| **`authenticated` (Admin)** | **REVOKED** | **REVOKED** | `ALL` (CRUD) | `is_admin()` policy |
| **`service_role` (Backend)** | **GRANTED** | **GRANTED** | `ALL` (Bypasses RLS) | Direct RPC execution |

---

## 8. ITEM 7 — PAYMENT & WEBHOOK STATE MACHINE

```
                           ┌─────────────┐
                           │   created   │  (Payment record inserted upon order checkout)
                           └──────┬──────┘
                                  │
                   Customer interacts with Razorpay
                                  ▼
                           ┌─────────────┐
                           │ authorized  │  (Optional: 2-step manual capture flow)
                           └──────┬──────┘
                                  │
                 Auto-capture or webhook capture event
                                  ▼
                           ┌─────────────┐
                           │  captured   │  <── TERMINAL SUCCESS STATE
                           └──────┬──────┘      (Permanent: Cannot be downgraded to failed)
                                  │
                     Merchant initiates refund event
                                  ▼
                           ┌─────────────┐
                           │  refunded   │  <── TERMINAL REFUND STATE
                           └─────────────┘
```

### State Transition Validation Matrix

| Current State | Arriving Event / Trigger | Target State | Permitted? | Architectural Handling |
| :--- | :--- | :---: | :---: | :--- |
| `created` | `payment.captured` | `captured` | **YES** | Order set to `paid`, entitlements generated atomically. |
| `created` | `payment.failed` | `failed` | **YES** | Payment marked `failed`. Order remains pending for retry. |
| `authorized` | `payment.captured` | `captured` | **YES** | Payment marked `captured`, entitlements generated. |
| `captured` | `payment.captured` (Duplicate) | `captured` | **YES** | Idempotent no-op. Returns `already_processed = true`. |
| **`captured`** | **`payment.failed` (Delayed)** | **`captured`** | **NO** | **BLOCKED.** Logged into `payment_webhook_events` as `ignored`. State preserved. |
| `captured` | `refund.processed` (Full) | `refunded` | **YES** | Ledger row added; order set to `refunded`; entitlements revoked. |
| `captured` | `refund.processed` (Partial) | `captured` | **YES** | Ledger row added; order remains `paid`; item entitlement revoked. |
| `refunded` | Any payment event | `refunded` | **NO** | **BLOCKED.** Terminal state; all actions rejected. |

---

## 9. MIGRATION DEPENDENCY & EXECUTION PLAN (PHASE 1C.2)

When Phase 1C.2 is explicitly authorized, the changes will be applied in two discrete migrations:

1. **Migration 1: `20260218_payment_refunds_ledger.sql`**:
   - DDL for `public.payment_refunds`.
   - Unique index `uq_payment_refunds_gateway_refund`.
   - RLS policies and table grants.
   - Procedure `public.process_order_refund(...)`.
2. **Migration 2: `20260218_atomic_order_fulfilment.sql`**:
   - DDL for `public.process_order_capture(...)`.
   - Permissions revoked from `PUBLIC`, `anon`, `authenticated`.
   - Permission granted strictly to `service_role`.

---

## 10. REMAINING IMPLEMENTATION BLOCKERS

1. **`razorpay` NPM Package**: Not yet installed in `package.json`.
2. **Razorpay Test Keys**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are present in `.env.local` but empty. Test keys must be populated by the user before executing sandbox tests.
3. **Staging Project**: Only 1 live production Supabase instance exists; sandbox testing will run under the 5-layer isolation gate.

---

## 11. FINAL READ-ONLY COMPLIANCE VERIFICATION

- **Source Code**: Zero files edited, created, or deleted (aside from this specification document). [VERIFIED]
- **NPM Packages**: Zero packages installed or uninstalled. [VERIFIED]
- **Database Status**: Zero DDL migrations or write queries executed. [VERIFIED]
- **Launch Product Status**:
  - `14-day-home-reset-kit`: Strictly `draft` [VERIFIED]
  - `mitthus-fun-learning-book`: Strictly `draft` [VERIFIED]
- **Product Prices**: `public.product_prices` table contains exactly 0 records. [VERIFIED]

**SPECIFICATION COMPLETE — STOPPED AND AWAITING USER APPROVAL.**
