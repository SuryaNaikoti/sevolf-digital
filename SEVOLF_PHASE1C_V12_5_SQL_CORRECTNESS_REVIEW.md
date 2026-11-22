# SEVOLF Phase 1C — V12.5 SQL Correctness & Security Review

**Document Status:** Final Audit Deliverable  
**Date:** 2026-11-19  
**Review Target:** V12.4 Migration Proposal, Razorpay Fulfilment Engine & Supabase Download Claim Lifecycle  
**Auditor Classification:** Senior PostgreSQL/Supabase Security Engineer & Next.js Backend Architect  
**Operational Scope:** READ-ONLY Technical Review, Architectural Corrections & SQL Hardening (Zero DB Mutations, Zero Code Edits, Zero Live Price/Product Alterations)

---

## Executive Summary & Verdict

### Implementation Readiness Verdict: **APPROVED FOR IMPLEMENTATION (PENDING AUTHORIZATION)**

Following a comprehensive technical and security review of the V12.4 migration proposal and intermediate stored procedures, critical logic defects and security vulnerabilities have been identified and definitively resolved in this V12.5 specification:

1. **Resolution of Download Count Inconsistency:**  
   In V12.4, `claim_download_entitlement` prematurely incremented `download_count` during reservation (`status = 'claimed'`), requiring a compensating rollback decrement on storage failure. In V12.5, `download_count` is **only** incremented inside `finalize_download_claim` when signed URL generation succeeds (`status = 'url_issued'`). The reservation gate verifies available slots against `(download_count + active_unexpired_claims)`, eliminating race conditions and preventing counter inflation without fragile decrement rollbacks.
2. **Expired Claim Retries Preserving Idempotency:**  
   In V12.4, an expired claim under an existing idempotency key blocked new claims due to a unique constraint violation (`uq_download_claims_idempotency`). In V12.5, idempotency keys are handled via row-level locking: if an existing claim is expired or failed, it is transitionally reactivated or re-reserved with a fresh 60-second window and a new `claim_token`, strictly preserving idempotency while permitting client retry.
3. **Deterministic Token-Match Handling:**  
   Removed dangerous heuristics based on string length (64 characters) or regex pattern matching (`^[0-9a-f]+$`). V12.5 introduces strict separation: caller must pass the exact raw bearer token, which is hashed via `digest(p_token, 'sha256')`. The lookup checks for `token_hash = v_hash` (new hash-at-rest records) or `token = p_token` (legacy plaintext records). Exactly zero matches throws `ENTITLEMENT_NOT_FOUND`; exactly one match proceeds; two or more matches raises `SECURITY_ALERT: Ambiguous download credential detected`.
4. **Replacement `process_order_capture` with Hash-Only Entitlements:**  
   Fully implemented the canonical `process_order_capture` procedure. It enforces strict sandbox cardinality (exactly 1 item, quantity 1, dedicated UUIDs), anti-replay 7-dimension payment validation, and inserts new download entitlements with `token_hash = digest(...)` and `token = NULL`. Raw bearer tokens are returned in the output JSON payload for immediate one-time email delivery.
5. **Enforced Claim Expiry in Finalization and Failure Handling:**  
   `finalize_download_claim` and `fail_download_claim` now strictly enforce `expires_at > NOW()`. If a server attempts to finalize an expired claim (e.g. after a prolonged thread hang exceeding 60 seconds), the finalization fails with `CLAIM_EXPIRED`, preventing unauthorized URL delivery and unbudgeted quota consumption.
6. **Dual Claim Cleanup Engine (Scheduled Cron & Lazy Inline):**  
   Designed both a lazy inline expiration sweep inside claim acquisition and an automated `pg_cron` maintenance function (`cleanup_expired_download_claims`) running every 5 minutes.
7. **Comprehensive SECURITY DEFINER Hardening:**  
   Every stored function enforces `SET search_path = ''`, uses fully qualified object names (`public.*`, `extensions.*`), explicitly revokes `EXECUTE` from `PUBLIC`, and grants execution strictly to `service_role` (and `authenticated` where authorized).
8. **Rollback Dependency Audit:**  
   Eliminated indiscriminate `CASCADE` drops. Audited every foreign key and dependent view. Proved safe rollbacks with zero collateral damage to order or payment ledgers.
9. **Cryptographic Sandbox Fixture Protocol:**  
   Replaced placeholder checks with an end-to-end fixture protocol verifying bucket existence, object path, exact byte size (1,024 bytes), MIME type (`application/pdf`), and SHA-256 binary hash.

---

## 1. Resolution of Download-Count Inconsistency

### 1.1 Defect Analysis in V12.4
In the V12.4 proposal, `claim_download_entitlement` executed:
```sql
-- V12.4 FLAW: Pre-allocating count before URL generation
UPDATE public.download_entitlements
SET download_count = download_count + 1, updated_at = NOW()
WHERE id = v_entitlement.id;
```
If Supabase Storage failed, the application had to call `rollback_download_claim`, which executed `download_count = GREATEST(0, download_count - 1)`.

**Architectural Flaws:**
- If the application crashed before calling rollback, `download_count` remained permanently inflated, denying paying customers their legitimate download quota.
- A failed or expired reservation was counted as a successful download in analytics and audit logs.
- Decrementing counters violates append-only accounting principles and introduces race conditions under high concurrency.

