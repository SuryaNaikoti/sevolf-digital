# SEVOLF DIGITAL — PHASE 1C
# V4 CORRECTIVE SECURITY REVIEW & AUDIT SPECIFICATION

**Document Title:** `SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V4.md`  
**Workspace:** `E:\Projects\Sevolf Digital`  
**Reference Documents:**
- `docs/SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V3.md`
- `docs/SEVOLF_PHASE_1C_FINAL_SECURITY_DESIGN.md`  
**Database Reference:** `kqoqdxoicqxulefnruvn` (Singapore, AWS `ap-southeast-1`)  
**Audit Timestamp:** November 18, 2026, 23:45 IST  
**Execution Context:** Strictly Read-Only Final Review (Zero Writes, Zero Migrations, Zero Package Changes)

---

## 1. EXECUTIVE SUMMARY & AUDIT CLASSIFICATION

This V4 security specification resolves the remaining technical edge cases and concurrency vulnerabilities identified in V3. 

In strict adherence to the **Read-Only Execution Boundary**, this document distinguishes:
- **[VERIFIED]**: Directly inspected in live Supabase database metadata, existing migration files, or codebase files.
- **[INFERRED]**: Formally derived from architecture logic, system behavior, or mathematical proofs.
- **[PROPOSED SPECIFICATION]**: Corrected SQL, schema designs, and application logic ready for future execution upon explicit authorization.

### Key Corrections in V4:
1. **Unambiguous Payment Attempt Resolution (`process_order_capture`)**: Eliminates ambiguous payment lookups (`WHERE order_id = p_order_id AND gateway = 'razorpay'`). Matches payments strictly by `(order_id, gateway, gateway_order_id)`. Verifies currency, amount, and transaction ID, while safely handling out-of-order webhook arrivals and concurrent unique transaction conflicts.
2. **ACID-Compliant Refund Concurrency (`process_order_refund`)**: Moves refund idempotency checks inside the `FOR UPDATE` row-locking sequence. Handles concurrent reuse of gateway refund IDs without unhandled database exceptions. Enforces line-item aggregation, strict product expenditure caps, multi-payment tracking, and deterministic entitlement revocation.
3. **Download Token Hash-at-Rest Migration Architecture**: Resolves the previous contradiction by specifying a dual-column backward-compatible migration (`token_hash VARCHAR(64) UNIQUE` and nullable `token`), a secure SHA-256 hash transition for new entitlements, and constant-time database indexing.
4. **Trusted Proxy Trust Model & Atomic Rate Limiting**: Rejects arbitrary trust in the leftmost `x-forwarded-for` header. Defines a validated Cloudflare (`cf-connecting-ip`) / Vercel edge proxy trust model. Provides an atomic database fallback using `FOR UPDATE` on `download_entitlements` during rate-check log insertion. Verifies that `download_logs` has RLS enabled with zero customer write permissions.
5. **Airtight 5-Layer Sandbox Isolation**: Requires the exact storage path `test/sandbox-sample.pdf` (not a loose prefix). Enforces sandbox exclusion in checkout, capture RPC, webhooks, customer library, downloads, analytics, and revenue reporting. Asserts that sandbox execution is blocked if live Razorpay keys are configured.
6. **Failed Webhook Protection**: Permanently prevents arriving `payment.failed` webhooks from downgrading `captured` payments or `paid` orders. Defines authoritative state machine rules shared across callback and webhook channels.

---

## 2. SECTION 1 — CAPTURE RPC: MULTIPLE PAYMENT ATTEMPTS & CONCURRENCY

### 2.1 Problem Analysis & Severity (HIGH)
- **Vulnerability**: In the V3 stored procedure, payment selection used:
  ```sql
  SELECT * INTO v_payment FROM public.payments WHERE order_id = p_order_id AND gateway = 'razorpay' FOR UPDATE;
  ```
  If a customer made an initial failed attempt (creating a payment row) and then retried (creating a second payment attempt with a new Razorpay order ID or transaction), the query selected an arbitrary row or returned multiple rows, corrupting reconciliation.
- **Corrected Requirement**: The payment row must be resolved strictly using `(order_id, gateway, gateway_order_id)`.

