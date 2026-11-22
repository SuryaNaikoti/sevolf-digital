-- =============================================================================
-- SEVOLF Phase 1C: Digital Commerce Fulfilment, Payments & Claims Migration
-- Migration: 20260220_phase1c_fulfilment_and_claims.sql
-- Dependencies: 20260218_initial_sevolf_digital_commerce.sql, 20260218_pricing_and_currency_engine.sql
-- =============================================================================

BEGIN;

-- 1. Ensure required cryptographic extension
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. ORDERS TABLE MODIFICATIONS
-- Add is_sandbox column to orders for strict non-production cart isolation
ALTER TABLE public.orders 
    ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. DIGITAL ASSETS TABLE MODIFICATIONS
-- Add is_active and updated_at for asset availability gates
ALTER TABLE public.digital_assets 
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. PAYMENT ATTEMPTS LEDGER (Pre-Checkout Intent)
CREATE TABLE IF NOT EXISTS public.payment_attempts (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    gateway VARCHAR(50) NOT NULL CHECK (gateway IN ('razorpay', 'stripe')),
    gateway_order_id VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'created' 
        CHECK (status IN ('created', 'authorized', 'captured', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payment_attempts_gateway_order UNIQUE (gateway, gateway_order_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_attempts_order_id 
    ON public.payment_attempts(order_id);

ALTER TABLE public.payment_attempts ENABLE ROW LEVEL SECURITY;

-- 5. PAYMENTS TABLE MODIFICATIONS
ALTER TABLE public.payments 
    ADD COLUMN IF NOT EXISTS payment_attempt_id UUID NULL REFERENCES public.payment_attempts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_gateway_txn 
    ON public.payments (gateway, gateway_transaction_id) 
    WHERE gateway_transaction_id IS NOT NULL;

-- 6. DOWNLOAD ENTITLEMENTS MODIFICATIONS (Hash-At-Rest & State Model)
ALTER TABLE public.download_entitlements
    ALTER COLUMN token DROP NOT NULL,
    ALTER COLUMN expires_at DROP NOT NULL,
    ADD COLUMN IF NOT EXISTS token_hash CHAR(64) NULL,
    ADD COLUMN IF NOT EXISTS is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS revocation_reason VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Backfill existing legacy plaintext tokens into token_hash
UPDATE public.download_entitlements
SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex')
WHERE token IS NOT NULL AND token_hash IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_download_entitlements_token_hash 
    ON public.download_entitlements (token_hash) 
    WHERE token_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_download_entitlements_order_asset 
    ON public.download_entitlements (order_id, digital_asset_id);

CREATE INDEX IF NOT EXISTS idx_download_entitlements_lookup 
    ON public.download_entitlements (token_hash, token) 
    WHERE is_revoked = FALSE;

-- 7. REFUNDS LEDGER (Authoritative Line-Item Financial Ledger)
CREATE TABLE IF NOT EXISTS public.refunds (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
    payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
    product_id UUID NULL REFERENCES public.products(id) ON DELETE RESTRICT,
    gateway VARCHAR(50) NOT NULL CHECK (gateway IN ('razorpay', 'stripe')),
    gateway_refund_id VARCHAR(255) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(10) NOT NULL,
    reason TEXT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processed' 
        CHECK (status IN ('pending', 'processed', 'failed')),
    raw_response JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_refunds_gateway_refund UNIQUE (gateway, gateway_refund_id)
);

CREATE INDEX IF NOT EXISTS idx_refunds_order_product 
    ON public.refunds (order_id, product_id);

ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;

-- 8. DOWNLOAD CLAIMS LEDGER (Atomic Quota & Mutex Reservation)
CREATE TABLE IF NOT EXISTS public.download_claims (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    entitlement_id UUID NOT NULL REFERENCES public.download_entitlements(id) ON DELETE CASCADE,
    idempotency_key VARCHAR(255) NOT NULL,
    claim_token UUID NOT NULL DEFAULT extensions.gen_random_uuid(),
    status VARCHAR(50) NOT NULL DEFAULT 'claimed' 
        CHECK (status IN ('claimed', 'url_issued', 'failed', 'expired')),
    failure_reason VARCHAR(100) NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_download_claims_idempotency UNIQUE (entitlement_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_download_claims_status_expires 
    ON public.download_claims (status, expires_at);

ALTER TABLE public.download_claims ENABLE ROW LEVEL SECURITY;

-- 9. ORDER DELIVERY OUTBOX (Durable Encrypted Email Delivery with Leases)
CREATE TABLE IF NOT EXISTS public.order_delivery_outbox (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    entitlement_id UUID NOT NULL REFERENCES public.download_entitlements(id) ON DELETE CASCADE,
    customer_email VARCHAR(255) NOT NULL,
    encrypted_token_payload TEXT NOT NULL, -- AES-256-GCM format: v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
    delivery_status VARCHAR(50) NOT NULL DEFAULT 'pending' 
        CHECK (delivery_status IN ('pending', 'processing', 'delivered', 'failed', 'exhausted')),
    retry_count INT NOT NULL DEFAULT 0,
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lease_token UUID NULL,
    lease_expires_at TIMESTAMPTZ NULL,
    delivered_at TIMESTAMPTZ NULL,
    last_error TEXT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '72 hours'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_outbox_worker 
    ON public.order_delivery_outbox (delivery_status, next_retry_at);

CREATE INDEX IF NOT EXISTS idx_delivery_outbox_stale 
    ON public.order_delivery_outbox (delivery_status, lease_expires_at)
    WHERE delivery_status = 'processing';

ALTER TABLE public.order_delivery_outbox ENABLE ROW LEVEL SECURITY;

-- 10. RLS POLICIES FOR NEW TABLES

-- Payment attempts: users view own attempts via parent order
CREATE POLICY "Users can view own payment attempts"
    ON public.payment_attempts FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = payment_attempts.order_id 
          AND (o.user_id = (SELECT auth.uid()) OR o.customer_email = ((SELECT auth.jwt()) ->> 'email'))
    ));

CREATE POLICY "Admins have full access to payment attempts"
    ON public.payment_attempts FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

-- Refunds: users view own refunds via parent order
CREATE POLICY "Users can view own refunds"
    ON public.refunds FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = refunds.order_id 
          AND (o.user_id = (SELECT auth.uid()) OR o.customer_email = ((SELECT auth.jwt()) ->> 'email'))
    ));

CREATE POLICY "Admins have full access to refunds"
    ON public.refunds FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

-- Claims: strictly admin or service role
CREATE POLICY "Admins have full access to download claims"
    ON public.download_claims FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

-- Outbox: strictly admin or service role (never exposed to customers)
CREATE POLICY "Admins have full access to delivery outbox"
    ON public.order_delivery_outbox FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

COMMIT;