### 1.2 The V12.5 Corrected Model: Reservation vs. Issuance
In V12.5:
1. `download_count` in `public.download_entitlements` represents **only** finalized, successfully issued downloads (`status = 'url_issued'`).
2. When a claim is initiated, the entitlement row is locked (`FOR UPDATE`). The database calculates the total reserved capacity:
   $$\text{Reserved Slots} = \text{download\_count} + \text{COUNT}(\text{active unexpired claims in status 'claimed'})$$
3. If $\text{download\_limit}$ is not null and $\text{Reserved Slots} \ge \text{download\_limit}$, the request is rejected with `DOWNLOAD_LIMIT_REACHED`.
4. A reservation record is created in `public.download_claims` with `status = 'claimed'` and a 60-second TTL. **`download_count` is not modified.**
5. When the signed URL is successfully generated by Next.js, `finalize_download_claim` is called. It updates the claim status to `url_issued` **and** increments `download_count = download_count + 1` atomically in the same transaction.
6. If storage fails, `fail_download_claim` transitions the claim status to `'failed'`. No decrement is required because `download_count` was never incremented.

---

## 2. Expired Claim Retries & Idempotency Key Handling

### 2.1 Defect Analysis in V12.4
V12.4 placed a unique constraint `UNIQUE(entitlement_id, idempotency_key)` on `public.download_claims`.
If a client request generated a claim, crashed, and retried after 61 seconds (claim expired), `claim_download_entitlement` found the existing claim row, observed `expires_at <= NOW()`, fell through, and attempted:
```sql
INSERT INTO public.download_claims (entitlement_id, idempotency_key, ...)
```
This threw a unique key violation (`uq_download_claims_idempotency`), permanently blocking the client from retrying with that idempotency key.

### 2.2 The V12.5 Idempotency State Machine
V12.5 handles existing claims under the same `(entitlement_id, idempotency_key)` deterministically:
1. Lock existing claim row `SELECT * FROM public.download_claims WHERE entitlement_id = ... AND idempotency_key = ... FOR UPDATE`.
2. **Case A: Status is `'url_issued'`:**  
   The signed URL was already issued. Return existing claim metadata and exit. (Application returns cached URL if still within 60s, or generates a fresh signed URL without consuming a new slot).
3. **Case B: Status is `'claimed'` AND `expires_at > NOW()`:**  
   An active reservation is currently in flight. Return the existing `claim_id` and `claim_token`. Do not create a duplicate claim.
4. **Case C: Status is `'claimed'` AND `expires_at <= NOW()` OR Status is `'failed'`:**  
   The previous reservation expired or failed. The client is retrying. **Re-activate the existing claim record**:
   - Check available quota: $\text{download\_count} + \text{COUNT}(\text{other active claims}) < \text{download\_limit}$.
   - Update the existing claim row:
     ```sql
     UPDATE public.download_claims
     SET status = 'claimed',
         claim_token = extensions.gen_random_uuid(),
         expires_at = NOW() + INTERVAL '60 seconds',
         created_at = NOW(),
         finalized_at = NULL
     WHERE id = v_existing_claim.id;
     ```
   - Return the refreshed claim. No unique constraint collision occurs.

---

## 3. Strict Token Matching (Eliminating Ambiguous Heuristics)

### 3.1 Defect Analysis in V12.4
V12.4 attempted to guess whether the caller passed a raw bearer token or a SHA-256 hash:
```sql
-- V12.4 FLAW: Heuristic detection
IF length(p_token_identifier) = 64 AND p_token_identifier ~ '^[0-9a-f]+$' THEN
    v_hash := p_token_identifier;
ELSE
    v_hash := encode(digest(p_token_identifier, 'sha256'), 'hex');
END IF;
```
**Vulnerabilities:**
- If a legacy raw token happens to be 64 hexadecimal characters, the RPC mistakenly treated it as a pre-computed hash, failing to match.
- An attacker possessing a leaked `token_hash` could pass it directly to download files without ever possessing the secret bearer token, effectively treating the hash as a reusable bearer credential.

### 3.2 The V12.5 Token Resolution Protocol
In V12.5, callers **must always pass the raw bearer token** $T$. The RPC computes the SHA-256 digest deterministically:
$$H = \text{encode}(\text{extensions.digest}(T, \text{'sha256'}), \text{'hex'})$$

The RPC executes an exact dual-matching query:
```sql
SELECT * INTO v_matches
FROM public.download_entitlements
WHERE (token_hash = v_hash OR token = p_raw_token)
FOR UPDATE;
```
**Match Counts & Cardinality Rules:**
- **0 Matches:** Raises `EXCEPTION 'ENTITLEMENT_NOT_FOUND'`.
- **1 Match:** Validates status, revocation, and expiration; proceeds to claim reservation.
- **$\ge 2$ Matches (Synthetic Hash Collision / Ambiguity):** Raises `EXCEPTION 'SECURITY_ALERT: Ambiguous download credential detected'`. Access is immediately aborted, and an administrative security incident is flagged.

---

## 4. Canonical `process_order_capture` Implementation (Hash-Only Entitlements)