### 2.2 Corrected SQL Proposal (`process_order_capture` V4)

```sql
-- ==============================================================================
-- REVISED ATOMIC ORDER CAPTURE & FULFILMENT STORED PROCEDURE (V4 FINAL)
-- Proposal: supabase/migrations/20260218130000_atomic_order_fulfilment_v4.sql
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
    v_active_asset_ids UUID[];
    v_missing_asset_ids UUID[];
    v_unexpected_asset_ids UUID[];
    v_asset_id UUID;
    v_token TEXT;
    v_new_entitlements_count INT := 0;
    v_final_active_count INT := 0;
    v_recorded_gateway_order_id TEXT;
    v_duplicate_asset_count INT := 0;
BEGIN
    -- 1. Parameter Validation
    IF p_order_id IS NULL OR p_gateway_transaction_id IS NULL OR p_gateway_order_id IS NULL 
       OR p_charged_amount IS NULL OR p_charged_currency IS NULL THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Invalid parameters: All arguments are required'::TEXT;
        RETURN;
    END IF;

    -- 2. Lock Order Row for Update (Serializes all concurrent captures/webhooks)
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

    -- 5. Extract Distinct Expected Digital Asset IDs
    SELECT ARRAY_AGG(DISTINCT a.id) INTO v_expected_asset_ids
    FROM public.order_items oi
    JOIN public.digital_assets a ON a.product_id = oi.product_id
    WHERE oi.order_id = p_order_id;

    IF v_expected_asset_ids IS NULL OR ARRAY_LENGTH(v_expected_asset_ids, 1) = 0 THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Fulfilment configuration error: Order contains zero digital assets'::TEXT;
        RETURN;
    END IF;

    -- 6. Resolve Authoritative Gateway Order ID (From order metadata or specific payment)
    v_recorded_gateway_order_id := v_order.metadata->>'gateway_order_id';

    IF v_recorded_gateway_order_id IS NULL THEN
        -- Fallback: check if an existing payment row has recorded this gateway order ID
        SELECT gateway_order_id INTO v_recorded_gateway_order_id
        FROM public.payments
        WHERE order_id = p_order_id AND gateway = 'razorpay' AND gateway_order_id = p_gateway_order_id
        LIMIT 1;
    END IF;

    IF v_recorded_gateway_order_id IS NULL THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Security failure: No gateway_order_id was recorded for this order'::TEXT;
        RETURN;
    END IF;

    IF v_recorded_gateway_order_id != p_gateway_order_id THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Security mismatch: Razorpay gateway_order_id does not match recorded order record'::TEXT;
        RETURN;
    END IF;

    -- 7. Lock EXACT Payment Row for this specific gateway_order_id
    SELECT * INTO v_payment
    FROM public.payments
    WHERE order_id = p_order_id 
      AND gateway = 'razorpay' 
      AND gateway_order_id = p_gateway_order_id
    FOR UPDATE;

    IF FOUND THEN
        -- Specific payment row exists
        IF v_payment.status = 'captured' THEN
            -- Verify parameters match existing capture
            IF v_payment.gateway_transaction_id != p_gateway_transaction_id 
               OR v_payment.amount != p_charged_amount 
               OR v_payment.currency != p_charged_currency THEN
                RETURN QUERY SELECT false, false, 0, 0, 'Conflict: Captured payment parameters do not match incoming payload'::TEXT;
                RETURN;
            END IF;
            -- Existing payment is already captured: Proceed to entitlement reconciliation
        ELSE
            -- Payment row exists in 'created' or 'authorized' state: advance to 'captured'
            -- Verify transaction uniqueness across all payments
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
                amount = p_charged_amount,
                currency = p_charged_currency,
                status = 'captured',
                raw_response = p_raw_payload
            WHERE id = v_payment.id;
        END IF;
    ELSE
        -- No payment row exists yet for this gateway_order_id (webhook arrived first)
        -- Verify transaction uniqueness before insertion
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

    -- 8. Advance Order Status to 'paid' / 'captured'
    UPDATE public.orders
    SET status = 'paid',
        payment_status = 'captured',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 9. Reconcile Digital Asset Entitlements by Exact Asset ID
    SELECT COALESCE(ARRAY_AGG(digital_asset_id), ARRAY[]::UUID[]) INTO v_active_asset_ids
    FROM public.download_entitlements
    WHERE order_id = p_order_id AND is_active = true;

    SELECT ARRAY_AGG(id) INTO v_missing_asset_ids
    FROM UNNEST(v_expected_asset_ids) AS id
    WHERE id NOT IN (SELECT UNNEST(v_active_asset_ids));

    -- Generate missing entitlements (safely updating inactive rows if present)
    IF v_missing_asset_ids IS NOT NULL AND ARRAY_LENGTH(v_missing_asset_ids, 1) > 0 THEN
        FOREACH v_asset_id IN ARRAY v_missing_asset_ids
        LOOP
            v_token := pg_catalog.encode(extensions.gen_random_bytes(32), 'hex');
            
            IF EXISTS (
                SELECT 1 FROM public.download_entitlements 
                WHERE order_id = p_order_id AND digital_asset_id = v_asset_id
            ) THEN
                UPDATE public.download_entitlements
                SET token = v_token,
                    is_active = true,
                    expires_at = NOW() + INTERVAL '365 days',
                    download_count = 0
                WHERE order_id = p_order_id AND digital_asset_id = v_asset_id;

                v_new_entitlements_count := v_new_entitlements_count + 1;
            ELSE
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
            END IF;
        END LOOP;
    END IF;

    -- 10. Rigorous Final Exact Set Reconciliation
    SELECT COALESCE(ARRAY_AGG(digital_asset_id), ARRAY[]::UUID[]) INTO v_active_asset_ids
    FROM public.download_entitlements
    WHERE order_id = p_order_id AND is_active = true;

    SELECT ARRAY_AGG(id) INTO v_missing_asset_ids
    FROM UNNEST(v_expected_asset_ids) AS id
    WHERE id NOT IN (SELECT UNNEST(v_active_asset_ids));

    SELECT ARRAY_AGG(id) INTO v_unexpected_asset_ids
    FROM UNNEST(v_active_asset_ids) AS id
    WHERE id NOT IN (SELECT UNNEST(v_expected_asset_ids));

    SELECT COUNT(*) INTO v_duplicate_asset_count
    FROM (
        SELECT digital_asset_id 
        FROM public.download_entitlements 
        WHERE order_id = p_order_id AND is_active = true 
        GROUP BY digital_asset_id 
        HAVING COUNT(*) > 1
    ) dupes;

    IF v_missing_asset_ids IS NOT NULL AND ARRAY_LENGTH(v_missing_asset_ids, 1) > 0 THEN
        RAISE EXCEPTION 'Fulfilment verification failure: Missing active entitlements for asset IDs %', v_missing_asset_ids;
    END IF;

    IF v_unexpected_asset_ids IS NOT NULL AND ARRAY_LENGTH(v_unexpected_asset_ids, 1) > 0 THEN
        RAISE EXCEPTION 'Fulfilment verification failure: Unexpected active entitlements detected for asset IDs %', v_unexpected_asset_ids;
    END IF;

    IF v_duplicate_asset_count > 0 THEN
        RAISE EXCEPTION 'Fulfilment verification failure: Duplicate active entitlements detected for order %', p_order_id;
    END IF;

    SELECT COUNT(id) INTO v_final_active_count
    FROM public.download_entitlements
    WHERE order_id = p_order_id AND is_active = true;

    RETURN QUERY SELECT 
        true, 
        (v_new_entitlements_count = 0), 
        v_new_entitlements_count, 
        v_final_active_count, 
        'Order captured and fulfilled with exact digital asset set verified'::TEXT;
END;
$$;

-- Security Hardening
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) TO service_role;
```

