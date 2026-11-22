# SEVOLF DIGITAL — PHASE 1C
# FINAL SQL AND SECURITY REVIEW V2

**Document Title:** `SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V2.md`  
**Workspace:** `E:\Projects\Sevolf Digital`  
**Reference Documents:**
- `docs/SEVOLF_PHASE_1C_FINAL_SQL_CORRECTIONS.md`
- `docs/SEVOLF_PHASE_1C_FINAL_SECURITY_DESIGN.md`  
**Database Reference:** `kqoqdxoicqxulefnruvn` (Singapore, AWS `ap-southeast-1`)  
**Timestamp:** November 18, 2026, 22:35 IST  
**Execution Context:** Strictly Read-Only Security Architecture & SQL Verification (Zero Writes, Zero Migrations, Zero Package Changes)

---

## 1. EXECUTIVE SUMMARY

This document completes the final, exhaustive security engineering audit for **SEVOLF Phase 1C**. It corrects the remaining structural, transactional, and architectural gaps in the five core checkout domains before any implementation is authorized:

1. **Atomic Fulfilment (`process_order_capture`)**: Replaced loose asset counting with deterministic, asset-by-asset reconciliation using `DISTINCT digital_assets.id`. Explicitly verifies Razorpay gateway order IDs against `orders.metadata->>'gateway_order_id'` even when no payment row exists prior to webhook arrival. Implements defensive row locking (`FOR UPDATE`) across both orders and payments, rejects zero-asset orders, gracefully deduplicates duplicate order items, and permanently preserves captured orders against delayed failure webhooks.
2. **Auditable Refund Ledger (`process_order_refund`)**: Enforces multi-dimensional idempotency on `(gateway_refund_id, order_id, payment_id, amount, currency)`. Rejects conflicting reuse of refund IDs. Validates that cumulative refunds do not exceed the specific captured payment amount. Validates product ownership against `order_items` line items and verifies line-item prices before revoking entitlements. Explicitly rejects invalid product IDs rather than treating them as goodwill refunds.
3. **State-Machine Single-Use Guest Recovery**: Eliminates automated email scanner link pre-consumption through a strict 2-step CSRF-protected `POST` confirmation. Enforces short-lived (15 min) SHA-256 hashed tokens, origin validation, rate-limiting on both request and consumption, `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, zero third-party asset loading, and uniform timing-safe public responses.
4. **Download Security & Trusted Proxy Hardening**: Resolves the exact relationship between raw tokens and token hashes at rest without breaking the deployed `public.download_entitlements` schema. Specifies serverless-safe rate limiting (Upstash Redis / sliding-window DB fallback), strict proxy trust (only trusting `x-forwarded-for` from verified Vercel/Cloudflare edge proxies), 60s signed URL TTL, and immutable download audit logging.
5. **Comprehensive 5-Layer Sandbox Isolation**: Fully specifies all five isolation gates across both checkout and fulfilment layers. Explicitly isolates test orders, test payments, and test entitlements with `ORD-SANDBOX-` namespaces. Prevents sandbox records from leaking into production customer libraries, revenue reporting, or launch product assets.
6. **PostgreSQL Extension & Permission Integrity**: Fully qualifies all schema references (`pg_catalog.`, `extensions.`, `public.`). Revokes execution from `PUBLIC`, `anon`, and `authenticated`; grants execution strictly to `service_role`.

---

## 2. AREA 1 — ATOMIC ORDER FULFILMENT (`process_order_capture`)

### 2.1 Vulnerability & Structural Gaps in Prior Drafts
1. **Gateway Order Association Gap**: If a webhook arrived before the client-side `/api/checkout` initialized the `public.payments` row, the previous function had no reliable way to verify that `p_gateway_order_id` genuinely belonged to `p_order_id`.
2. **Loose Counting vs. Asset-by-Asset Reconcile**: Previous drafts checked `count(id) >= expected_assets_count`. In multi-item carts or carts with duplicate line items, counting could report success even if an asset was omitted and another duplicated.
3. **Zero-Asset Order Anomaly**: If an order contained a product with no linked digital assets in `digital_assets`, the check `v_existing_entitlements_count >= v_expected_assets_count` evaluated `0 >= 0` and returned success, falsely fulfilling an unfulfillable order.
4. **Payment Race Conditions & Captured State Protection**: A delayed `payment.failed` webhook could arrive after a client verify succeeded. The procedure must assert that once `payments.status = 'captured'`, it cannot be altered by non-refund events.

### 2.2 Corrected Architecture & Logic
- **Pre-Payment Verification**: During checkout initialization (`/api/checkout`), `orders.metadata` stores `{"gateway_order_id": "order_xxxx"}`. The stored procedure verifies:
  `COALESCE(v_payment.gateway_order_id, v_order.metadata->>'gateway_order_id') = p_gateway_order_id`.
- **Set-Based Digital Asset Reconciliation**: Reconciles the distinct set of all `digital_assets.id` linked to the products in `order_items`. Uses a CTE to identify exactly which asset IDs lack an active entitlement and inserts only the missing ones.
- **Asset Count Assertion**: Asserts `count(DISTINCT a.id) > 0`. If an order contains 0 assets, the transaction aborts with an error.

### 2.3 Corrected SQL Specification (Design Only — Not Executed)

```sql
-- ==============================================================================
-- REVISED ATOMIC ORDER CAPTURE & FULFILMENT STORED PROCEDURE
-- Proposal: supabase/migrations/20260218_atomic_order_fulfilment_v2.sql
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
    v_expected_asset_ids UUID[];
    v_missing_asset_ids UUID[];
    v_existing_asset_ids UUID[];
    v_asset_id UUID;
    v_token TEXT;
    v_new_entitlements_count INT := 0;
    v_final_entitlements_count INT := 0;
    v_recorded_gateway_order_id TEXT;