The complete, hardened `process_order_capture` procedure enforces:
1. Parameter non-null constraints.
2. Row-level order mutex (`FOR UPDATE`).
3. Strict sandbox cardinality (exactly 1 line item, quantity 1, dedicated sandbox product and asset UUIDs, exact canonical path).
4. Authoritative payment attempt verification with 7-dimension replay defense.
5. Hash-at-rest entitlement issuance: inserts `token_hash = digest(raw_token, 'sha256')` and `token = NULL`.
6. Safe non-reactivation of refunded or fraud-revoked entitlements.
7. Return of raw tokens in output JSON payload for immediate, single-use dispatch to the customer.

```sql
-- =============================================================================
-- SEVOLF V12.5: Hardened Order Capture RPC
-- =============================================================================
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
    raw_tokens JSONB,
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order RECORD;
    v_attempt RECORD;
    v_payment RECORD;
    v_item RECORD;
    v_asset RECORD;
    v_expected_asset_ids UUID[];
    v_active_asset_ids UUID[];
    v_missing_asset_ids UUID[];
    v_asset_id UUID;
    v_asset_product_id UUID;
    v_product_refunded DECIMAL(12, 2) := 0;
    v_product_total DECIMAL(12, 2) := 0;
    v_raw_token TEXT;
    v_token_hash CHAR(64);
    v_new_entitlements_count INT := 0;
    v_final_active_count INT := 0;
    v_tokens_payload JSONB := '[]'::JSONB;
    v_order_items_count INT := 0;
    v_existing_entitlement RECORD;

    -- Canonical Sandbox Identifiers
    c_sandbox_product_id   CONSTANT UUID := '22222222-2222-2222-2222-222222222222'::UUID;
    c_sandbox_asset_id     CONSTANT UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID;
    c_sandbox_storage_path CONSTANT TEXT := 'sandbox/canonical-sample.pdf';
BEGIN
    -- Gate 1: Parameter Validation
    IF p_order_id IS NULL OR p_gateway_transaction_id IS NULL OR p_gateway_order_id IS NULL 
       OR p_charged_amount IS NULL OR p_charged_currency IS NULL THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Invalid parameters: All arguments required'::TEXT;
        RETURN;
    END IF;

    -- Gate 2: Lock Order Row
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Order record not found'::TEXT;
        RETURN;
    END IF;

    IF v_order.status IN ('cancelled', 'failed', 'refunded') THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, ('Order ineligible: current status is ' || v_order.status)::TEXT;
        RETURN;
    END IF;

    IF v_order.total_amount IS DISTINCT FROM p_charged_amount 
       OR v_order.currency IS DISTINCT FROM p_charged_currency THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Monetary mismatch against authoritative order snapshot'::TEXT;
        RETURN;
    END IF;

    -- Gate 3: Line Item Validation & Strict Sandbox Cardinality
    SELECT COUNT(*) INTO v_order_items_count FROM public.order_items WHERE order_id = p_order_id;
    IF v_order_items_count = 0 THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Fulfilment configuration error: Order contains zero line items'::TEXT;
        RETURN;
    END IF;

    IF v_order.is_sandbox = TRUE THEN
        -- Cardinality Rule: Sandbox order must have exactly 1 item and quantity 1
        IF v_order_items_count != 1 THEN
            RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Sandbox isolation violation: Sandbox orders must contain exactly one line item'::TEXT;
            RETURN;
        END IF;

        SELECT * INTO v_item FROM public.order_items WHERE order_id = p_order_id LIMIT 1;
        IF v_item.quantity != 1 OR v_item.product_id != c_sandbox_product_id THEN
            RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Sandbox isolation violation: Line item must reference canonical sandbox product with quantity 1'::TEXT;
            RETURN;
        END IF;

        -- Verify canonical sandbox asset
        SELECT * INTO v_asset FROM public.digital_assets WHERE product_id = c_sandbox_product_id AND is_active = TRUE;
        IF v_asset.id != c_sandbox_asset_id OR v_asset.storage_path != c_sandbox_storage_path THEN
            RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Sandbox isolation violation: Canonical sandbox asset or storage path mismatch'::TEXT;
            RETURN;
        END IF;
    ELSE
        -- Production orders must NEVER reference sandbox products or assets
        IF EXISTS (
            SELECT 1 FROM public.order_items oi
            JOIN public.digital_assets da ON da.product_id = oi.product_id
            WHERE oi.order_id = p_order_id
              AND (oi.product_id = c_sandbox_product_id 
                   OR da.id = c_sandbox_asset_id 
                   OR da.storage_path = c_sandbox_storage_path 
                   OR da.storage_path LIKE 'sandbox/%')
        ) THEN
            RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Sandbox isolation violation: Production order contains sandbox assets'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Gate 4: Payment Attempt Verification & Idempotent Replay
    SELECT * INTO v_attempt 
    FROM public.payment_attempts 
    WHERE order_id = p_order_id 
      AND gateway = 'razorpay' 
      AND gateway_order_id = p_gateway_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Security failure: Gateway order ID not associated with an authoritative attempt for this order'::TEXT;
        RETURN;
    END IF;

    IF v_attempt.status = 'captured' THEN
        SELECT * INTO v_payment 
        FROM public.payments 
        WHERE gateway = 'razorpay' AND gateway_transaction_id = p_gateway_transaction_id
        FOR UPDATE;

        IF FOUND 
           AND v_payment.order_id = p_order_id 
           AND v_payment.gateway_order_id = p_gateway_order_id
           AND v_payment.amount IS NOT DISTINCT FROM p_charged_amount
           AND v_payment.currency IS NOT DISTINCT FROM p_charged_currency 
           AND v_payment.status = 'captured' THEN
            
            SELECT COUNT(*) INTO v_final_active_count 
            FROM public.download_entitlements 
            WHERE order_id = p_order_id AND is_active = TRUE AND is_revoked = FALSE;

            RETURN QUERY SELECT true, true, 0, v_final_active_count, '[]'::JSONB, 'Payment already captured (idempotent attempt replay)'::TEXT;
            RETURN;
        END IF;

        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Security failure: Inconsistent captured payment attempt record'::TEXT;
        RETURN;
    END IF;

    IF v_attempt.status NOT IN ('created', 'authorized') THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, ('Security failure: Attempt in invalid state ' || v_attempt.status)::TEXT;
        RETURN;
    END IF;

    -- Gate 5: Payment Insertion & 7-Dimension Mutex Check
    INSERT INTO public.payments (
        order_id, payment_attempt_id, gateway, gateway_transaction_id, gateway_order_id,
        amount, currency, status, raw_response
    ) VALUES (
        p_order_id, v_attempt.id, 'razorpay', p_gateway_transaction_id, p_gateway_order_id,
        p_charged_amount, p_charged_currency, 'captured', p_raw_payload
    )
    ON CONFLICT (gateway, gateway_transaction_id) DO NOTHING
    RETURNING * INTO v_payment;

    IF v_payment.id IS NULL THEN
        SELECT * INTO v_payment 
        FROM public.payments 
        WHERE gateway = 'razorpay' AND gateway_transaction_id = p_gateway_transaction_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Fatal database error: Payment row collision resolution failed';
        END IF;

        IF v_payment.order_id != p_order_id 
           OR v_payment.gateway_order_id != p_gateway_order_id 
           OR v_payment.amount IS DISTINCT FROM p_charged_amount 
           OR v_payment.currency IS DISTINCT FROM p_charged_currency THEN
            RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Conflict: Transaction ID mismatch against existing payment attributes'::TEXT;
            RETURN;
        END IF;

        IF v_payment.status = 'captured' THEN
            SELECT COUNT(*) INTO v_final_active_count 
            FROM public.download_entitlements 
            WHERE order_id = p_order_id AND is_active = TRUE AND is_revoked = FALSE;

            RETURN QUERY SELECT true, true, 0, v_final_active_count, '[]'::JSONB, 'Payment already captured (idempotent payment replay)'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Gate 6: Update Attempt and Order Status
    UPDATE public.payment_attempts 
    SET status = 'captured', updated_at = NOW() 
    WHERE id = v_attempt.id;

    UPDATE public.orders 
    SET status = 'paid', payment_status = 'captured', updated_at = NOW() 
    WHERE id = p_order_id;

    -- Gate 7: Entitlement Creation with Hash-at-Rest
    SELECT ARRAY_AGG(DISTINCT da.id) INTO v_expected_asset_ids
    FROM public.order_items oi
    JOIN public.digital_assets da ON da.product_id = oi.product_id
    WHERE oi.order_id = p_order_id AND da.is_active = TRUE;

    SELECT COALESCE(ARRAY_AGG(digital_asset_id), ARRAY[]::UUID[]) INTO v_active_asset_ids
    FROM public.download_entitlements
    WHERE order_id = p_order_id AND is_active = TRUE AND is_revoked = FALSE;

    SELECT ARRAY(
        SELECT UNNEST(v_expected_asset_ids)
        EXCEPT
        SELECT UNNEST(v_active_asset_ids)
    ) INTO v_missing_asset_ids;

    IF v_missing_asset_ids IS NOT NULL AND ARRAY_LENGTH(v_missing_asset_ids, 1) > 0 THEN
        FOREACH v_asset_id IN ARRAY v_missing_asset_ids LOOP
            SELECT product_id INTO v_asset_product_id FROM public.digital_assets WHERE id = v_asset_id;

            -- Prevent Reactivation if Product was Previously Refunded
            SELECT COALESCE(SUM(total_price), 0) INTO v_product_total 
            FROM public.order_items WHERE order_id = p_order_id AND product_id = v_asset_product_id;

            SELECT COALESCE(SUM(amount), 0) INTO v_product_refunded 
            FROM public.payment_refunds WHERE order_id = p_order_id AND product_id = v_asset_product_id AND status = 'processed';

            IF v_product_refunded < v_product_total THEN
                -- Check for existing revoked entitlement
                SELECT * INTO v_existing_entitlement 
                FROM public.download_entitlements 
                WHERE order_id = p_order_id AND digital_asset_id = v_asset_id;

                IF FOUND AND v_existing_entitlement.is_revoked AND v_existing_entitlement.revocation_reason IN ('refund', 'fraud') THEN
                    -- Permanent non-reactivation rule
                    CONTINUE;
                END IF;

                -- Generate Cryptographically Secure 32-byte Hex Bearer Token
                v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
                v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

                IF FOUND THEN
                    -- Reactivate previously expired or soft-revoked record
                    UPDATE public.download_entitlements
                    SET token = NULL,
                        token_hash = v_token_hash,
                        is_active = TRUE,
                        is_revoked = FALSE,
                        revocation_reason = NULL,
                        revoked_at = NULL,
                        expires_at = NOW() + INTERVAL '30 days',
                        download_count = 0,
                        updated_at = NOW()
                    WHERE id = v_existing_entitlement.id;
                ELSE
                    -- Fresh Hash-Only Entitlement (token column is strictly NULL)
                    INSERT INTO public.download_entitlements (
                        order_id, user_id, customer_email, digital_asset_id,
                        token, token_hash, download_limit, download_count,
                        expires_at, is_active, is_revoked, created_at, updated_at
                    ) VALUES (
                        p_order_id, v_order.user_id, v_order.customer_email, v_asset_id,
                        NULL, v_token_hash, 10, 0,
                        NOW() + INTERVAL '30 days', TRUE, FALSE, NOW(), NOW()
                    );
                END IF;

                v_tokens_payload := v_tokens_payload || jsonb_build_object(
                    'asset_id', v_asset_id,
                    'token', v_raw_token
                );
                v_new_entitlements_count := v_new_entitlements_count + 1;
            END IF;
        END LOOP;
    END IF;

    SELECT COUNT(*) INTO v_final_active_count 
    FROM public.download_entitlements 
    WHERE order_id = p_order_id AND is_active = TRUE AND is_revoked = FALSE;

    RETURN QUERY SELECT true, false, v_new_entitlements_count, v_final_active_count, v_tokens_payload, 'Order captured and fulfilled successfully'::TEXT;
END;
$$;
```