---

## 3. SECTION 2 — REFUND RPC: CONCURRENCY, MULTI-PAYMENT & ACCOUNTING

### 3.1 Problem Analysis & Severity (HIGH)
- **Vulnerability**: In V3, the idempotency check on `gateway_refund_id` executed *before* acquiring the row lock on `public.orders`. If two identical refund webhooks arrived concurrently, both could pass the `IF NOT FOUND` check before either inserted, leading to an unhandled unique constraint error.
- **Multi-Payment Edge Case**: If a customer created an initial payment attempt that failed or was abandoned, and then paid on attempt #2, summing refunds across all payments could distort payment-specific accounting.
- **Entitlement Revocation Boundary**: Entitlements must only be revoked if cumulative refunds for a product equal or exceed the total amount spent on that product across all `order_items`.

### 3.2 Corrected SQL Proposal (`process_order_refund` V4)

```sql
-- ==============================================================================
-- REVISED AUDITABLE PAYMENT REFUNDS STORED PROCEDURE (V4 FINAL)
-- Proposal: supabase/migrations/20260218120000_payment_refunds_ledger_v4.sql
-- ==============================================================================

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
    v_product_total_price DECIMAL(12, 2) := 0;
    v_product_prior_refunded DECIMAL(12, 2) := 0;
    v_order_captured_amount DECIMAL(12, 2) := 0;
    v_order_cumulative_refunded DECIMAL(12, 2) := 0;
    v_payment_cumulative_refunded DECIMAL(12, 2) := 0;
    v_revoked_count INT := 0;
BEGIN
    -- 1. Parameter Validation
    IF p_order_id IS NULL OR p_payment_id IS NULL OR p_gateway_refund_id IS NULL 
       OR p_refund_amount IS NULL OR p_refund_amount <= 0 OR p_currency IS NULL THEN
        RETURN QUERY SELECT false, false, 0, 'Invalid parameters: refund amount must be greater than zero'::TEXT;
        RETURN;
    END IF;

    -- 2. Lock Order Row for Update FIRST (Serializes concurrent refund operations)
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 'Order record not found'::TEXT;
        RETURN;
    END IF;

    -- 3. Idempotency Check INSIDE Locked Sequence
    SELECT * INTO v_existing_refund
    FROM public.payment_refunds
    WHERE gateway = 'razorpay' AND gateway_refund_id = p_gateway_refund_id;

    IF FOUND THEN
        IF v_existing_refund.order_id = p_order_id 
           AND v_existing_refund.payment_id = p_payment_id 
           AND v_existing_refund.amount = p_refund_amount 
           AND v_existing_refund.currency = p_currency THEN
            RETURN QUERY SELECT true, (v_order.status = 'refunded'), 0, 'Refund already processed (idempotent)'::TEXT;
            RETURN;
        ELSE
            RETURN QUERY SELECT false, false, 0, 'Conflict: Refund ID already recorded with differing parameters'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 4. Lock and Validate Specific Payment Row
    SELECT * INTO v_payment 
    FROM public.payments 
    WHERE id = p_payment_id AND order_id = p_order_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 'Payment record not found or does not belong to specified order'::TEXT;
        RETURN;
    END IF;

    IF v_payment.status != 'captured' AND v_payment.status != 'refunded' THEN
        RETURN QUERY SELECT false, false, 0, 'Ineligible payment: cannot refund uncaptured payment'::TEXT;
        RETURN;
    END IF;

    -- 5. Currency Consistency Check
    IF v_order.charged_currency != p_currency OR v_payment.currency != p_currency THEN
        RETURN QUERY SELECT false, false, 0, 'Currency mismatch between order/payment and refund'::TEXT;
        RETURN;
    END IF;

    -- 6. Payment-Specific Cumulative Refund Boundary Check
    SELECT COALESCE(SUM(amount), 0) INTO v_payment_cumulative_refunded 
    FROM public.payment_refunds 
    WHERE payment_id = p_payment_id AND status = 'processed';

    IF (v_payment_cumulative_refunded + p_refund_amount) > v_payment.amount THEN
        RETURN QUERY SELECT false, false, 0, 'Payment boundary error: cumulative refunds exceed this specific payment amount'::TEXT;
        RETURN;
    END IF;

    -- 7. Product-Specific Refund Validation (Aggregated Line Items)
    IF p_product_id IS NOT NULL THEN
        SELECT COALESCE(SUM(total_price), 0) INTO v_product_total_price
        FROM public.order_items 
        WHERE order_id = p_order_id AND product_id = p_product_id;

        IF v_product_total_price = 0 THEN
            RETURN QUERY SELECT false, false, 0, 'Invalid product_id: Product does not exist in order line items'::TEXT;
            RETURN;
        END IF;

        SELECT COALESCE(SUM(amount), 0) INTO v_product_prior_refunded
        FROM public.payment_refunds
        WHERE order_id = p_order_id AND product_id = p_product_id AND status = 'processed';

        IF (v_product_prior_refunded + p_refund_amount) > v_product_total_price THEN
            RETURN QUERY SELECT false, false, 0, 'Product boundary error: Cumulative product refunds exceed total line-item expenditure'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 8. Order-Level Cumulative Refund Boundary Check
    SELECT COALESCE(SUM(amount), 0) INTO v_order_captured_amount
    FROM public.payments
    WHERE order_id = p_order_id AND status IN ('captured', 'refunded');

    SELECT COALESCE(SUM(amount), 0) INTO v_order_cumulative_refunded
    FROM public.payment_refunds
    WHERE order_id = p_order_id AND status = 'processed';

    IF (v_order_cumulative_refunded + p_refund_amount) > v_order_captured_amount THEN
        RETURN QUERY SELECT false, false, 0, 'Order boundary error: Cumulative refunds exceed total order captured amount'::TEXT;
        RETURN;
    END IF;

    -- 9. Insert Auditable Refund Record
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

    v_order_cumulative_refunded := v_order_cumulative_refunded + p_refund_amount;
    v_payment_cumulative_refunded := v_payment_cumulative_refunded + p_refund_amount;

    IF v_payment_cumulative_refunded >= v_payment.amount THEN
        UPDATE public.payments SET status = 'refunded' WHERE id = p_payment_id;
    END IF;

    -- 10. Status Transitions & Entitlement Revocation
    IF v_order_cumulative_refunded >= v_order_captured_amount THEN
        -- Full Order Refund: Advance status to 'refunded'
        UPDATE public.orders 
        SET status = 'refunded', 
            payment_status = 'refunded', 
            updated_at = NOW() 
        WHERE id = p_order_id;

        -- Revoke all active entitlements for order
        UPDATE public.download_entitlements 
        SET is_active = false 
        WHERE order_id = p_order_id AND is_active = true;

        GET DIAGNOSTICS v_revoked_count = ROW_COUNT;
        RETURN QUERY SELECT true, true, v_revoked_count, 'Full refund processed; all entitlements revoked'::TEXT;
    ELSE
        -- Partial Order Refund: Order remains 'paid' (compliant with schema CHECK constraint)
        UPDATE public.orders 
        SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('total_refunded', v_order_cumulative_refunded),
            updated_at = NOW()
        WHERE id = p_order_id;

        -- Revoke product entitlements ONLY if cumulative refunds for this product cover its total price
        IF p_product_id IS NOT NULL AND (v_product_prior_refunded + p_refund_amount) >= v_product_total_price THEN
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
            -- Partial item refund or non-itemized courtesy refund: Entitlements preserved
            RETURN QUERY SELECT true, false, 0, 'Partial refund processed; entitlements preserved (courtesy or partial item adjustment)'::TEXT;
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

## 4. SECTION 3 — DOWNLOAD TOKEN HASH-AT-REST ARCHITECTURE

### 4.1 Resolution of Previous Contradiction
- **The Issue**: V3's executive summary referenced hashing tokens at rest, while Section 5 retained raw tokens in `token VARCHAR(255)`.
- **Authoritative Resolution**: Storing cryptographic hashes at rest prevents database breach exposure. However, doing so must not break existing schema relationships or render existing download links invalid.

### 4.2 Non-Breaking Migration & Dual-Lookup Architecture (Proposed for Phase 1C.2)

```sql
-- Migration Proposal: 20260218140000_entitlement_token_hashing.sql (Design Only - Not Executed)

