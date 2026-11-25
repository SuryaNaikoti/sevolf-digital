-- =============================================================================
-- SEVOLF Digital: Production Remediation V1 - Payment Environment Architecture
-- Migration: 20261125_payment_environment_and_revenue_integrity.sql
-- =============================================================================

BEGIN;

-- 1. ADD ENVIRONMENT COLUMNS TO PAYMENTS, PAYMENT_ATTEMPTS, AND ORDERS
-- Support 'test', 'live', and 'unknown' environments.
-- Check constraints enforce permissible environment values.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'environment'
    ) THEN
        ALTER TABLE public.payments 
        ADD COLUMN environment VARCHAR(20) NOT NULL DEFAULT 'unknown' 
        CHECK (environment IN ('test', 'live', 'unknown'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_attempts' AND column_name = 'environment'
    ) THEN
        ALTER TABLE public.payment_attempts 
        ADD COLUMN environment VARCHAR(20) NOT NULL DEFAULT 'unknown' 
        CHECK (environment IN ('test', 'live', 'unknown'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'environment'
    ) THEN
        ALTER TABLE public.orders 
        ADD COLUMN environment VARCHAR(20) NOT NULL DEFAULT 'unknown' 
        CHECK (environment IN ('test', 'live', 'unknown'));
    END IF;
END $$;

-- Create indexes for environment querying
CREATE INDEX IF NOT EXISTS idx_payments_environment ON public.payments (environment);
CREATE INDEX IF NOT EXISTS idx_orders_environment ON public.orders (environment);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_environment ON public.payment_attempts (environment);

-- 2. BACKFILL HISTORICAL TRANSACTIONS
-- Strict rule: Only backfill where origin can be authoritatively and reliably verified.
-- Any ambiguous record remains 'unknown' for manual operator review.

-- A: If order is canonical sandbox (is_sandbox = TRUE) -> 'test'
UPDATE public.orders
SET environment = 'test'
WHERE is_sandbox = TRUE AND environment = 'unknown';

-- B: If order is ORD-369819 (verified created with Razorpay Test Mode during pre-launch) -> 'test'
UPDATE public.orders
SET environment = 'test'
WHERE order_number = 'ORD-369819' AND environment = 'unknown';

-- C: Backfill payment_attempts from order environment
UPDATE public.payment_attempts pa
SET environment = o.environment
FROM public.orders o
WHERE pa.order_id = o.id AND o.environment IN ('test', 'live') AND pa.environment = 'unknown';

-- D: Backfill payments from payment_attempts or known orders
UPDATE public.payments p
SET environment = o.environment
FROM public.orders o
WHERE p.order_id = o.id AND o.environment IN ('test', 'live') AND p.environment = 'unknown';

-- Also backfill payment for ORD-369819 explicitly
UPDATE public.payments
SET environment = 'test'
WHERE gateway_transaction_id = 'pay_U3vTcIXy6pScr5';

-- 3. WEBHOOK EVENT ATOMIC CLAIMING & UNIQUE CONSTRAINT
-- Verify and ensure unique index on (gateway, event_id) and add claimed_at / processing lock
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'payment_webhook_events' AND column_name = 'processing_claimed_at'
    ) THEN
        ALTER TABLE public.payment_webhook_events 
        ADD COLUMN processing_claimed_at TIMESTAMPTZ NULL;
    END IF;
END $$;

DROP INDEX IF EXISTS public.uq_webhook_events_gateway_event;
CREATE UNIQUE INDEX IF NOT EXISTS uq_webhook_events_gateway_event
    ON public.payment_webhook_events (gateway, event_id);

-- Atomic Webhook Claim Function
CREATE OR REPLACE FUNCTION public.claim_webhook_event(
    p_gateway TEXT,
    p_event_id TEXT,
    p_event_type TEXT,
    p_raw_payload JSONB
)
RETURNS TABLE (
    claim_status TEXT, -- 'claimed', 'already_processed', 'already_processing'
    record_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_rec RECORD;
BEGIN
    SELECT * INTO v_rec 
    FROM public.payment_webhook_events 
    WHERE gateway = p_gateway AND event_id = p_event_id
    FOR UPDATE;

    IF FOUND THEN
        IF v_rec.status = 'processed' THEN
            RETURN QUERY SELECT 'already_processed'::TEXT, v_rec.id;
            RETURN;
        ELSIF v_rec.status = 'processing' AND v_rec.processing_claimed_at > NOW() - INTERVAL '2 minutes' THEN
            -- Currently being actively processed by concurrent worker
            RETURN QUERY SELECT 'already_processing'::TEXT, v_rec.id;
            RETURN;
        ELSE
            -- Retry stale processing or previously failed
            UPDATE public.payment_webhook_events
            SET status = 'processing',
                processing_claimed_at = NOW(),
                raw_payload = p_raw_payload
            WHERE id = v_rec.id;
            RETURN QUERY SELECT 'claimed'::TEXT, v_rec.id;
            RETURN;
        END IF;
    ELSE
        -- Insert new event with processing status
        INSERT INTO public.payment_webhook_events (
            gateway, event_id, event_type, status, processing_claimed_at, raw_payload, received_at
        ) VALUES (
            p_gateway, p_event_id, p_event_type, 'processing', NOW(), p_raw_payload, NOW()
        )
        RETURNING id INTO v_rec;
        RETURN QUERY SELECT 'claimed'::TEXT, v_rec.id;
        RETURN;
    END IF;
END;
$$;

-- 4. UPDATE PROCESS_ORDER_CAPTURE TO PRESERVE PERSISTED ENVIRONMENT
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
                    RAISE EXCEPTION 'Fulfilment security failure: Missing cryptographic delivery payload for asset %', v_asset_id;
                END IF;

                IF v_entitlement_exists THEN
                    -- Update existing unrevoked entitlement
                    UPDATE public.download_entitlements
                    SET is_active = TRUE,
                        token_hash = v_payload.token_hash,
                        encrypted_delivery_token = v_payload.encrypted_payload,
                        updated_at = NOW()
                    WHERE id = v_existing_entitlement.id;
                    v_new_entitlements_count := v_new_entitlements_count + 1;
                ELSE
                    -- Insert new download entitlement
                    INSERT INTO public.download_entitlements (
                        order_id,
                        user_id,
                        customer_email,
                        product_id,
                        digital_asset_id,
                        download_count,
                        max_downloads,
                        token_hash,
                        encrypted_delivery_token,
                        expires_at,
                        is_active,
                        is_revoked,
                        created_at,
                        updated_at
                    ) VALUES (
                        p_order_id,
                        v_order.user_id,
                        v_order.customer_email,
                        v_asset_product_id,
                        v_asset_id,
                        0,
                        5,
                        v_payload.token_hash,
                        v_payload.encrypted_payload,
                        NOW() + INTERVAL '48 hours',
                        TRUE,
                        FALSE,
                        NOW(),
                        NOW()
                    )
                    RETURNING id INTO v_new_entitlement_id;

                    v_new_entitlements_count := v_new_entitlements_count + 1;
                END IF;

                -- Insert into transactional delivery outbox
                INSERT INTO public.delivery_outbox (
                    order_id,
                    recipient_email,
                    payload,
                    status,
                    created_at,
                    updated_at
                ) VALUES (
                    p_order_id,
                    v_order.customer_email,
                    jsonb_build_object(
                        'order_id', p_order_id,
                        'order_number', v_order.order_number,
                        'asset_id', v_asset_id,
                        'product_id', v_asset_product_id,
                        'encrypted_token', v_payload.encrypted_payload
                    ),
                    'pending',
                    NOW(),
                    NOW()
                );
            END IF;
        END LOOP;
    END IF;

    -- Gate 8: Audit Log
    INSERT INTO public.fulfilment_audit_logs (
        order_id,
        action,
        status,
        details,
        ip_address,
        user_agent
    ) VALUES (
        p_order_id,
        'ORDER_CAPTURED_AND_FULFILLED',
        'SUCCESS',
        jsonb_build_object(
            'gateway_txn_id', p_gateway_transaction_id,
            'gateway_order_id', p_gateway_order_id,
            'amount', p_charged_amount,
            'currency', p_charged_currency,
            'environment', v_resolved_env,
            'entitlements_created', v_new_entitlements_count
        ),
        NULL,
        NULL
    );

    SELECT COUNT(*) INTO v_final_active_count 
    FROM public.download_entitlements 
    WHERE order_id = p_order_id AND is_active = TRUE AND is_revoked = FALSE;

    RETURN QUERY SELECT true, false, v_new_entitlements_count, v_final_active_count, 'Payment captured and fulfilled successfully'::TEXT;
END;
$$;

-- 5. AUTHORITATIVE STOREWIDE REVENUE & FULFILMENT METRICS RPC
CREATE OR REPLACE FUNCTION public.get_admin_storewide_metrics()
RETURNS TABLE (
    gross_sales DECIMAL(12, 2),
    total_refunds DECIMAL(12, 2),
    net_revenue DECIMAL(12, 2),
    live_orders_count INT,
    live_paid_orders_count INT,
    test_orders_count INT,
    test_revenue DECIMAL(12, 2),
    pending_payments_count INT,
    failed_payments_count INT,
    total_eligible_fulfilment_orders INT,
    fully_fulfilled_orders_count INT,
    fulfilment_rate_percent INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_gross_sales DECIMAL(12, 2) := 0;
    v_total_refunds DECIMAL(12, 2) := 0;
    v_net_revenue DECIMAL(12, 2) := 0;
    v_live_orders_count INT := 0;
    v_live_paid_orders_count INT := 0;
    v_test_orders_count INT := 0;
    v_test_revenue DECIMAL(12, 2) := 0;
    v_pending_payments INT := 0;
    v_failed_payments INT := 0;
    v_eligible_fulfilment INT := 0;
    v_fully_fulfilled INT := 0;
    v_fulfilment_rate INT := 0;
    v_order RECORD;
    v_expected_assets_count INT;
    v_delivered_entitlements_count INT;
BEGIN
    -- Live Commercial Gross Sales (orders where environment = 'live' and status in ('paid', 'fulfilled', 'completed'))
    SELECT 
        COALESCE(SUM(o.total_amount), 0),
        COUNT(*)
    INTO v_gross_sales, v_live_paid_orders_count
    FROM public.orders o
    WHERE o.environment = 'live'
      AND o.is_sandbox = FALSE
      AND o.status IN ('paid', 'fulfilled', 'completed');

    -- Total Live Commercial Orders (all statuses)
    SELECT COUNT(*) INTO v_live_orders_count
    FROM public.orders o
    WHERE o.environment = 'live' AND o.is_sandbox = FALSE;

    -- Total Live Refunds (processed refunds for live orders)
    SELECT COALESCE(SUM(r.amount), 0) INTO v_total_refunds
    FROM public.refunds r
    JOIN public.orders o ON r.order_id = o.id
    WHERE o.environment = 'live'
      AND o.is_sandbox = FALSE
      AND r.status = 'processed';

    -- Net Revenue = Gross Sales - Total Refunds
    v_net_revenue := GREATEST(0, v_gross_sales - v_total_refunds);

    -- Test Orders Count & Test Revenue (environment = 'test' or is_sandbox = TRUE)
    SELECT 
        COUNT(*),
        COALESCE(SUM(o.total_amount), 0)
    INTO v_test_orders_count, v_test_revenue
    FROM public.orders o
    WHERE (o.environment = 'test' OR o.is_sandbox = TRUE)
      AND o.status IN ('paid', 'fulfilled', 'completed');

    -- Payment states across store
    SELECT COUNT(*) INTO v_pending_payments
    FROM public.payments
    WHERE status IN ('created', 'authorized');

    SELECT COUNT(*) INTO v_failed_payments
    FROM public.payments
    WHERE status = 'failed';

    -- Complete storewide fulfilment calculation across ALL eligible paid orders (live & test)
    FOR v_order IN 
        SELECT o.id
        FROM public.orders o
        WHERE o.status IN ('paid', 'fulfilled', 'completed')
          OR o.payment_status IN ('paid', 'captured')
    LOOP
        v_eligible_fulfilment := v_eligible_fulfilment + 1;

        -- Count total expected active digital assets for this order's products
        SELECT COUNT(DISTINCT da.id) INTO v_expected_assets_count
        FROM public.order_items oi
        JOIN public.digital_assets da ON da.product_id = oi.product_id
        WHERE oi.order_id = v_order.id AND da.is_active = TRUE;

        -- Count active, unrevoked download entitlements delivered
        SELECT COUNT(DISTINCT de.digital_asset_id) INTO v_delivered_entitlements_count
        FROM public.download_entitlements de
        WHERE de.order_id = v_order.id 
          AND de.is_active = TRUE 
          AND de.is_revoked = FALSE;

        -- An order is fully fulfilled if every expected asset has a valid delivered entitlement
        IF v_expected_assets_count > 0 AND v_delivered_entitlements_count >= v_expected_assets_count THEN
            v_fully_fulfilled := v_fully_fulfilled + 1;
        ELSIF v_expected_assets_count = 0 AND v_delivered_entitlements_count > 0 THEN
            v_fully_fulfilled := v_fully_fulfilled + 1;
        END IF;
    END LOOP;

    IF v_eligible_fulfilment > 0 THEN
        v_fulfilment_rate := ROUND((v_fully_fulfilled::DECIMAL / v_eligible_fulfilment::DECIMAL) * 100);
    ELSE
        v_fulfilment_rate := 0;
    END IF;

    RETURN QUERY SELECT 
        v_gross_sales,
        v_total_refunds,
        v_net_revenue,
        v_live_orders_count,
        v_live_paid_orders_count,
        v_test_orders_count,
        v_test_revenue,
        v_pending_payments,
        v_failed_payments,
        v_eligible_fulfilment,
        v_fully_fulfilled,
        v_fulfilment_rate;
END;
$$;

COMMIT;