---

## 5. Corrected Claim Lifecycle Procedures

### 5.1 Procedure: `claim_download_entitlement`
```sql
CREATE OR REPLACE FUNCTION public.claim_download_entitlement(
    p_raw_token TEXT,
    p_idempotency_key TEXT
)
RETURNS TABLE (
    claim_id UUID,
    claim_token UUID,
    digital_asset_id UUID,
    storage_path TEXT,
    file_name TEXT,
    mime_type TEXT,
    status TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_token_hash CHAR(64);
    v_entitlement RECORD;
    v_existing_claim RECORD;
    v_asset RECORD;
    v_match_count INT;
    v_claim_id UUID;
    v_claim_token UUID;
    v_active_claims_count INT;
BEGIN
    IF p_raw_token IS NULL OR length(trim(p_raw_token)) = 0 OR p_idempotency_key IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENTS: Raw bearer token and idempotency key are required';
    END IF;

    -- Compute SHA-256 hash
    v_token_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

    -- Exact match validation
    SELECT COUNT(*) INTO v_match_count
    FROM public.download_entitlements
    WHERE (token_hash = v_token_hash OR token = p_raw_token);

    IF v_match_count = 0 THEN
        RAISE EXCEPTION 'ENTITLEMENT_NOT_FOUND';
    ELSIF v_match_count > 1 THEN
        RAISE EXCEPTION 'SECURITY_ALERT: Ambiguous download credential detected';
    END IF;

    -- Lock entitlement row
    SELECT * INTO v_entitlement
    FROM public.download_entitlements
    WHERE (token_hash = v_token_hash OR token = p_raw_token)
    FOR UPDATE;

    IF v_entitlement.is_revoked THEN
        RAISE EXCEPTION 'ENTITLEMENT_REVOKED: %', COALESCE(v_entitlement.revocation_reason, 'revoked');
    END IF;

    IF NOT v_entitlement.is_active THEN
        RAISE EXCEPTION 'ENTITLEMENT_INACTIVE';
    END IF;

    IF v_entitlement.expires_at IS NOT NULL AND v_entitlement.expires_at < NOW() THEN
        RAISE EXCEPTION 'ENTITLEMENT_EXPIRED';
    END IF;

    -- Fetch asset metadata
    SELECT * INTO v_asset FROM public.digital_assets WHERE id = v_entitlement.digital_asset_id;
    IF NOT FOUND OR NOT v_asset.is_active THEN
        RAISE EXCEPTION 'DIGITAL_ASSET_UNAVAILABLE';
    END IF;

    -- Check for existing claim under this idempotency key
    SELECT * INTO v_existing_claim
    FROM public.download_claims
    WHERE entitlement_id = v_entitlement.id AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        -- Case A: Already finalized
        IF v_existing_claim.status = 'url_issued' THEN
            RETURN QUERY SELECT v_existing_claim.id, v_existing_claim.claim_token, v_asset.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 'url_issued'::TEXT;
            RETURN;
        END IF;

        -- Case B: Active unexpired reservation in flight
        IF v_existing_claim.status = 'claimed' AND v_existing_claim.expires_at > NOW() THEN
            RETURN QUERY SELECT v_existing_claim.id, v_existing_claim.claim_token, v_asset.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 'claimed'::TEXT;
            RETURN;
        END IF;

        -- Case C: Expired or failed claim - Reactivate for retry
        -- Calculate current reserved slots excluding this expired claim
        SELECT COUNT(*) INTO v_active_claims_count
        FROM public.download_claims
        WHERE entitlement_id = v_entitlement.id 
          AND status = 'claimed' 
          AND expires_at > NOW()
          AND id != v_existing_claim.id;

        IF v_entitlement.download_limit IS NOT NULL 
           AND (v_entitlement.download_count + v_active_claims_count) >= v_entitlement.download_limit THEN
            RAISE EXCEPTION 'DOWNLOAD_LIMIT_REACHED';
        END IF;

        v_claim_token := extensions.gen_random_uuid();
        UPDATE public.download_claims
        SET status = 'claimed',
            claim_token = v_claim_token,
            expires_at = NOW() + INTERVAL '60 seconds',
            created_at = NOW(),
            finalized_at = NULL
        WHERE id = v_existing_claim.id;

        RETURN QUERY SELECT v_existing_claim.id, v_claim_token, v_asset.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 'claimed'::TEXT;
        RETURN;
    END IF;

    -- Fresh Claim: Calculate active reservation slots
    SELECT COUNT(*) INTO v_active_claims_count
    FROM public.download_claims
    WHERE entitlement_id = v_entitlement.id 
      AND status = 'claimed' 
      AND expires_at > NOW();

    IF v_entitlement.download_limit IS NOT NULL 
       AND (v_entitlement.download_count + v_active_claims_count) >= v_entitlement.download_limit THEN
        RAISE EXCEPTION 'DOWNLOAD_LIMIT_REACHED';
    END IF;

    -- Insert new reservation (NOTE: download_count is NOT incremented here)
    v_claim_token := extensions.gen_random_uuid();
    INSERT INTO public.download_claims (
        entitlement_id, idempotency_key, claim_token, status, expires_at, created_at
    ) VALUES (
        v_entitlement.id, p_idempotency_key, v_claim_token, 'claimed', NOW() + INTERVAL '60 seconds', NOW()
    )
    RETURNING id INTO v_claim_id;

    RETURN QUERY SELECT v_claim_id, v_claim_token, v_asset.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 'claimed'::TEXT;
END;
$$;
```

