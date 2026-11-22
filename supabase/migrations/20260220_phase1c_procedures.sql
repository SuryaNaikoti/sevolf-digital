-- =============================================================================
-- SEVOLF Phase 1C: Stored Procedures & Security RPCs
-- Migration: 20260220_phase1c_procedures.sql
-- Dependencies: 20260220_phase1c_fulfilment_and_claims.sql
-- =============================================================================

BEGIN;

-- 1. PROCESS ORDER CAPTURE (Atomic Capture, Entitlements & Encrypted Outbox)
CREATE OR REPLACE FUNCTION public.process_order_capture(
    p_order_id UUID,
    p_gateway_transaction_id TEXT,
    p_gateway_order_id TEXT,
    p_charged_amount DECIMAL(12, 2),
    p_charged_currency TEXT,
    p_delivery_payloads JSONB, -- Array of [{asset_id, token_hash, encrypted_payload}]
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
    v_attempt RECORD;
    v_payment RECORD;
    v_item RECORD;
    v_asset RECORD;
    v_payload RECORD;
    v_missing_product_ids UUID[];
    v_expected_asset_ids UUID[];
    v_active_asset_ids UUID[];
    v_missing_asset_ids UUID[];
    v_asset_id UUID;
    v_asset_product_id UUID;
    v_product_refunded DECIMAL(12, 2) := 0;
    v_product_total DECIMAL(12, 2) := 0;
    v_new_entitlements_count INT := 0;
    v_final_active_count INT := 0;
    v_order_items_count INT := 0;
    v_existing_entitlement RECORD;
    v_entitlement_exists BOOLEAN := FALSE;
    v_new_entitlement_id UUID;

    -- Canonical Sandbox Identifiers (Strict Cardinality & Path Contract)
    c_sandbox_product_id   CONSTANT UUID := '22222222-2222-2222-2222-222222222222'::UUID;
    c_sandbox_asset_id     CONSTANT UUID := 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID;
    c_sandbox_storage_path CONSTANT TEXT := 'sandbox/canonical-sample.pdf';
BEGIN
    -- Gate 1: Parameter Validation
    IF p_order_id IS NULL OR p_gateway_transaction_id IS NULL OR p_gateway_order_id IS NULL 
       OR p_charged_amount IS NULL OR p_charged_currency IS NULL THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Invalid parameters: All arguments required'::TEXT;
        RETURN;
    END IF;

    -- Gate 2: Lock Order Row
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Order record not found'::TEXT;
        RETURN;
    END IF;

    IF v_order.status IN ('cancelled', 'failed', 'refunded') THEN
        RETURN QUERY SELECT false, false, 0, 0, ('Order ineligible: current status is ' || v_order.status)::TEXT;
        RETURN;
    END IF;

    IF v_order.total_amount IS DISTINCT FROM p_charged_amount 
       OR v_order.currency IS DISTINCT FROM p_charged_currency THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Monetary mismatch against authoritative order snapshot'::TEXT;
        RETURN;
    END IF;

    -- Gate 3: Line Item & Fulfilment Integrity
    SELECT COUNT(*) INTO v_order_items_count FROM public.order_items WHERE order_id = p_order_id;
    IF v_order_items_count = 0 THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Fulfilment configuration error: Order contains zero line items'::TEXT;
        RETURN;
    END IF;

    -- Ensure every distinct product in order has at least one active digital asset
    SELECT ARRAY_AGG(DISTINCT oi.product_id) INTO v_missing_product_ids
    FROM public.order_items oi
    WHERE oi.order_id = p_order_id
      AND NOT EXISTS (
          SELECT 1 FROM public.digital_assets da
          WHERE da.product_id = oi.product_id AND da.is_active = TRUE
      );

    IF v_missing_product_ids IS NOT NULL AND ARRAY_LENGTH(v_missing_product_ids, 1) > 0 THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Fulfilment configuration error: Order products lack active digital assets'::TEXT;
        RETURN;
    END IF;

    -- Strict Sandbox Isolation
    IF v_order.is_sandbox = TRUE THEN
        IF v_order_items_count != 1 THEN
            RETURN QUERY SELECT false, false, 0, 0, 'Sandbox isolation violation: Sandbox orders must contain exactly one line item'::TEXT;
            RETURN;
        END IF;

        SELECT * INTO v_item FROM public.order_items WHERE order_id = p_order_id LIMIT 1;
        IF v_item.quantity != 1 OR v_item.product_id != c_sandbox_product_id THEN
            RETURN QUERY SELECT false, false, 0, 0, 'Sandbox isolation violation: Line item must reference canonical sandbox product with quantity 1'::TEXT;
            RETURN;
        END IF;

        BEGIN
            SELECT * INTO STRICT v_asset 
            FROM public.digital_assets 
            WHERE product_id = c_sandbox_product_id AND is_active = TRUE;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                RETURN QUERY SELECT false, false, 0, 0, 'Sandbox isolation violation: Zero active sandbox assets found'::TEXT;
                RETURN;
            WHEN TOO_MANY_ROWS THEN
                RETURN QUERY SELECT false, false, 0, 0, 'Sandbox isolation violation: Multiple active sandbox assets found'::TEXT;
                RETURN;
        END;

        IF v_asset.id != c_sandbox_asset_id OR v_asset.storage_path != c_sandbox_storage_path THEN
            RETURN QUERY SELECT false, false, 0, 0, 'Sandbox isolation violation: Canonical sandbox asset ID or path mismatch'::TEXT;
            RETURN;
        END IF;
    ELSE
        IF EXISTS (
            SELECT 1 FROM public.order_items oi
            JOIN public.digital_assets da ON da.product_id = oi.product_id
            WHERE oi.order_id = p_order_id
              AND (oi.product_id = c_sandbox_product_id 
                   OR da.id = c_sandbox_asset_id 
                   OR da.storage_path = c_sandbox_storage_path 
                   OR da.storage_path LIKE 'sandbox/%')
        ) THEN
            RETURN QUERY SELECT false, false, 0, 0, 'Sandbox isolation violation: Production order contains sandbox assets'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Gate 4: Authoritative Payment Attempt Verification
    SELECT * INTO v_attempt 
    FROM public.payment_attempts 
    WHERE order_id = p_order_id 
      AND gateway = 'razorpay' 
      AND gateway_order_id = p_gateway_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Security failure: Gateway order ID not associated with an authoritative attempt for this order'::TEXT;
        RETURN;
    END IF;

    IF v_attempt.amount IS DISTINCT FROM p_charged_amount OR v_attempt.currency IS DISTINCT FROM p_charged_currency THEN
        RETURN QUERY SELECT false, false, 0, 0, 'Security failure: Attempt monetary parameters mismatch charged amount/currency'::TEXT;
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
           AND v_payment.payment_attempt_id = v_attempt.id
           AND v_payment.amount IS NOT DISTINCT FROM p_charged_amount
           AND v_payment.currency IS NOT DISTINCT FROM p_charged_currency 
           AND v_payment.status = 'captured' THEN
            
            SELECT COUNT(*) INTO v_final_active_count 
            FROM public.download_entitlements 
            WHERE order_id = p_order_id AND is_active = TRUE AND is_revoked = FALSE;

            -- Replay Invariant: Return already processed; NEVER update or overwrite existing tokens/outbox!
            RETURN QUERY SELECT true, true, 0, v_final_active_count, 'Payment already captured (idempotent attempt replay)'::TEXT;
            RETURN;
        END IF;

        RETURN QUERY SELECT false, false, 0, 0, 'Security failure: Inconsistent captured payment record'::TEXT;
        RETURN;
    END IF;

    IF v_attempt.status NOT IN ('created', 'authorized') THEN
        RETURN QUERY SELECT false, false, 0, 0, ('Security failure: Attempt in invalid state ' || v_attempt.status)::TEXT;
        RETURN;
    END IF;

    -- Gate 5: Payment Ledger Insertion & Valid Conflict Target
    INSERT INTO public.payments (
        order_id, payment_attempt_id, gateway, gateway_transaction_id, gateway_order_id,
        amount, currency, status, raw_response, created_at, updated_at
    ) VALUES (
        p_order_id, v_attempt.id, 'razorpay', p_gateway_transaction_id, p_gateway_order_id,
        p_charged_amount, p_charged_currency, 'captured', p_raw_payload, NOW(), NOW()
    )
    ON CONFLICT (gateway, gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL 
    DO NOTHING
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
           OR v_payment.currency IS DISTINCT FROM p_charged_currency 
           OR v_payment.payment_attempt_id IS DISTINCT FROM v_attempt.id THEN
            RETURN QUERY SELECT false, false, 0, 0, 'Conflict: Transaction ID mismatch against existing payment attributes'::TEXT;
            RETURN;
        END IF;

        IF v_payment.status = 'captured' THEN
            SELECT COUNT(*) INTO v_final_active_count 
            FROM public.download_entitlements 
            WHERE order_id = p_order_id AND is_active = TRUE AND is_revoked = FALSE;

            RETURN QUERY SELECT true, true, 0, v_final_active_count, 'Payment already captured (idempotent payment replay)'::TEXT;
        ELSIF v_payment.status IN ('created', 'authorized') THEN
            UPDATE public.payments 
            SET status = 'captured', raw_response = p_raw_payload, updated_at = NOW() 
            WHERE id = v_payment.id;
        ELSE
            RETURN QUERY SELECT false, false, 0, 0, ('Conflict: Existing payment is in terminal non-captured status ' || v_payment.status)::TEXT;
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

    -- Gate 7: Entitlement & Durable Outbox Creation
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

            -- Check for prior refunds
            SELECT COALESCE(SUM(total_price), 0) INTO v_product_total 
            FROM public.order_items WHERE order_id = p_order_id AND product_id = v_asset_product_id;

            SELECT COALESCE(SUM(amount), 0) INTO v_product_refunded 
            FROM public.refunds WHERE order_id = p_order_id AND product_id = v_asset_product_id AND status = 'processed';

            IF v_product_refunded < v_product_total THEN
                -- Explicitly query existing entitlement and store existence in boolean
                SELECT * INTO v_existing_entitlement 
                FROM public.download_entitlements 
                WHERE order_id = p_order_id AND digital_asset_id = v_asset_id
                FOR UPDATE;

                v_entitlement_exists := (v_existing_entitlement.id IS NOT NULL);

                -- Critical Invariant: Non-reversible revocation (refund, fraud, admin, expired)
                IF v_entitlement_exists AND v_existing_entitlement.is_revoked THEN
                    CONTINUE;
                END IF;

                -- Extract application-supplied token hash and encrypted payload for this asset
                SELECT * INTO v_payload 
                FROM jsonb_to_recordset(p_delivery_payloads) AS x(
                    asset_id UUID, 
                    token_hash CHAR(64), 
                    encrypted_payload TEXT
                )
                WHERE x.asset_id = v_asset_id;

                IF v_payload.token_hash IS NULL OR v_payload.encrypted_payload IS NULL THEN
                    RAISE EXCEPTION 'Fulfilment error: Missing delivery payload for asset %', v_asset_id;
                END IF;

                IF v_entitlement_exists THEN
                    -- Update existing entitlement only if active without resetting download_count
                    UPDATE public.download_entitlements
                    SET token = NULL,
                        token_hash = v_payload.token_hash,
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE id = v_existing_entitlement.id
                    RETURNING id INTO v_new_entitlement_id;
                ELSE
                    -- Fresh Insert
                    INSERT INTO public.download_entitlements (
                        order_id, user_id, customer_email, digital_asset_id,
                        token, token_hash, download_limit, download_count,
                        expires_at, is_active, is_revoked, created_at, updated_at
                    ) VALUES (
                        p_order_id, v_order.user_id, v_order.customer_email, v_asset_id,
                        NULL, v_payload.token_hash, 10, 0,
                        NOW() + INTERVAL '30 days', TRUE, FALSE, NOW(), NOW()
                    )
                    RETURNING id INTO v_new_entitlement_id;
                END IF;

                -- Insert into Durable Delivery Outbox atomically in the SAME transaction
                INSERT INTO public.order_delivery_outbox (
                    order_id, entitlement_id, customer_email, encrypted_token_payload,
                    delivery_status, retry_count, next_retry_at, expires_at, created_at, updated_at
                ) VALUES (
                    p_order_id, v_new_entitlement_id, v_order.customer_email, v_payload.encrypted_payload,
                    'pending', 0, NOW(), NOW() + INTERVAL '72 hours', NOW(), NOW()
                );

                v_new_entitlements_count := v_new_entitlements_count + 1;
            END IF;
        END LOOP;
    END IF;

    SELECT COUNT(*) INTO v_final_active_count 
    FROM public.download_entitlements 
    WHERE order_id = p_order_id AND is_active = TRUE AND is_revoked = FALSE;

    RETURN QUERY SELECT true, false, v_new_entitlements_count, v_final_active_count, 'Order captured and fulfilled successfully'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB, JSONB) TO service_role;

-- 2. CLAIM DOWNLOAD ENTITLEMENT
-- Lock Hierarchy Invariant: ALWAYS lock download_entitlements before download_claims
CREATE OR REPLACE FUNCTION public.claim_download_entitlement(
    p_raw_token TEXT,
    p_idempotency_key TEXT
)
RETURNS TABLE (
    claim_id UUID,
    claim_token UUID,
    entitlement_id UUID,
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

    -- Compute SHA-256 hash inside PostgreSQL
    v_token_hash := encode(extensions.digest(p_raw_token, 'sha256'), 'hex');

    -- Exact match count validation
    SELECT COUNT(*) INTO v_match_count
    FROM public.download_entitlements
    WHERE (token_hash = v_token_hash OR token = p_raw_token);

    IF v_match_count = 0 THEN
        RAISE EXCEPTION 'ENTITLEMENT_NOT_FOUND';
    ELSIF v_match_count > 1 THEN
        RAISE EXCEPTION 'SECURITY_ALERT: Ambiguous download credential detected';
    END IF;

    -- 1. Lock entitlement row FIRST (Consistent lock order: entitlement -> claim)
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

    SELECT * INTO v_asset FROM public.digital_assets WHERE id = v_entitlement.digital_asset_id;
    IF NOT FOUND OR NOT v_asset.is_active THEN
        RAISE EXCEPTION 'DIGITAL_ASSET_UNAVAILABLE';
    END IF;

    -- 2. Lock claim row SECOND
    SELECT * INTO v_existing_claim
    FROM public.download_claims
    WHERE entitlement_id = v_entitlement.id AND idempotency_key = p_idempotency_key
    FOR UPDATE;

    IF FOUND THEN
        -- Case A: Claim already finalized (url_issued)
        IF v_existing_claim.status = 'url_issued' THEN
            -- Reissuance strictly bounded to 60-second window
            IF v_existing_claim.finalized_at > (NOW() - INTERVAL '60 seconds') THEN
                RETURN QUERY SELECT v_existing_claim.id, v_existing_claim.claim_token, v_entitlement.id, v_asset.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 'url_issued'::TEXT;
                RETURN;
            ELSE
                RAISE EXCEPTION 'IDEMPOTENCY_EXPIRED: Prior claim completed. Initiate a new download request.';
            END IF;
        END IF;

        -- Case B: Active unexpired reservation in flight
        IF v_existing_claim.status = 'claimed' AND v_existing_claim.expires_at > NOW() THEN
            RETURN QUERY SELECT v_existing_claim.id, v_existing_claim.claim_token, v_entitlement.id, v_asset.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 'claimed'::TEXT;
            RETURN;
        END IF;

        -- Case C: Previous reservation expired or failed - Reactivate
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
            failure_reason = NULL,
            expires_at = NOW() + INTERVAL '60 seconds',
            created_at = NOW(),
            finalized_at = NULL
        WHERE id = v_existing_claim.id;

        RETURN QUERY SELECT v_existing_claim.id, v_claim_token, v_entitlement.id, v_asset.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 'claimed'::TEXT;
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

    -- Insert new reservation (download_count is NOT incremented here)
    v_claim_token := extensions.gen_random_uuid();
    INSERT INTO public.download_claims (
        entitlement_id, idempotency_key, claim_token, status, expires_at, created_at
    ) VALUES (
        v_entitlement.id, p_idempotency_key, v_claim_token, 'claimed', NOW() + INTERVAL '60 seconds', NOW()
    )
    RETURNING id INTO v_claim_id;

    RETURN QUERY SELECT v_claim_id, v_claim_token, v_entitlement.id, v_asset.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 'claimed'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_download_entitlement(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_download_entitlement(TEXT, TEXT) TO service_role;

-- 3. FINALIZE DOWNLOAD CLAIM
-- Lock Hierarchy Invariant: ALWAYS lock download_entitlements before download_claims
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
    v_entitlement_id UUID;
    v_claim RECORD;
    v_entitlement RECORD;
BEGIN
    IF p_claim_id IS NULL OR p_claim_token IS NULL THEN
        RAISE EXCEPTION 'INVALID_ARGUMENTS: Claim ID and Claim Token required';
    END IF;

    -- Non-locking lookup of parent entitlement_id to determine lock target
    SELECT entitlement_id INTO v_entitlement_id
    FROM public.download_claims
    WHERE id = p_claim_id;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 1. Lock entitlement row FIRST (Consistent lock order: entitlement -> claim)
    SELECT * INTO v_entitlement
    FROM public.download_entitlements
    WHERE id = v_entitlement_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- 2. Lock claim row SECOND
    SELECT * INTO v_claim
    FROM public.download_claims
    WHERE id = p_claim_id AND claim_token = p_claim_token
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Idempotent return if already finalized
    IF v_claim.status = 'url_issued' THEN
        -- Revalidate entitlement status even on duplicate call
        IF v_entitlement.is_revoked OR NOT v_entitlement.is_active THEN
            RETURN FALSE;
        END IF;
        RETURN TRUE;
    END IF;

    -- Strict claim expiry verification
    IF v_claim.status != 'claimed' OR v_claim.expires_at <= NOW() THEN
        IF v_claim.status = 'claimed' AND v_claim.expires_at <= NOW() THEN
            UPDATE public.download_claims SET status = 'expired' WHERE id = p_claim_id;
        END IF;
        RETURN FALSE;
    END IF;

    -- Revalidate entitlement conditions
    IF v_entitlement.is_revoked OR NOT v_entitlement.is_active THEN
        UPDATE public.download_claims SET status = 'failed', failure_reason = 'ENTITLEMENT_INACTIVE_OR_REVOKED' WHERE id = p_claim_id;
        RETURN FALSE;
    END IF;

    IF v_entitlement.expires_at IS NOT NULL AND v_entitlement.expires_at < NOW() THEN
        UPDATE public.download_claims SET status = 'failed', failure_reason = 'ENTITLEMENT_EXPIRED' WHERE id = p_claim_id;
        RETURN FALSE;
    END IF;

    IF v_entitlement.download_limit IS NOT NULL AND v_entitlement.download_count >= v_entitlement.download_limit THEN
        UPDATE public.download_claims SET status = 'failed', failure_reason = 'DOWNLOAD_LIMIT_REACHED' WHERE id = p_claim_id;
        RETURN FALSE;
    END IF;

    -- Atomic Count Increment
    UPDATE public.download_entitlements
    SET download_count = download_count + 1,
        updated_at = NOW()
    WHERE id = v_entitlement.id;

    UPDATE public.download_claims
    SET status = 'url_issued',
        finalized_at = NOW()
    WHERE id = p_claim_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_download_claim(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_download_claim(UUID, UUID) TO service_role;

-- 4. FAIL DOWNLOAD CLAIM
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

    UPDATE public.download_claims
    SET status = 'failed',
        failure_reason = p_failure_reason
    WHERE id = p_claim_id;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_download_claim(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_download_claim(UUID, UUID, TEXT) TO service_role;

-- 5. PROCESS ORDER REFUND (With Replay Pre-Check & Strict Product-Level Balance Enforcement)
CREATE OR REPLACE FUNCTION public.process_order_refund(
    p_order_id UUID,
    p_payment_id UUID,
    p_product_id UUID,
    p_gateway_refund_id TEXT,
    p_refund_amount DECIMAL(12, 2),
    p_refund_currency TEXT,
    p_reason TEXT,
    p_raw_payload JSONB
)
RETURNS TABLE (
    success BOOLEAN,
    already_processed BOOLEAN,
    entitlements_revoked INT,
    order_status TEXT,
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
    v_product_price_total DECIMAL(12, 2) := 0;
    v_product_previously_refunded DECIMAL(12, 2) := 0;
    v_total_order_refunded DECIMAL(12, 2) := 0;
    v_revoked_count INT := 0;
    v_rows_affected INT := 0;
BEGIN
    -- 1. Argument validation
    IF p_order_id IS NULL OR p_payment_id IS NULL OR p_gateway_refund_id IS NULL 
       OR p_refund_amount IS NULL OR p_refund_currency IS NULL OR p_refund_amount <= 0 THEN
        RETURN QUERY SELECT false, false, 0, ''::TEXT, 'Invalid parameters: All arguments required and refund amount must be positive'::TEXT;
        RETURN;
    END IF;

    -- 2. Lock Order & Payment
    SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, ''::TEXT, 'Order record not found'::TEXT;
        RETURN;
    END IF;

    SELECT * INTO v_payment FROM public.payments WHERE id = p_payment_id FOR UPDATE;
    IF NOT FOUND OR v_payment.order_id != p_order_id THEN
        RETURN QUERY SELECT false, false, 0, ''::TEXT, 'Payment record not found or does not belong to order'::TEXT;
        RETURN;
    END IF;

    -- 3. REPLAY PRE-CHECK: Check if gateway_refund_id already exists BEFORE checking cumulative limits
    SELECT * INTO v_existing_refund 
    FROM public.refunds 
    WHERE gateway = v_payment.gateway AND gateway_refund_id = p_gateway_refund_id;

    IF FOUND THEN
        -- Verify all immutable attributes on replay
        IF v_existing_refund.order_id != p_order_id 
           OR v_existing_refund.payment_id != p_payment_id
           OR v_existing_refund.amount IS DISTINCT FROM p_refund_amount 
           OR v_existing_refund.currency IS DISTINCT FROM p_refund_currency 
           OR v_existing_refund.product_id IS DISTINCT FROM p_product_id THEN
            RETURN QUERY SELECT false, false, 0, v_order.status::TEXT, 'Conflict: Refund ID collision with mismatched immutable attributes'::TEXT;
            RETURN;
        END IF;

        -- Legitimate exact replay returns original success without modifying state or failing
        RETURN QUERY SELECT true, true, 0, v_order.status::TEXT, 'Refund already processed (idempotent replay)'::TEXT;
        RETURN;
    END IF;

    -- 4. New Refund Validation: Currency
    IF p_refund_currency IS DISTINCT FROM v_payment.currency THEN
        RETURN QUERY SELECT false, false, 0, v_order.status::TEXT, 'Currency mismatch against captured payment currency'::TEXT;
        RETURN;
    END IF;

    -- 5. Product-Level Allocation Limits
    IF p_product_id IS NOT NULL THEN
        -- Verify product belongs to order
        SELECT COALESCE(SUM(total_price), 0) INTO v_product_price_total 
        FROM public.order_items 
        WHERE order_id = p_order_id AND product_id = p_product_id;

        IF v_product_price_total = 0 THEN
            RETURN QUERY SELECT false, false, 0, v_order.status::TEXT, 'Product does not belong to the order or has zero price'::TEXT;
            RETURN;
        END IF;

        -- Sum previously processed refunds for this specific product
        SELECT COALESCE(SUM(amount), 0) INTO v_product_previously_refunded 
        FROM public.refunds 
        WHERE order_id = p_order_id AND product_id = p_product_id AND status = 'processed';

        -- Reject if this refund would exceed product price
        IF (v_product_previously_refunded + p_refund_amount) > v_product_price_total THEN
            RETURN QUERY SELECT false, false, 0, v_order.status::TEXT, 'Refund violation: Refund allocation exceeds product remaining balance'::TEXT;
            RETURN;
        END IF;
    END IF;

    -- 6. Total Payment Cumulative Limit
    SELECT COALESCE(SUM(amount), 0) INTO v_total_order_refunded
    FROM public.refunds WHERE order_id = p_order_id AND status = 'processed';

    IF (v_total_order_refunded + p_refund_amount) > v_payment.amount THEN
        RETURN QUERY SELECT false, false, 0, v_order.status::TEXT, 'Refund violation: Cumulative refunds exceed captured payment amount'::TEXT;
        RETURN;
    END IF;

    -- 7. Insert into Refunds Ledger
    INSERT INTO public.refunds (
        order_id, payment_id, product_id, gateway, gateway_refund_id,
        amount, currency, reason, status, raw_response, created_at, updated_at
    ) VALUES (
        p_order_id, p_payment_id, p_product_id, v_payment.gateway, p_gateway_refund_id,
        p_refund_amount, p_refund_currency, p_reason, 'processed', p_raw_payload, NOW(), NOW()
    );

    -- 8. Apply Product-Level Entitlement Revocation (only if product is now 100% refunded)
    IF p_product_id IS NOT NULL THEN
        IF (v_product_previously_refunded + p_refund_amount) >= v_product_price_total THEN
            UPDATE public.download_entitlements
            SET is_active = FALSE,
                is_revoked = TRUE,
                revocation_reason = COALESCE(p_reason, 'refund'),
                revoked_at = NOW(),
                updated_at = NOW()
            WHERE order_id = p_order_id 
              AND digital_asset_id IN (SELECT id FROM public.digital_assets WHERE product_id = p_product_id)
              AND is_revoked = FALSE;

            GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
            v_revoked_count := v_revoked_count + v_rows_affected;
        END IF;
    END IF;

    -- 9. Full Order Refund Rule
    IF (v_total_order_refunded + p_refund_amount) >= v_order.total_amount THEN
        UPDATE public.orders 
        SET status = 'refunded', payment_status = 'refunded', updated_at = NOW() 
        WHERE id = p_order_id;

        UPDATE public.download_entitlements
        SET is_active = FALSE,
            is_revoked = TRUE,
            revocation_reason = 'refund',
            revoked_at = NOW(),
            updated_at = NOW()
        WHERE order_id = p_order_id AND is_revoked = FALSE;

        GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
        v_revoked_count := v_revoked_count + v_rows_affected;
    END IF;

    -- Re-read order status to ensure fresh return state
    SELECT status INTO v_order.status FROM public.orders WHERE id = p_order_id;

    RETURN QUERY SELECT true, false, v_revoked_count, v_order.status::TEXT, 'Refund recorded successfully'::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.process_order_refund(UUID, UUID, UUID, TEXT, DECIMAL, TEXT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_order_refund(UUID, UUID, UUID, TEXT, DECIMAL, TEXT, TEXT, JSONB) TO service_role;

-- 6. OUTBOX WORKER LEASE & JOB MANAGEMENT (With Stale-Job Recovery & Ownership Token)
CREATE OR REPLACE FUNCTION public.claim_pending_delivery_jobs(
    p_batch_size INT DEFAULT 10,
    p_lease_seconds INT DEFAULT 120,
    p_worker_token UUID DEFAULT extensions.gen_random_uuid()
)
RETURNS TABLE (
    job_id UUID,
    order_id UUID,
    customer_email VARCHAR(255),
    encrypted_token_payload TEXT,
    lease_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    WITH available_jobs AS (
        SELECT id
        FROM public.order_delivery_outbox
        WHERE (
            -- Pending or failed retry ready for polling
            (delivery_status IN ('pending', 'failed') AND next_retry_at <= NOW())
            OR 
            -- Stale-job recovery: processing lease expired
            (delivery_status = 'processing' AND lease_expires_at <= NOW())
        )
          AND retry_count < 5
          AND expires_at > NOW()
        ORDER BY created_at ASC
        LIMIT p_batch_size
        FOR UPDATE SKIP LOCKED
    )
    UPDATE public.order_delivery_outbox o
    SET delivery_status = 'processing',
        lease_token = p_worker_token,
        lease_expires_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        next_retry_at = NOW() + (p_lease_seconds || ' seconds')::INTERVAL,
        updated_at = NOW()
    FROM available_jobs a
    WHERE o.id = a.id
    RETURNING o.id, o.order_id, o.customer_email, o.encrypted_token_payload, o.lease_token;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_delivery_jobs(INT, INT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_delivery_jobs(INT, INT, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_delivery_job(
    p_job_id UUID,
    p_lease_token UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rows INT;
BEGIN
    UPDATE public.order_delivery_outbox
    SET delivery_status = 'delivered',
        delivered_at = NOW(),
        lease_token = NULL,
        lease_expires_at = NULL,
        updated_at = NOW()
    WHERE id = p_job_id AND lease_token = p_lease_token;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_delivery_job(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_delivery_job(UUID, UUID) TO service_role;

CREATE OR REPLACE FUNCTION public.fail_delivery_job(
    p_job_id UUID,
    p_lease_token UUID,
    p_error_msg TEXT DEFAULT NULL,
    p_backoff_seconds INT DEFAULT 300
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_retries INT;
    v_rows INT;
BEGIN
    SELECT retry_count INTO v_retries 
    FROM public.order_delivery_outbox 
    WHERE id = p_job_id AND lease_token = p_lease_token;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF v_retries + 1 >= 5 THEN
        UPDATE public.order_delivery_outbox
        SET delivery_status = 'exhausted',
            retry_count = retry_count + 1,
            lease_token = NULL,
            lease_expires_at = NULL,
            last_error = p_error_msg,
            updated_at = NOW()
        WHERE id = p_job_id AND lease_token = p_lease_token;
    ELSE
        UPDATE public.order_delivery_outbox
        SET delivery_status = 'failed',
            retry_count = retry_count + 1,
            lease_token = NULL,
            lease_expires_at = NULL,
            next_retry_at = NOW() + (p_backoff_seconds || ' seconds')::INTERVAL,
            last_error = p_error_msg,
            updated_at = NOW()
        WHERE id = p_job_id AND lease_token = p_lease_token;
    END IF;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.fail_delivery_job(UUID, UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fail_delivery_job(UUID, UUID, TEXT, INT) TO service_role;

COMMIT;