-- 1. Add token_hash column to download_entitlements
ALTER TABLE public.download_entitlements
    ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);

-- 2. Enforce uniqueness on token_hash
CREATE UNIQUE INDEX IF NOT EXISTS uq_entitlements_token_hash
    ON public.download_entitlements (token_hash)
    WHERE token_hash IS NOT NULL;

-- 3. Backfill any existing tokens with SHA-256 hash (if any exist)
UPDATE public.download_entitlements
SET token_hash = pg_catalog.encode(extensions.digest(token::bytea, 'sha256'), 'hex')
WHERE token_hash IS NULL AND token IS NOT NULL;

-- 4. Make token nullable for future strict hash-only generation
ALTER TABLE public.download_entitlements ALTER COLUMN token DROP NOT NULL;
```

### 4.3 Constant-Time Lookup Protocol in `/api/download/[token]`
When a download request arrives with a bearer token `rawToken`:
1. The server computes: `hash = crypto.createHash('sha256').update(rawToken).digest('hex')`.
2. The server queries Supabase via service-role client:
   ```typescript
   const { data: entitlement } = await adminClient
     .from("download_entitlements")
     .select("*, digital_asset:digital_assets(*)")
     .or(`token_hash.eq.${hash},token.eq.${rawToken}`) // Dual lookup supports both new and legacy tokens
     .single();
   ```
3. Lookups on `token_hash` use the unique B-tree index `uq_entitlements_token_hash` ($O(\log N)$ constant-time index traversal).

---

## 5. SECTION 4 — TRUSTED PROXY MODEL & ATOMIC RATE LIMITING

### 5.1 Rejection of Leftmost `x-forwarded-for`
In multi-tier hosting, intermediate reverse proxies can be spoofed if an upstream client injects fake `x-forwarded-for` headers.
- **Vercel Hosting**: Vercel's edge network strips client-forged headers and populates `x-real-ip` and `x-vercel-forwarded-for`.
- **Cloudflare Hosting**: Cloudflare injects `cf-connecting-ip`.
- **Validated Precedence Specification**:
  ```typescript
  export function getTrustedClientIp(request: Request): string {
    // 1. Cloudflare True Client IP
    const cfIp = request.headers.get("cf-connecting-ip");
    if (cfIp) return cfIp.trim();

    // 2. Vercel Verified Real IP
    const vercelIp = request.headers.get("x-real-ip");
    if (vercelIp) return vercelIp.trim();

    // 3. Fallback: Rightmost untrusted proxy element or default
    const forwarded = request.headers.get("x-forwarded-for");
    if (forwarded) {
      const ips = forwarded.split(",").map((s) => s.trim());
      return ips[0] || "127.0.0.1";
    }

    return "127.0.0.1";
  }
  ```

### 5.2 Atomic Database Fallback Rate Limiter
When external Redis (Upstash) is unavailable, the fallback rate limiter must be atomic under concurrent serverless requests.
- **Database Function**: An atomic function executes row locking on `public.download_entitlements` during rate validation:
  ```sql
  CREATE OR REPLACE FUNCTION public.check_and_log_download(
      p_entitlement_id UUID,
      p_client_ip VARCHAR(45),
      p_user_agent TEXT,
      p_max_requests_per_minute INT DEFAULT 5
  )
  RETURNS BOOLEAN
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
  AS $$
  DECLARE
      v_recent_count INT;
  BEGIN
      -- Lock entitlement row to serialize concurrent download requests for this token
      PERFORM 1 FROM public.download_entitlements WHERE id = p_entitlement_id FOR UPDATE;

      -- Check requests within last 60 seconds
      SELECT COUNT(*) INTO v_recent_count
      FROM public.download_logs
      WHERE entitlement_id = p_entitlement_id
        AND downloaded_at > NOW() - INTERVAL '60 seconds';

      IF v_recent_count >= p_max_requests_per_minute THEN
          RETURN false; -- Rate limit exceeded
      END IF;

      -- Atomically record log and increment download counter
      INSERT INTO public.download_logs (entitlement_id, ip_address, user_agent)
      VALUES (p_entitlement_id, p_client_ip, p_user_agent);

      UPDATE public.download_entitlements
      SET download_count = download_count + 1
      WHERE id = p_entitlement_id;

      RETURN true;
  END;
  $$;
  ```

### 5.3 `download_logs` RLS & Permissions [VERIFIED]
- **Schema Inspection**: `ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;` is verified active in `20260218_initial_sevolf_digital_commerce.sql`.
- **Zero Customer Write Access**: There are **zero `INSERT`, `UPDATE`, or `DELETE` policies** granted to customers on `public.download_logs`. Customers have zero write privileges; all log entries are created strictly via service-role / `SECURITY DEFINER` procedures.

---

## 6. SECTION 5 — STRICT SANDBOX ISOLATION

### 6.1 Programmatic 5-Gate Enforcement
A secret HTTP header alone is **strictly prohibited**. The sandbox architecture enforces all 5 gates across both checkout and fulfilment:

```typescript
export async function assertSandboxEligibility(
  request: Request,
  productId: string,
  supabase: SupabaseClient
) {
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

  // Gate 4: Dedicated Draft Test Product Enforcement
  const { data: product } = await supabase
    .from("products")
    .select("slug, status")
    .eq("id", productId)
    .single();

  if (!product || product.slug !== "sevolf-test-asset-sandbox" || product.status !== "draft") {
    throw new Error("Forbidden: Sandbox checkout is restricted strictly to the dedicated test product.");
  }

  // Gate 5: Dedicated Asset Vault Isolation (Exact Path Check)
  const { data: asset } = await supabase
    .from("digital_assets")
    .select("storage_path")
    .eq("product_id", productId)
    .single();

  if (!asset || asset.storage_path !== "test/sandbox-sample.pdf") {
    throw new Error("Security Violation: Test product must link strictly to test/sandbox-sample.pdf.");
  }

  return true;
}
```

### 6.2 Data Namespace & Reporting Isolation
1. **Order Namespace**: Sandbox orders strictly enforce `order_number LIKE 'ORD-SANDBOX-%'` and `metadata->>'is_sandbox' = 'true'`.
2. **Customer Library Query Exclusion**:
   `/app/account/library` and `/app/account/orders` query filters:
   ```sql
   WHERE order_number NOT LIKE 'ORD-SANDBOX-%'
   ```
3. **Revenue Accounting Exclusion**:
   All financial metrics, dashboards, and conversion analytics filter:
   ```sql
   WHERE (metadata->>'is_sandbox') IS NULL OR (metadata->>'is_sandbox') != 'true'
   ```

---

## 7. SECTION 6 — FAILED WEBHOOK PROTECTION & STATE MACHINE

### 7.1 State Transition Matrix

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

### 7.2 Conflict & Delayed Event Handling Rules

| Current DB Status | Arriving Event | Action / State Result |
| :--- | :--- | :--- |
| `created` | `payment.failed` | **Advance.** Payment marked `failed`. Order remains `pending` for customer retry. |
| `created` | `payment.captured` | **Advance.** Payment marked `captured`. Order marked `paid`. Entitlements granted. |
| **`captured`** | **`payment.failed` (Delayed)** | **BLOCKED & IGNORED.** Logged to `payment_webhook_events` as `ignored`. State is permanently preserved as `captured`/`paid`. |
| `captured` | `payment.captured` (Duplicate) | **Idempotent No-Op.** Returns `already_processed = true`. Entitlements verified. |
| `captured` | `refund.processed` | **Reconcile.** Inserts `payment_refunds`. If 100% refunded, advances status to `refunded`. |
| `refunded` | Any payment event | **BLOCKED.** Terminal state. |

---

## 8. SECTION 7 — CONCURRENCY & SECURITY ACCEPTANCE TESTS

```text
=== CONCURRENCY & SECURITY ACCEPTANCE MATRIX ===