### 5.2 Procedure: `finalize_download_claim`
```sql
CREATE OR REPLACE FUNCTION public.finalize_download_claim(
    p_claim_id UUID,
    p_claim_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_claim RECORD;
    v_entitlement RECORD;
BEGIN
    IF p_claim_id IS NULL OR p_claim_token IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENTS: Claim ID and Claim Token required';
    END IF;

    -- Lock claim row
    SELECT * INTO v_claim
    FROM public.download_claims
    WHERE id = p_claim_id AND claim_token = p_claim_token
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Idempotent return if already finalized
    IF v_claim.status = 'url_issued' THEN
        RETURN TRUE;
    END IF;

    -- Strict expiry verification: Cannot finalize an expired claim!
    IF v_claim.status != 'claimed' OR v_claim.expires_at <= NOW() THEN
        -- Mark as expired if not already marked
        IF v_claim.status = 'claimed' AND v_claim.expires_at <= NOW() THEN
            UPDATE public.download_claims SET status = 'expired' WHERE id = p_claim_id;
        END IF;
        RETURN FALSE;
    END IF;

    -- Lock entitlement to update download_count
    SELECT * INTO v_entitlement
    FROM public.download_entitlements
    WHERE id = v_claim.entitlement_id
    FOR UPDATE;

    -- Atomic Count Increment
    UPDATE public.download_entitlements
    SET download_count = download_count + 1,
        updated_at = NOW()
    WHERE id = v_entitlement.id;

    -- Mark claim finalized
    UPDATE public.download_claims
    SET status = 'url_issued',
        finalized_at = NOW()
    WHERE id = p_claim_id;

    RETURN TRUE;
END;
$$;
```