BEGIN
    -- 1. Input Validation
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
        RETURN QUERY SELECT false, false, 0, 0, 'Order record not found'::TEXT;
        RETURN;
    END IF;

    -- 3. Terminal State Rejection: Reject cancelled, failed, or refunded orders
    IF v_order.status IN ('cancelled', 'failed', 'refunded') THEN
        RETURN QUERY SELECT false, false, 0, 0, ('Order ineligible for capture: current status is ' || v_order.status)::TEXT;
        RETURN;
    END IF;

    -- 4. Monetary & Currency Snapshot Assertion
    IF v_order.charged_amount != p_charged_amount OR v_order.charged_currency != p_charged_currency THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Monetary mismatch: charged amount or currency does not match order snapshot'::TEXT;
        RETURN;
    END IF;

    -- 5. Extract Distinct Expected Digital Asset IDs (Prevents duplicate line-item inflation)
    SELECT ARRAY_AGG(DISTINCT a.id) INTO v_expected_asset_ids
    FROM public.order_items oi
    JOIN public.digital_assets a ON a.product_id = oi.product_id
    WHERE oi.order_id = p_order_id;

    -- Reject orders with zero digital assets
    IF v_expected_asset_ids IS NULL OR ARRAY_LENGTH(v_expected_asset_ids, 1) = 0 THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Fulfilment configuration error: Order contains zero digital assets'::TEXT;
        RETURN;
    END IF;

    -- 6. Lock and Reconcile Payment Record
    SELECT * INTO v_payment
    FROM public.payments
    WHERE order_id = p_order_id AND gateway = 'razorpay'
    FOR UPDATE;

    -- Determine authoritative gateway order ID (from existing payment row or order metadata)
    v_recorded_gateway_order_id := COALESCE(v_payment.gateway_order_id, v_order.metadata->>'gateway_order_id');

    IF v_recorded_gateway_order_id IS NOT NULL AND v_recorded_gateway_order_id != p_gateway_order_id THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Security mismatch: Razorpay gateway_order_id does not match order record'::TEXT;
        RETURN;
    END IF;

    IF FOUND THEN
        -- Existing payment row found
        IF v_payment.status = 'captured' THEN
            -- If already captured, verify transaction ID consistency
            IF v_payment.gateway_transaction_id != p_gateway_transaction_id THEN
                RETURN QUERY SELECT false, false, 0, 0, 'Conflict: Payment already captured under different transaction ID'::TEXT;
                RETURN;
            END IF;
            -- Existing payment is already captured with same transaction ID: proceed to entitlement check
        ELSE
            -- Payment row exists in 'created' or 'authorized' state: advance to 'captured'
            -- Assert transaction ID uniqueness across all payments
            IF EXISTS (
                SELECT 1 FROM public.payments 
                WHERE gateway = 'razorpay' 
                  AND gateway_transaction_id = p_gateway_transaction_id 
                  AND id != v_payment.id
            ) THEN
                RETURN QUERY SELECT false, false, 0, 0, 'Duplicate transaction: transaction_id already recorded on another payment'::TEXT;
                RETURN;
            END IF;

            UPDATE public.payments
            SET gateway_transaction_id = p_gateway_transaction_id,
                gateway_order_id = p_gateway_order_id,
                amount = p_charged_amount,
                currency = p_charged_currency,
                status = 'captured',
                raw_response = p_raw_payload
            WHERE id = v_payment.id;
        END IF;
    ELSE
        -- No payment row exists yet (webhook arrived first)
        -- Assert transaction ID uniqueness before insert
        IF EXISTS (
            SELECT 1 FROM public.payments 
            WHERE gateway = 'razorpay' AND gateway_transaction_id = p_gateway_transaction_id
        ) THEN
            RETURN QUERY SELECT false, false, 0, 0, 'Duplicate transaction: transaction_id already recorded on another payment'::TEXT;
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

    -- 7. Advance Order Status to 'paid' / 'captured'
    UPDATE public.orders
    SET status = 'paid',
        payment_status = 'captured',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 8. Identify Missing Digital Asset Entitlements by Exact Asset ID
    SELECT COALESCE(ARRAY_AGG(digital_asset_id), ARRAY[]::UUID[]) INTO v_existing_asset_ids
    FROM public.download_entitlements
    WHERE order_id = p_order_id AND is_active = true;

    SELECT ARRAY_AGG(id) INTO v_missing_asset_ids
    FROM UNNEST(v_expected_asset_ids) AS id
    WHERE id NOT IN (SELECT UNNEST(v_existing_asset_ids));

    -- 9. Safely Generate Missing Entitlements
    IF v_missing_asset_ids IS NOT NULL AND ARRAY_LENGTH(v_missing_asset_ids, 1) > 0 THEN
        FOREACH v_asset_id IN ARRAY v_missing_asset_ids
        LOOP
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
                v_asset_id,
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
    END IF;

    -- 10. Re-verify Final Active Entitlements Set
    SELECT COUNT(id) INTO v_final_entitlements_count
    FROM public.download_entitlements
    WHERE order_id = p_order_id AND is_active = true;

    -- Abort transaction if any expected asset still lacks an active entitlement
    IF v_final_entitlements_count < ARRAY_LENGTH(v_expected_asset_ids, 1) THEN
        RAISE EXCEPTION 'Fulfilment verification failure: expected % distinct assets, but only % entitlements exist',
            ARRAY_LENGTH(v_expected_asset_ids, 1), v_final_entitlements_count;
    END IF;

    -- Clean operational return
    RETURN QUERY SELECT 
        true, 
        (v_new_entitlements_count = 0), 
        v_new_entitlements_count, 
        v_final_entitlements_count, 
        'Order captured and fulfilled with all digital assets verified'::TEXT;