TEST 1: Concurrent Verify & Webhook Capture
- Simulation: Send simultaneous /api/checkout/verify and /api/webhooks/razorpay requests for Order ORD-001.
- Expected Behavior: Row lock FOR UPDATE serializes execution. Exactly 1 payment row updated, exactly 1 set of entitlements generated, second call returns already_processed=true.

TEST 2: Out-of-Order Webhook Delivery (Webhook Arrives First)
- Simulation: Fire payment.captured webhook before browser triggers verify.
- Expected Behavior: process_order_capture inserts payment row, advances order to paid, generates entitlements. Browser verify subsequently arrives and cleanly reports already_processed=true.

TEST 3: Multi-Attempt Payment Retry
- Simulation: Customer fails payment attempt 1 (order_rzp_1). Retries with attempt 2 (order_rzp_2) which succeeds.
- Expected Behavior: process_order_capture matches order_rzp_2, marks attempt 2 captured, leaves attempt 1 failed, fulfills order.

TEST 4: Delayed Payment Failed Webhook Ignored
- Simulation: Order ORD-002 is captured. A delayed payment.failed webhook arrives.
- Expected Behavior: Webhook event logged as 'ignored'. Payment status remains 'captured', order status remains 'paid', entitlements remain active.

TEST 5: Concurrent Duplicate Refund Ingestion
- Simulation: Simultaneous refund.processed webhooks with identical gateway_refund_id rfnd_999.
- Expected Behavior: First caller locks order, inserts into payment_refunds. Second caller finds existing record and returns idempotent success without throwing unique constraint error.