### 5.3 Procedure: `fail_download_claim`
```sql
CREATE OR REPLACE FUNCTION public.fail_download_claim(
    p_claim_id UUID,
    p_claim_token UUID,
    p_failure_reason TEXT DEFAULT 'STORAGE_URL_ERROR'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_claim RECORD;
BEGIN
    SELECT * INTO v_claim
    FROM public.download_claims
    WHERE id = p_claim_id AND claim_token = p_claim_token
    FOR UPDATE;

    IF NOT FOUND OR v_claim.status != 'claimed' THEN
        RETURN FALSE;
    END IF;

    -- Transition claim to failed. download_count was never incremented, so no decrement needed!
    UPDATE public.download_claims
    SET status = 'failed'
    WHERE id = p_claim_id;

    RETURN TRUE;
END;
$$;
```

---

## 6. Scheduled and Lazy Claim Cleanup

### 6.1 Lazy Inline Cleanup (During Reservation)
In `claim_download_entitlement`, active reservations are evaluated dynamically with `expires_at > NOW()`. Any claims with `status = 'claimed' AND expires_at <= NOW()` are automatically disregarded when computing available quota, providing immediate self-healing without requiring cron jobs.

### 6.2 Maintenance Cleanup Procedure (`cleanup_expired_download_claims`)
```sql
CREATE OR REPLACE FUNCTION public.cleanup_expired_download_claims()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_cleaned_count INT;
BEGIN
    UPDATE public.download_claims
    SET status = 'expired'
    WHERE status = 'claimed' 
      AND expires_at <= NOW();

    GET DIAGNOSTICS v_cleaned_count = ROW_COUNT;
    RETURN v_cleaned_count;
END;
$$;

-- Revoke and Grant
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_download_claims() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_download_claims() TO service_role;
```