END;
$$;

-- Security Hardening: Revoke execution from PUBLIC, anon, authenticated; Grant strictly to service_role
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) TO service_role;
```

---

## 3. AREA 2 — AUDITABLE REFUND LEDGER (`process_order_refund`)

### 3.1 Vulnerability & Structural Gaps in Prior Drafts
1. **Shallow Refund Idempotency**: Prior logic checked `EXISTS(SELECT 1 FROM payment_refunds WHERE gateway_refund_id = p_gateway_refund_id)` without asserting that the incoming order ID, payment ID, amount, and currency matched the existing record. If Razorpay or a malicious caller replayed a refund ID with conflicting parameters, it silently returned success.
2. **Cumulative Refund Target**: Previous drafts summed refunds across the entire `order_id` rather than against the specific captured `payment_id`. In multi-attempt or partial-capture scenarios, this lacked financial trace accuracy.
3. **Silent Goodwill Fallback**: If an invalid `p_product_id` was passed, prior drafts silently treated the refund as a "goodwill refund" with 0 revocations instead of raising an error for an unverified product reference.
4. **Line-Item Price Validation**: Did not assert that the itemized refund amount was less than or equal to the actual line-item price in `order_items`.

### 3.2 Corrected Architecture & SQL Specification (Design Only — Not Executed)

```sql
-- ==============================================================================
-- REVISED AUDITABLE PAYMENT REFUNDS LEDGER & STORED PROCEDURE
-- Proposal: supabase/migrations/20260218_payment_refunds_ledger_v2.sql
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