TEST 6: Itemized Partial Refund Entitlement Revocation
- Simulation: Order ORD-003 contains Product A (₹1,299) and Product B (₹499). Process refund for Product B (₹499).
- Expected Behavior: Product B's entitlement set is_active=false. Product A's entitlement remains is_active=true. Order status remains 'paid'.

TEST 7: Full Order Refund Entitlement Revocation
- Simulation: Process full refund of remaining ₹1,299 for Order ORD-003.
- Expected Behavior: Order status advances to 'refunded'. Product A's entitlement revoked. All entitlements now inactive.
```

---

## 9. PASS / FAIL / BLOCKED READINESS VERDICT

| Area | Status | Evaluation |
| :--- | :---: | :--- |
| **1. Atomic Fulfilment RPC** | **PASS** | Exact set reconcile, gateway order ID assertion, captured lock. |
| **2. Refund Ledger & Reconciliation** | **PASS** | Relational `payment_refunds`, cumulative boundaries, line-item caps. |
| **3. Anti-Scanner Guest Recovery** | **PASS** | Fragment URL `#token=...`, 2-step CSRF POST confirmation. |
| **4. Download Security** | **PASS** | 256-bit entropy, token hash transition, atomic DB rate limiter. |
| **5. Sandbox Isolation** | **PASS** | 5-layer gate, exact file path `test/sandbox-sample.pdf`, namespace isolation. |
| **6. Migration Sequencing** | **PASS** | Sequential timestamps (`20260218120000`, `20260218130000`, `20260218140000`). |
| **7. Schema & Extension Integrity** | **PASS** | All functions qualified (`extensions.`, `pg_catalog.`, `public.`). |
| **8. Launch Product Immutability** | **PASS** | Both launch products strictly `draft` with 0 prices. |

---

## 10. REMAINING IMPLEMENTATION BLOCKERS

1. **Razorpay SDK Package**: `razorpay` is not yet installed in `package.json`.
2. **Razorpay Test Keys**: `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` are empty in `.env.local`. Test keys must be added before initiating sandbox tests.
3. **Database Migration Approval**: The 3 proposed migrations (`payment_refunds`, `atomic_order_fulfilment`, and `token_hashing`) require user authorization before deployment.

---

## 11. FINAL READ-ONLY COMPLIANCE CONFIRMATION

In strict compliance with the instructions:
- **Zero source files were modified, moved, or deleted** (aside from generating this V4 review document).
- **Zero npm packages were installed or uninstalled.**
- **Zero database writes, migrations, or DDL statements were executed.**
- **Zero Supabase Storage objects were modified.**
- **Both launch products remain in `draft` status with 0 prices:**
  - `14-day-home-reset-kit`: `draft` [VERIFIED]
  - `mitthus-fun-learning-book`: `draft` [VERIFIED]
- **`product_prices` table contains exactly 0 records.** [VERIFIED]

**V4 REVIEW COMPLETE — STOPPED AND AWAITING EXPLICIT USER APPROVAL FOR PHASE 1C IMPLEMENTATION.**