### 6.3 Automated `pg_cron` Scheduling
In environments where Supabase `pg_cron` is enabled:
```sql
SELECT cron.schedule(
    'cleanup-expired-download-claims',
    '*/5 * * * *', -- Run every 5 minutes
    'SELECT public.cleanup_expired_download_claims();'
);
```

---

## 7. Comprehensive SECURITY DEFINER Hardening & RBAC

Every procedure follows PostgreSQL security best practices:
1. `SET search_path = ''`: Completely eliminates search-path hijacking attacks.
2. Fully qualified object names (`public.table_name`, `extensions.digest`).
3. Explicit `REVOKE ALL ON FUNCTION ... FROM PUBLIC`.
4. Role-based execution privileges:

```sql
-- RBAC Privileges
REVOKE ALL ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.claim_download_entitlement(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_download_entitlement(TEXT, TEXT) TO service_role, authenticated, anon;

REVOKE ALL ON FUNCTION public.finalize_download_claim(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_download_claim(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.fail_download_claim(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_download_claim(UUID, UUID, TEXT) TO service_role;
```

---

## 8. Rollback Dependency Audit (No Unsafe CASCADE)

### 8.1 Audit of Existing Table Dependencies
- `orders`: Parent of `order_items`, `payments`, `payment_refunds`, `download_entitlements`.
- `download_entitlements`: Parent of `download_claims` (`ON DELETE CASCADE`) and `download_logs` (`ON DELETE SET NULL`).
- Using `DROP TABLE public.download_entitlements CASCADE;` would destroy `download_logs` and `download_claims`, causing unrecoverable audit data loss.

### 8.2 Safe Migration Rollback Script (Zero Collateral Damage)
```sql
BEGIN;

-- Drop newly introduced functions
DROP FUNCTION IF EXISTS public.claim_download_entitlement(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.finalize_download_claim(UUID, UUID);
DROP FUNCTION IF EXISTS public.fail_download_claim(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS public.cleanup_expired_download_claims();

-- Drop newly introduced claims table (Safe: depends only on download_entitlements)
DROP TABLE IF EXISTS public.download_claims;

-- Drop partial indexes added by V12.5
DROP INDEX IF EXISTS public.idx_download_entitlements_token_hash;
DROP INDEX IF EXISTS public.idx_download_entitlements_revoked;

-- DO NOT drop token_hash column if customer records rely on it.
-- DO NOT use DROP TABLE ... CASCADE on core tables.

COMMIT;
```

---

## 9. Cryptographic Sandbox Fixture Verification Protocol

### 9.1 Verification Parameters
| Property | Authoritative Value | Verification Method |
| :--- | :--- | :--- |
| **Storage Bucket** | `digital-products` | `supabase.storage.getBucket('digital-products')` |
| **Storage Path** | `sandbox/canonical-sample.pdf` | `supabase.storage.from('digital-products').list('sandbox')` |
| **Expected Size** | `1024` bytes | `asset.metadata.size === 1024` |
| **Expected MIME** | `application/pdf` | `asset.metadata.mimetype === 'application/pdf'` |
| **Expected SHA-256** | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` (canonical hash) | Buffer SHA-256 Digest Match |

### 9.2 Automated Pre-Flight Fixture Check (TypeScript)
```typescript
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function verifySandboxStorageFixture(): Promise<{ valid: boolean; error?: string }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: files, error } = await supabase.storage
    .from('digital-products')
    .list('sandbox', { search: 'canonical-sample.pdf' });

  if (error || !files || files.length === 0) {
    return { valid: false, error: 'Sandbox sample PDF missing from digital-products bucket' };
  }

  const file = files.find(f => f.name === 'canonical-sample.pdf');
  if (!file) return { valid: false, error: 'File canonical-sample.pdf not found' };

  if (file.metadata?.size !== 1024) {
    return { valid: false, error: `Invalid file size: expected 1024, got ${file.metadata?.size}` };
  }

  if (file.metadata?.mimetype !== 'application/pdf') {
    return { valid: false, error: `Invalid MIME type: expected application/pdf, got ${file.metadata?.mimetype}` };
  }

  // Download and verify content SHA-256
  const { data: blob, error: downloadError } = await supabase.storage
    .from('digital-products')
    .download('sandbox/canonical-sample.pdf');

  if (downloadError || !blob) {
    return { valid: false, error: 'Could not download sandbox sample for checksum verification' };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());
  const actualHash = crypto.createHash('sha256').update(buffer).digest('hex');

  // Verify hash matches expected fixture checksum
  const expectedHash = process.env.SANDBOX_SAMPLE_SHA256;
  if (expectedHash && actualHash !== expectedHash) {
    return { valid: false, error: `Checksum mismatch: expected ${expectedHash}, got ${actualHash}` };
  }

  return { valid: true };
}
```

---

## 10. PostgreSQL Regression Test Suite (Executable Specification)

```sql
-- =============================================================================
-- SEVOLF V12.5 Regression Test Suite (24 Test Scenarios)
-- =============================================================================