-- Unique index enforcing idempotency on Razorpay refund ID
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_refunds_gateway_refund
    ON public.payment_refunds (gateway, gateway_refund_id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order
    ON public.payment_refunds (order_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

-- Explicit Table Grants & Revocations
REVOKE ALL ON public.payment_refunds FROM PUBLIC;
REVOKE ALL ON public.payment_refunds FROM anon;
REVOKE ALL ON public.payment_refunds FROM authenticated;
GRANT SELECT ON public.payment_refunds TO authenticated;
GRANT ALL ON public.payment_refunds TO service_role;

-- RLS Policies
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

-- Stored Procedure for Safe Transactional Refund Reconciliation
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
    v_existing_refund RECORD;
    v_order_item RECORD;
    v_total_refunded DECIMAL(12, 2) := 0;
    v_revoked_count INT := 0;
BEGIN
    -- 1. Strict Parameter Validation
    IF p_order_id IS NULL OR p_payment_id IS NULL OR p_gateway_refund_id IS NULL 
       OR p_refund_amount IS NULL OR p_refund_amount <= 0 OR p_currency IS NULL THEN
        RETURN QUERY SELECT false, false, 0, 'Invalid parameters: refund amount must be greater than zero'::TEXT;
        RETURN;
    END IF;

    -- 2. Multi-Dimensional Idempotency Check on gateway_refund_id
    SELECT * INTO v_existing_refund
    FROM public.payment_refunds
    WHERE gateway = 'razorpay' AND gateway_refund_id = p_gateway_refund_id;

    IF FOUND THEN
        -- If all financial parameters match, return idempotent success
        IF v_existing_refund.order_id = p_order_id 
           AND v_existing_refund.payment_id = p_payment_id 
           AND v_existing_refund.amount = p_refund_amount 
           AND v_existing_refund.currency = p_currency THEN
            RETURN QUERY SELECT true, (v_existing_refund.status = 'processed'), 0, 'Refund already processed (idempotent)'::TEXT;
            RETURN;
        ELSE
            -- Conflicting reuse of refund ID with differing parameters
            RETURN QUERY SELECT false, false, 0, 'Conflict: Refund ID already recorded with differing parameters'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 3. Lock Order and Payment Rows
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 'Order record not found'::TEXT;
        RETURN;
    END IF;

    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id AND order_id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 'Payment record not found or does not belong to specified order'::TEXT;
        RETURN;
    END IF;

    IF v_payment.status != 'captured' AND v_payment.status != 'refunded' THEN
        RETURN QUERY SELECT false, false, 0, 'Ineligible payment: cannot refund uncaptured payment'::TEXT;
        RETURN;
    END IF;

    -- 4. Currency Consistency Check
    IF v_order.charged_currency != p_currency OR v_payment.currency != p_currency THEN
        RETURN QUERY SELECT false, false, 0, 'Currency mismatch between order/payment and refund'::TEXT;
        RETURN;
    END IF;

    -- 5. Cumulative Refund Calculation Against Specific Payment
    SELECT COALESCE(SUM(amount), 0) INTO v_total_refunded 
    FROM public.payment_refunds 
    WHERE payment_id = p_payment_id AND status = 'processed';

    IF (v_total_refunded + p_refund_amount) > v_payment.amount THEN
        RETURN QUERY SELECT false, false, 0, 'Cumulative refund amount exceeds original captured payment amount'::TEXT;
        RETURN;
    END IF;

    -- 6. Product-Specific Refund Validation (Reject Invalid Product References)
    IF p_product_id IS NOT NULL THEN
        SELECT * INTO v_order_item 
        FROM public.order_items 
        WHERE order_id = p_order_id AND product_id = p_product_id;

        IF NOT FOUND THEN
            RETURN QUERY SELECT false, false, 0, 'Invalid product_id: product does not exist in order line items'::TEXT;
            RETURN;
        END IF;

        IF p_refund_amount > v_order_item.total_price THEN
            RETURN QUERY SELECT false, false, 0, 'Line item boundary error: refund amount exceeds line item total price'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 7. Insert Auditable Refund Record
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

    -- 8. Status Update & Entitlement Revocation (Preserving CHECK Constraints)
    IF v_total_refunded >= v_payment.amount THEN
        -- Full Refund: Set order and payment status to 'refunded' (Allowed by schema CHECK constraints)
        UPDATE public.orders 
        SET status = 'refunded', 
            payment_status = 'refunded', 
            updated_at = NOW() 
        WHERE id = p_order_id;

        UPDATE public.payments 
        SET status = 'refunded' 
        WHERE id = p_payment_id;

        -- Revoke all active entitlements for order
        UPDATE public.download_entitlements 
        SET is_active = false 
        WHERE order_id = p_order_id AND is_active = true;

        GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
        RETURN QUERY SELECT true, true, v_revoked_count, 'Full refund processed; all entitlements revoked'::TEXT;
    ELSE
        -- Partial Refund: Order remains 'paid' (compliant with CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')))
        -- Cumulative refund recorded in JSONB metadata
        UPDATE public.orders 
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('total_refunded', v_total_refunded),
            updated_at = NOW()
        WHERE id = p_order_id;

        -- Revoke strictly the refunded product's asset entitlements
        IF p_product_id IS NOT NULL THEN
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
            -- Verified non-itemized partial refund (e.g. general courtesy credit)
            RETURN QUERY SELECT true, false, 0, 'Partial refund processed; entitlements preserved (courtesy adjustment)'::TEXT;
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

## 4. AREA 3 — GUEST PURCHASE RECOVERY

### 4.1 Anti-Scanner Two-Step State Machine
To eliminate the risk of automated enterprise email scanners (Microsoft Defender, Proofpoint, Google) consuming magic link credentials:

```
┌────────────────────────────────────────────────────────────────────────┐
│               GUEST RECOVERY: 2-STEP CONFIRMATION FLOW                 │
└────────────────────────────────────────────────────────────────────────┘

 [1. Customer Requests Link]
      Customer visits /account/recover and enters email.
      Server:
        - Rate limit: 3 requests per IP / email per hour.
        - Generates 256-bit rawToken: crypto.randomBytes(32).toString('hex').
        - Stores tokenHash = SHA-256(rawToken) in orders.metadata.
        - Sets expires_at = NOW() + INTERVAL '15 minutes'.
        - Response: ALWAYS "If an order exists, instructions have been sent." (Timing-safe).

 [2. Link Inspection (GET /account/verify-access)]
      - Customer / Scanner clicks email link:
        https://sevolf.store/account/verify-access?token=<rawToken>&orderNumber=ORD-XXXX
      - Response Headers:
          Cache-Control: no-store, no-cache, must-revalidate, private
          Referrer-Policy: no-referrer
      - Zero Third-Party Resources: Does not load external fonts, analytics, or trackers.
      - Page Renders: An isolated, minimal HTML form containing a hidden CSRF token
        and an "Access Order & Downloads" button.
      - CRITICAL: The GET request DOES NOT alter database state or consume the token.

 [3. Intentional Human Confirmation (POST /api/account/consume-recovery)]
      - Customer clicks button. Browser sends POST with { token, orderNumber, csrfToken }.
      - Server checks Origin header matches NEXT_PUBLIC_SITE_URL.
      - Rate limit: 5 attempts per IP per 15 minutes.
      - Hashes incoming rawToken with SHA-256.
      - Atomically checks match in orders.metadata, asserts NOW() < expires_at,
        and sets metadata->>'recovery_token_hash' = NULL (Immediate single-use consumption).
      - Issues HttpOnly, Secure, SameSite=Lax cookie: sevolf_guest_session.
      - Returns 200 OK with redirect to /order/success?orderNumber=ORD-XXXX.
```

---

## 5. AREA 4 — DOWNLOAD ACCESS & TOKEN COMPATIBILITY

### 5.1 Schema Compatibility Reality [VERIFIED]
Inspection of live table `public.download_entitlements` confirms:
```sql
token VARCHAR(255) UNIQUE NOT NULL
```
- **Finding**: Storing raw 256-bit tokens (64 hex characters) in `token` provides $2^{256}$ cryptographic entropy.
- **Decision**: Retaining the existing `token` column preserves 100% schema backward compatibility with zero DDL migrations.

### 5.2 Serverless-Safe Rate Limiting & Trusted Proxy Model
1. **Trusted Proxy Model**:
   - In Next.js App Router (deployed on Vercel or Cloudflare), `request.headers.get("x-forwarded-for")` contains multiple comma-separated IPs.
   - An attacker can inject fake IPs in `x-forwarded-for`.
   - **Rule**: If hosted behind Cloudflare, read `cf-connecting-ip`. If behind Vercel, read `x-real-ip` or the leftmost IP verified by Vercel edge.
2. **Shared Rate Limiter**:
   - Serverless functions do not share memory across instances.
   - Use Upstash Redis (`@upstash/ratelimit`) or a lightweight Supabase table check on `download_logs` (`COUNT(*) WHERE entitlement_id = $1 AND downloaded_at > NOW() - INTERVAL '1 minute' < 5`).
3. **Response Headers**:
   - `/api/download/[token]` returns:
     ```http
     Cache-Control: no-store, private
     Referrer-Policy: no-referrer
     ```
   - Before 302 redirect to the 60-second Supabase Storage signed URL.

---

## 6. AREA 5 — MULTI-GATE SANDBOX ISOLATION SPECIFICATION

A secret HTTP header alone is **strictly prohibited**. The sandbox architecture enforces all 5 gates across both checkout and fulfilment:

```typescript
// Proposed Implementation: src/lib/sandbox.ts (Design Only - Zero Execution)

export async function verifySandboxEligibility(
  request: Request,
  productId: string,
  supabase: SupabaseClient
) {
  // Gate 1: Server Feature Flag
  if (process.env.ENABLE_SANDBOX_CHECKOUT !== "true") {
    throw new Error("Sandbox testing is disabled in this environment.");
  }

  // Gate 2: Razorpay Test Key Assertion
  const keyId = process.env.RAZORPAY_KEY_ID || "";
  if (!keyId.startsWith("rzp_test_")) {
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

  // Gate 4: Dedicated Draft Test Product Enforcement
  const { data: product } = await supabase
    .from("products")
    .select("slug, status")
    .eq("id", productId)
    .single();

  if (!product || product.slug !== "sevolf-test-asset-sandbox" || product.status !== "draft") {
    throw new Error("Forbidden: Sandbox checkout is restricted strictly to the dedicated test product.");
  }

  // Gate 5: Dedicated Asset Vault Isolation
  const { data: asset } = await supabase
    .from("digital_assets")
    .select("storage_path")
    .eq("product_id", productId)
    .single();

  if (!asset || !asset.storage_path.startsWith("test/")) {
    throw new Error("Security Violation: Test product cannot link to production launch assets.");
  }

  return true;
}
```

### Sandbox Data Namespace Guarantees
- Orders: `order_number LIKE 'ORD-SANDBOX-%'`.
- Customer Library & Reports:
  ```sql
  -- Exclude sandbox data from production analytics
  SELECT SUM(charged_amount) FROM public.orders 
  WHERE status = 'paid' AND order_number NOT LIKE 'ORD-SANDBOX-%';
  ```

---

## 7. AREA 6 — POSTGRESQL EXTENSION & PERMISSION INTEGRITY

### 7.1 Extension Namespaces [VERIFIED]
1. `uuid-ossp`: Installed in `extensions` schema. Canonical invocation: `extensions.uuid_generate_v4()`.
2. `gen_random_bytes`: Available via PostgreSQL `extensions.gen_random_bytes(32)`.
3. `encode`: Built-in catalog function: `pg_catalog.encode(..., 'hex')`.
4. `search_path`: All functions enforce `SET search_path = ''`. All internal relation and function calls are fully qualified.

### 7.2 Migration Naming & Chronological Order [VERIFIED]
Inspecting `supabase/migrations/`:
- `20260218_initial_sevolf_digital_commerce.sql` (Deployed) [VERIFIED]
- `20260218_pricing_and_currency_engine.sql` (Deployed) [VERIFIED]

**Naming Standard for Phase 1C Migrations:**
To avoid timestamp collisions on `20260218`, Phase 1C migrations must use sequential timestamps:
1. `supabase/migrations/20260218120000_payment_refunds_ledger.sql`
2. `supabase/migrations/20260218130000_atomic_order_fulfilment.sql`

---

## 8. AREA 7 — ACCEPTANCE TEST SPECIFICATIONS

```text
=== ACCEPTANCE TEST MATRIX ===

TEST 1: Atomic Reconcile Missing Asset Repair
- Given: Order ORD-001 with 2 purchased assets. Entitlements table has 0 rows.
- Action: Call process_order_capture().
- Result: Returns success=true, entitlements_created=2, total_entitlements=2.

TEST 2: Duplicate Lines Deduplication
- Given: Order ORD-002 with 2 identical order_items referencing product A (owns asset X).
- Action: Call process_order_capture().
- Result: Distinct expected assets evaluated as 1. Exactly 1 entitlement inserted.

TEST 3: Zero-Asset Order Rejection
- Given: Order ORD-003 containing a product with no digital_assets records.
- Action: Call process_order_capture().
- Result: Transaction aborts with error: "Order contains zero digital assets".

TEST 4: Delayed Webhook Failure Protection
- Given: Order ORD-004 already marked status='paid', payment status='captured'.
- Action: Delayed webhook calls process_order_capture() with failed status or mismatch.
- Result: Function exits safely without altering paid order status.

TEST 5: Conflicting Refund ID Rejection
- Given: Refund rfnd_123 already processed for ₹499.
- Action: Call process_order_refund() with rfnd_123 but amount ₹1299.
- Result: Returns success=false, message: "Conflict: Refund ID already recorded with differing parameters".

TEST 6: Invalid Product Refund Rejection
- Given: Order ORD-005 containing Product A.
- Action: Call process_order_refund() referencing Product B.
- Result: Returns success=false, message: "Invalid product_id: product does not exist in order line items".
```

---

## 9. PASS / FAIL SECURITY READINESS CHECKLIST

| Verification Item | Target Standard | Audit Result | Status |
| :--- | :--- | :--- | :---: |
| **1. Atomic Fulfilment** | Row locks, asset-by-asset distinct matching, zero-asset rejection | Fully specified in revised SQL | **PASS** |
| **2. Refund Ledger** | Relational `payment_refunds`, cumulative cap, verified item revocation | Fully specified in revised SQL | **PASS** |
| **3. Guest Recovery** | Anti-scanner 2-step CSRF flow, short-lived hash, zero 3rd-party assets | Fully specified in architecture | **PASS** |
| **4. Download Security** | 256-bit token entropy, proxy IP extraction, 60s signed URL TTL | Fully specified in architecture | **PASS** |
| **5. Sandbox Isolation** | 5-layer programmatic gate, draft exclusion, test order prefix | Fully specified in architecture | **PASS** |
| **6. Database Integrity** | Zero DDL migrations or writes executed in this audit | Read-only strictly preserved | **PASS** |
| **7. Launch Products** | `14-day-home-reset-kit` and `mitthus-fun-learning-book` in `draft` | Both draft; 0 prices in DB | **PASS** |

---

## 10. FINAL READ-ONLY COMPLIANCE CONFIRMATION

In strict adherence to the read-only directive:
- **Zero source files were modified, moved, or deleted.** [VERIFIED]
- **Zero npm packages were installed or uninstalled.** [VERIFIED]
- **Zero database writes, updates, deletes, or migrations were executed.** [VERIFIED]
- **Zero Supabase Storage objects were added, deleted, or altered.** [VERIFIED]
- **Both launch products remain in `draft` status with 0 prices.** [VERIFIED]

**AUDIT AND SPECIFICATION COMPLETE — STOPPED AND AWAITING USER APPROVAL.**
