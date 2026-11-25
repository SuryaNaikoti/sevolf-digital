-- =============================================================================
-- SEVOLF Digital: Fix process_order_capture Schema Alignment
-- Migration: 20261125_fix_process_order_capture_schema.sql
-- Description:
--   Restores public.process_order_capture to align with the authoritative
--   public.download_entitlements (digital_asset_id, download_limit, expires_at)
--   and public.order_delivery_outbox tables, while preserving:
--   1. Authoritative payment environment tracking ('test', 'live', 'unknown').
--   2. Gate checks (parameter validation, order lock, line item checks, sandbox isolation).
--   3. Idempotent payment replay protection with row-level locks.
-- =============================================================================

BEGIN;

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
    v_resolved_env VARCHAR(20) := 'unknown';

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

    -- Resolve authoritative environment: preference from attempt, fallback to order
    IF v_attempt.environment IN ('test', 'live') THEN
        v_resolved_env := v_attempt.environment;
    ELSIF v_order.environment IN ('test', 'live') THEN
        v_resolved_env := v_order.environment;
    ELSIF v_order.is_sandbox = TRUE THEN
        v_resolved_env := 'test';
    ELSE
        v_resolved_env := 'unknown';
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

    -- Gate 5: Payment Ledger Insertion with Persisted Environment
    INSERT INTO public.payments (
        order_id, payment_attempt_id, gateway, gateway_transaction_id, gateway_order_id,
        amount, currency, status, environment, raw_response, created_at, updated_at
    ) VALUES (
        p_order_id, v_attempt.id, 'razorpay', p_gateway_transaction_id, p_gateway_order_id,
        p_charged_amount, p_charged_currency, 'captured', v_resolved_env, p_raw_payload, NOW(), NOW()
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
            SET status = 'captured', 
                environment = v_resolved_env,
                raw_response = p_raw_payload, 
                updated_at = NOW() 
            WHERE id = v_payment.id;
        ELSE
            RETURN QUERY SELECT false, false, 0, 0, ('Conflict: Existing payment is in terminal non-captured status ' || v_payment.status)::TEXT;
            RETURN;
        END IF;
    END IF;

    -- Gate 6: Update Attempt and Order Status with Authoritative Environment
    UPDATE public.payment_attempts 
    SET status = 'captured', 
        environment = v_resolved_env,
        updated_at = NOW() 
    WHERE id = v_attempt.id;

    UPDATE public.orders 
    SET status = 'paid', 
        payment_status = 'captured', 
        environment = v_resolved_env,
        updated_at = NOW() 
    WHERE id = p_order_id;

    -- Gate 7: Entitlement & Durable Outbox Creation (Aligned with public.download_entitlements schema)
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
                    -- Update existing unrevoked entitlement
                    UPDATE public.download_entitlements
                    SET token = NULL,
                        token_hash = v_payload.token_hash,
                        is_active = TRUE,
                        updated_at = NOW()
                    WHERE id = v_existing_entitlement.id
                    RETURNING id INTO v_new_entitlement_id;
                ELSE
                    -- Fresh Insert into public.download_entitlements (Matching actual table columns)
                    INSERT INTO public.download_entitlements (
                        order_id,
                        user_id,
                        customer_email,
                        digital_asset_id,
                        token,
                        token_hash,
                        download_limit,
                        download_count,
                        expires_at,
                        is_active,
                        is_revoked,
                        created_at,
                        updated_at
                    ) VALUES (
                        p_order_id,
                        v_order.user_id,
                        v_order.customer_email,
                        v_asset_id,
                        NULL,
                        v_payload.token_hash,
                        10,
                        0,
                        NOW() + INTERVAL '30 days',
                        TRUE,
                        FALSE,
                        NOW(),
                        NOW()
                    )
                    RETURNING id INTO v_new_entitlement_id;
                END IF;

                -- Insert into Durable Delivery Outbox (public.order_delivery_outbox)
                INSERT INTO public.order_delivery_outbox (
                    order_id,
                    entitlement_id,
                    customer_email,
                    encrypted_token_payload,
                    delivery_status,
                    retry_count,
                    next_retry_at,
                    expires_at,
                    created_at,
                    updated_at
                ) VALUES (
                    p_order_id,
                    v_new_entitlement_id,
                    v_order.customer_email,
                    v_payload.encrypted_payload,
                    'pending',
                    0,
                    NOW(),
                    NOW() + INTERVAL '72 hours',
                    NOW(),
                    NOW()
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

NOTIFY pgrst, 'reload schema';

COMMIT;