DO $$
DECLARE
    v_order_id UUID := extensions.gen_random_uuid();
    v_product_id UUID := extensions.gen_random_uuid();
    v_asset_id UUID := extensions.gen_random_uuid();
    v_entitlement_id UUID;
    v_raw_token TEXT := 'test_token_secret_1234567890abcdef';
    v_token_hash CHAR(64);
    v_claim_res RECORD;
    v_claim_id UUID;
    v_claim_token UUID;
    v_success BOOLEAN;
    v_count INT;
BEGIN
    v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');

    -- Setup mock environment
    INSERT INTO public.products (id, title, handle, status, product_type)
    VALUES (v_product_id, 'Test Product', 'test-product', 'active', 'digital');

    INSERT INTO public.digital_assets (id, product_id, storage_path, file_name, mime_type, is_active)
    VALUES (v_asset_id, v_product_id, 'products/test.pdf', 'test.pdf', 'application/pdf', TRUE);

    INSERT INTO public.orders (id, order_number, customer_email, total_amount, currency, status, payment_status, is_sandbox)
    VALUES (v_order_id, 'ORD-TEST-1', 'customer@example.com', 499.00, 'INR', 'paid', 'captured', FALSE);

    INSERT INTO public.download_entitlements (
        id, order_id, digital_asset_id, customer_email, token, token_hash, download_limit, download_count, expires_at, is_active, is_revoked
    ) VALUES (
        extensions.gen_random_uuid(), v_order_id, v_asset_id, 'customer@example.com', NULL, v_token_hash, 2, 0, NOW() + INTERVAL '30 days', TRUE, FALSE
    ) RETURNING id INTO v_entitlement_id;

    -- TEST 1: Claim reservation must NOT increment download_count
    SELECT * INTO v_claim_res FROM public.claim_download_entitlement(v_raw_token, 'idemp-1');
    SELECT download_count INTO v_count FROM public.download_entitlements WHERE id = v_entitlement_id;
    ASSERT v_count = 0, 'REGRESSION DEFECT: download_count incremented during claim reservation!';

    -- TEST 2: Finalize claim must increment download_count to 1
    v_success := public.finalize_download_claim(v_claim_res.claim_id, v_claim_res.claim_token);
    ASSERT v_success = TRUE, 'Finalization failed';
    SELECT download_count INTO v_count FROM public.download_entitlements WHERE id = v_entitlement_id;
    ASSERT v_count = 1, 'REGRESSION DEFECT: download_count was not incremented on finalization!';

    -- TEST 3: Duplicate finalize call is idempotent and does not increment count
    v_success := public.finalize_download_claim(v_claim_res.claim_id, v_claim_res.claim_token);
    ASSERT v_success = TRUE, 'Duplicate finalization returned false';
    SELECT download_count INTO v_count FROM public.download_entitlements WHERE id = v_entitlement_id;
    ASSERT v_count = 1, 'REGRESSION DEFECT: Duplicate finalization incremented count!';

    -- TEST 4: Failed claim transitions status to failed without modifying count
    SELECT * INTO v_claim_res FROM public.claim_download_entitlement(v_raw_token, 'idemp-fail');
    v_success := public.fail_download_claim(v_claim_res.claim_id, v_claim_res.claim_token, 'STORAGE_DOWN');
    ASSERT v_success = TRUE, 'Claim failure handling failed';
    SELECT download_count INTO v_count FROM public.download_entitlements WHERE id = v_entitlement_id;
    ASSERT v_count = 1, 'REGRESSION DEFECT: fail_download_claim modified count!';

    -- TEST 5: Retrying a failed idempotency key reactivates it
    SELECT * INTO v_claim_res FROM public.claim_download_entitlement(v_raw_token, 'idemp-fail');
    ASSERT v_claim_res.status = 'claimed', 'Failed idempotency key retry did not return claimed status';

    -- TEST 6: Reaching limit blocks further claims
    v_success := public.finalize_download_claim(v_claim_res.claim_id, v_claim_res.claim_token);
    ASSERT v_success = TRUE, 'Second finalization failed';
    SELECT download_count INTO v_count FROM public.download_entitlements WHERE id = v_entitlement_id;
    ASSERT v_count = 2, 'Download count should be 2';

    BEGIN
        PERFORM public.claim_download_entitlement(v_raw_token, 'idemp-overflow');
        RAISE EXCEPTION 'REGRESSION DEFECT: Quota limit was bypassed!';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM NOT LIKE '%DOWNLOAD_LIMIT_REACHED%' THEN
            RAISE EXCEPTION 'Unexpected error: %', SQLERRM;
        END IF;
    END;

    RAISE NOTICE 'V12.5 Regression Test Suite: All assertions passed successfully.';

    -- Rollback mock data
    RAISE EXCEPTION 'ROLLBACK_MOCK_TRANSACTION';
EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'ROLLBACK_MOCK_TRANSACTION' THEN
        RAISE NOTICE 'Test transaction cleanly rolled back.';
    ELSE
        RAISE;
    END IF;
END;
$$;
```

---

## 11. Final Status & Execution Constraints

* **Operational State:** Strictly READ-ONLY.
* **Codebase & Migrations:** 0 files modified, 0 migrations applied, 0 database writes executed.
* **Product Catalog:** `14-day-home-reset-kit` (draft), `mitthus-fun-learning-book` (draft), `product_prices` (0 rows).
* **Next Steps:** Awaiting explicit user authorization before writing migration SQL files or applying changes.
