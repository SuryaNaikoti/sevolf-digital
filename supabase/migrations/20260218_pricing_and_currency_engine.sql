-- ==============================================================================
-- SEVOLF DIGITAL COMMERCE PLATFORM - PRICING & CURRENCY SCHEMA MIGRATION
-- Migration: 20260218_pricing_and_currency_engine.sql
-- Target Database: Singapore (AWS ap-southeast-1) - Project: kqoqdxoicqxulefnruvn
-- Scope: Phase 1B Commerce Engine (Payment Uniqueness, Entitlement Uniqueness,
--        Exchange Rate History, Order Currency Snapshots, Webhook Idempotency)
-- ==============================================================================

-- ==============================================================================
-- 1. PAYMENT INDEXES AND UNIQUENESS
-- ==============================================================================
-- Accelerate order lookup and reconciliation by Razorpay Gateway Order and Transaction IDs
CREATE INDEX IF NOT EXISTS idx_payments_gateway_order
    ON public.payments (gateway, gateway_order_id);

CREATE INDEX IF NOT EXISTS idx_payments_gateway_transaction
    ON public.payments (gateway, gateway_transaction_id);

-- Enforce partial uniqueness: Prevent duplicate payment capture rows for identical gateway transaction IDs
-- Uses WHERE gateway_transaction_id IS NOT NULL (safe against initial pending state rows)
DROP INDEX IF EXISTS public.uq_payments_gateway_transaction;
CREATE UNIQUE INDEX uq_payments_gateway_transaction
    ON public.payments (gateway, gateway_transaction_id)
    WHERE gateway_transaction_id IS NOT NULL;

-- ==============================================================================
-- 2. ENTITLEMENT UNIQUENESS
-- ==============================================================================
-- Prevent duplicate asset entitlement generation for the same order and digital asset
DROP INDEX IF EXISTS public.uq_entitlements_order_asset;
CREATE UNIQUE INDEX uq_entitlements_order_asset
    ON public.download_entitlements (order_id, digital_asset_id);

-- ==============================================================================
-- 3. CURRENCY EXCHANGE RATE HISTORY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.currency_exchange_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    target_currency VARCHAR(10) NOT NULL,
    exchange_rate DECIMAL(14, 6) NOT NULL CHECK (exchange_rate > 0),
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source VARCHAR(50) NOT NULL DEFAULT 'system_configured',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for rapid lookup of most recent exchange rate for a given target currency
CREATE INDEX IF NOT EXISTS idx_currency_exchange_rates_lookup
    ON public.currency_exchange_rates (base_currency, target_currency, fetched_at DESC);

-- Enable Row Level Security
ALTER TABLE public.currency_exchange_rates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for currency_exchange_rates:
-- Public can read exchange rates for transparent storefront display
DROP POLICY IF EXISTS "Public can view currency exchange rates" ON public.currency_exchange_rates;
CREATE POLICY "Public can view currency exchange rates"
    ON public.currency_exchange_rates FOR SELECT
    USING (true);

-- Only Administrators (or service_role) can insert or manage exchange rates
DROP POLICY IF EXISTS "Admins have full access to exchange rates" ON public.currency_exchange_rates;
CREATE POLICY "Admins have full access to exchange rates"
    ON public.currency_exchange_rates FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

-- ==============================================================================
-- 4. ORDER CURRENCY SNAPSHOTS
-- ==============================================================================
-- Extend public.orders to capture immutable snapshot of exchange rate and base/charged monetary amounts
-- Preserves existing columns (subtotal, total_amount, currency) for backward compatibility
ALTER TABLE public.orders
    ADD COLUMN IF NOT EXISTS base_currency VARCHAR(10) DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS base_amount DECIMAL(12, 2) CHECK (base_amount IS NULL OR base_amount >= 0),
    ADD COLUMN IF NOT EXISTS charged_currency VARCHAR(10) DEFAULT 'INR',
    ADD COLUMN IF NOT EXISTS charged_amount DECIMAL(12, 2) CHECK (charged_amount IS NULL OR charged_amount >= 0),
    ADD COLUMN IF NOT EXISTS exchange_rate_used DECIMAL(14, 6) CHECK (exchange_rate_used IS NULL OR exchange_rate_used > 0),
    ADD COLUMN IF NOT EXISTS exchange_rate_source VARCHAR(50),
    ADD COLUMN IF NOT EXISTS exchange_rate_timestamp TIMESTAMPTZ;

-- Add index on charged_currency to support international vs domestic sales reporting
CREATE INDEX IF NOT EXISTS idx_orders_charged_currency
    ON public.orders (charged_currency, status);

-- ==============================================================================
-- 5. WEBHOOK EVENT IDEMPOTENCY
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.payment_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gateway VARCHAR(50) NOT NULL DEFAULT 'razorpay' CHECK (gateway = 'razorpay'),
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'processing', 'processed', 'ignored', 'failed')),
    raw_payload JSONB NOT NULL,
    error_details TEXT,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

-- Enforce uniqueness on gateway and event identifier to prevent duplicate processing
DROP INDEX IF EXISTS public.uq_webhook_events_gateway_event;
CREATE UNIQUE INDEX uq_webhook_events_gateway_event
    ON public.payment_webhook_events (gateway, event_id);

-- Index for webhook status queries and monitoring
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_status
    ON public.payment_webhook_events (status, received_at DESC);

-- Enable Row Level Security
ALTER TABLE public.payment_webhook_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payment_webhook_events:
-- Public/anonymous has ZERO access. No public read, insert, update, or delete.
-- Only Administrators (or service_role executing webhook route) have full access.
DROP POLICY IF EXISTS "Admins have full access to webhook events" ON public.payment_webhook_events;
CREATE POLICY "Admins have full access to webhook events"
    ON public.payment_webhook_events FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

-- ==============================================================================
-- 6. VERIFICATION FUNCTION (Read-Only)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.verify_phase_1b_schema()
RETURNS TABLE (
    check_name TEXT,
    is_satisfied BOOLEAN,
    details TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Security role check: Restrict execution strictly to service_role or verified administrators
    IF NOT (
        (SELECT auth.role()) = 'service_role' OR 
        (SELECT public.is_admin())
    ) THEN
        RAISE EXCEPTION 'Unauthorized: Schema verification is restricted to service_role and verified administrators.';
    END IF;

    -- Check 1: Payment partial unique index exists in public schema, belongs to payments table,
    -- is unique, indexes exactly (gateway, gateway_transaction_id), and enforces non-null predicate
    RETURN QUERY
    SELECT 
        'uq_payments_gateway_transaction'::TEXT,
        EXISTS (
            SELECT 1 
            FROM pg_catalog.pg_index i
            JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
            JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'uq_payments_gateway_transaction'
              AND t.relname = 'payments'
              AND i.indisunique = true
              AND (
                  SELECT pg_catalog.array_agg(a.attname ORDER BY k.n)
                  FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS k(attnum, n)
                  JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
              ) = ARRAY['gateway'::name, 'gateway_transaction_id'::name]
              AND pg_catalog.pg_get_expr(i.indpred, i.indrelid) LIKE '%gateway_transaction_id IS NOT NULL%'
        ),
        'Partial unique index uq_payments_gateway_transaction on public.payments (gateway, gateway_transaction_id) with non-null predicate'::TEXT;

    -- Check 2: Entitlement unique index exists in public schema, belongs to download_entitlements table,
    -- is unique, and indexes exactly (order_id, digital_asset_id)
    RETURN QUERY
    SELECT 
        'uq_entitlements_order_asset'::TEXT,
        EXISTS (
            SELECT 1 
            FROM pg_catalog.pg_index i
            JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
            JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'uq_entitlements_order_asset'
              AND t.relname = 'download_entitlements'
              AND i.indisunique = true
              AND (
                  SELECT pg_catalog.array_agg(a.attname ORDER BY k.n)
                  FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS k(attnum, n)
                  JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
              ) = ARRAY['order_id'::name, 'digital_asset_id'::name]
        ),
        'Unique index uq_entitlements_order_asset on public.download_entitlements (order_id, digital_asset_id)'::TEXT;

    -- Check 3: currency_exchange_rates table exists in public schema and has Row Level Security enabled
    RETURN QUERY
    SELECT 
        'currency_exchange_rates'::TEXT,
        EXISTS (
            SELECT 1 
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relname = 'currency_exchange_rates'
              AND c.relkind = 'r'
              AND c.relrowsecurity = true
        ),
        'Table currency_exchange_rates exists in public schema and has Row Level Security (RLS) enabled'::TEXT;

    -- Check 4: All seven order currency snapshot columns exist on public.orders
    RETURN QUERY
    SELECT 
        'orders_currency_snapshots'::TEXT,
        (
            SELECT COUNT(DISTINCT column_name) = 7
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
              AND table_name = 'orders' 
              AND column_name IN (
                  'base_currency',
                  'base_amount',
                  'charged_currency',
                  'charged_amount',
                  'exchange_rate_used',
                  'exchange_rate_source',
                  'exchange_rate_timestamp'
              )
        ),
        'All seven currency snapshot columns exist on public.orders (base/charged amounts, currencies, exchange rate metadata)'::TEXT;

    -- Check 5: payment_webhook_events exists in public schema, has RLS enabled, and unique index
    -- uq_webhook_events_gateway_event exists, belongs to payment_webhook_events, is unique, and indexes (gateway, event_id)
    RETURN QUERY
    SELECT 
        'payment_webhook_events'::TEXT,
        (
            EXISTS (
                SELECT 1 
                FROM pg_catalog.pg_class c
                JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname = 'payment_webhook_events'
                  AND c.relkind = 'r'
                  AND c.relrowsecurity = true
            )
            AND
            EXISTS (
                SELECT 1 
                FROM pg_catalog.pg_index i
                JOIN pg_catalog.pg_class c ON c.oid = i.indexrelid
                JOIN pg_catalog.pg_class t ON t.oid = i.indrelid
                JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'public'
                  AND c.relname = 'uq_webhook_events_gateway_event'
                  AND t.relname = 'payment_webhook_events'
                  AND i.indisunique = true
                  AND (
                      SELECT pg_catalog.array_agg(a.attname ORDER BY k.n)
                      FROM pg_catalog.unnest(i.indkey) WITH ORDINALITY AS k(attnum, n)
                      JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                  ) = ARRAY['gateway'::name, 'event_id'::name]
            )
        ),
        'Table payment_webhook_events exists with RLS enabled and unique index on public.payment_webhook_events (gateway, event_id)'::TEXT;
END;
$$;

-- Security hardening: Revoke EXECUTE from PUBLIC, anon, and general authenticated patrons.
-- Grant execution strictly to service_role and authenticated users (who must pass is_admin() inside the function).
REVOKE EXECUTE ON FUNCTION public.verify_phase_1b_schema() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.verify_phase_1b_schema() FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_phase_1b_schema() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_phase_1b_schema() TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_phase_1b_schema() TO authenticated;
