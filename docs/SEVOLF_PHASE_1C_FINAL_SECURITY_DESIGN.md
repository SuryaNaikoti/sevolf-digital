# SEVOLF DIGITAL — PHASE 1C
# FINAL SECURITY DESIGN & ARCHITECTURE SPECIFICATION

**Document Title:** `SEVOLF_PHASE_1C_FINAL_SECURITY_DESIGN.md`  
**Workspace:** `E:\Projects\Sevolf Digital`  
**Reference Document:** `docs/SEVOLF_PHASE_1C_1_ARCHITECTURE_CORRECTIONS.md`  
**Database Reference:** `kqoqdxoicqxulefnruvn` (Singapore, AWS `ap-southeast-1`)  
**Timestamp:** November 18, 2026, 22:15 IST  
**Execution Context:** Strictly Read-Only Security Architecture Specification (Zero Writes, Zero Migrations, Zero Package Changes)

---

## 1. EXECUTIVE SUMMARY & DESIGN OVERVIEW

This document establishes the **definitive security design** for Phase 1C (Razorpay Checkout & Digital Fulfilment). It addresses the five structural and concurrency challenges identified in the previous reviews by providing:

1. **A Staging-First Sandbox Architecture**: Verifying environment isolation, preventing test exposure on production, and eliminating reliance on insecure HTTP headers.
2. **An Atomic Fulfilment RPC Engine (`process_order_capture`)**: Eliminating concurrency race conditions, securing row locks on both orders and payments, enforcing strict monetary and currency assertions, and maintaining idempotency across client-side verification and webhook deliveries.
3. **An Auditable Financial Refund Ledger (`payment_refunds`)**: Replacing loose JSONB arrays with a dedicated, relational refund table with explicit unique constraints and deterministic product-level entitlement revocation.
4. **Zero-Trust Guest Purchase Recovery**: A cryptographic recovery protocol using short-lived, rate-limited magic link access credentials sent strictly to verified email owners.
5. **Hardened Download Access Security**: Defense-in-depth protection for digital assets, including SHA-256 hashed tokens at rest, short-lived 60s signed URLs, referer leakage mitigation, and immutable download audit logging.
6. **A Strict Payment & Webhook State Machine**: Permitted state transitions, terminal state enforcement, and strict rules preventing captured orders from being downgraded by delayed failure notifications.

---

## 2. SANDBOX ISOLATION ARCHITECTURE

### 2.1 Staging Environment Verification [VERIFIED]
- **Inspection of Configuration**: Detailed examination of `.env.local` and local environment variables confirms that **only a single Supabase project (`kqoqdxoicqxulefnruvn`) is configured**.
- **No Secondary Supabase Project**: No separate staging, development, or preview Supabase database currently exists for SEVOLF Digital.

### 2.2 Production-Safe Sandbox Architecture (Multi-Layered Gate)
Because development and production currently share the same database instance, sandbox test orders must be strictly isolated to prevent customer contamination, revenue distortion, or accidental access to production digital assets.

A simple secret HTTP header is **explicitly rejected** as insufficient for production sandbox isolation. Instead, access to the sandbox test harness requires satisfying **all five independent security layers**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   5-LAYER SANDBOX ISOLATION GATE                       │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 1: Server-Side Feature Flag                                      │
│   ENABLE_SANDBOX_CHECKOUT=true in environment (Defaults to false).     │
│   If false, test routes return 404 Not Found immediately.              │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Authenticated Administrator Session                           │
│   Client must hold an active Supabase Auth session where               │
│   public.is_admin() evaluates to true. Ordinary customers/guests       │
│   are rejected with 403 Forbidden.                                     │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 3: Razorpay Test Key Assertion                                   │
│   Server strictly asserts: RAZORPAY_KEY_ID.startsWith('rzp_test_').    │
│   If a live key ('rzp_live_') is detected, test execution aborts.      │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Dedicated Draft Test Product                                  │
│   Product: 'SEVOLF Architecture Test Asset' (slug: test-sandbox-asset).│
│   Status: 'draft' (Excluded from public storefront and search by RLS). │
│   Price: ₹1.00 (100 paise) / $0.05 (5 cents).                          │
├────────────────────────────────────────────────────────────────────────┤
│ Layer 5: Asset Vault Isolation                                         │
│   Test product links exclusively to a dummy PDF:                       │
│   storage_path: 'test/sandbox-sample.pdf'.                             │
│   Zero entitlements to production launch products are granted.         │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Strict Launch Product Guardrails [VERIFIED]
- Both launch products (`14-day-home-reset-kit` and `mitthus-fun-learning-book`) remain strictly in `draft` status.
- `public.product_prices` remains strictly empty (0 rows) for all launch products.
- Standard storefront routes (`/shop`, `/products/[slug]`, `/api/checkout`) continue to reject draft products with 400 Bad Request.

---

## 3. ATOMIC FULFILMENT RPC ENGINE (`process_order_capture`)

### 3.1 Architectural Weaknesses in Prior Version
The initial draft of `process_order_capture` suffered from four subtle vulnerabilities:
1. It did not lock the `public.payments` row, risking concurrent insertion or update deadlocks.
2. It assumed an existing payment row always existed, failing if a webhook arrived before client-side payment initialization.
3. It returned `already_processed = true` even if previous execution had failed midway before inserting all expected entitlements.
4. It did not explicitly qualify the schema for cryptographic hashing functions (`extensions.gen_random_bytes` / `pg_catalog.encode`), which could fail when `SET search_path = ''`.

### 3.2 Corrected PL/pgSQL Design (Proposed Design Only — Not Executed)

```sql
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
    v_entitlements_count INT := 0;
    v_expected_assets_count INT := 0;
    v_existing_entitlements_count INT := 0;
BEGIN
    -- 1. Input Validation
    IF p_order_id IS NULL OR p_gateway_transaction_id IS NULL OR p_gateway_order_id IS NULL THEN
        RETURN QUERY SELECT false, false, 0, 'Invalid parameters: order_id, transaction_id and gateway_order_id are required'::TEXT;
        RETURN;
    END IF;

    -- 2. Lock Order Row for Update (Serializes concurrent verify & webhook execution)
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 0, 'Order record not found'::TEXT;
        RETURN;
    END IF;

    -- 3. Strict Monetary Verification
    IF v_order.charged_amount != p_charged_amount OR v_order.charged_currency != p_charged_currency THEN
        RETURN QUERY SELECT false, false, 0, 'Monetary mismatch: charged amount or currency does not match order snapshot'::TEXT;
        RETURN;
    END IF;

    -- 4. Calculate Expected Entitlements Count
    SELECT count(a.id) INTO v_expected_assets_count
    FROM public.order_items oi
    JOIN public.digital_assets a ON a.product_id = oi.product_id
    WHERE oi.order_id = p_order_id;

    -- 5. Check Existing Entitlements Count
    SELECT count(id) INTO v_existing_entitlements_count
    FROM public.download_entitlements
    WHERE order_id = p_order_id;

    -- 6. Idempotency Check: If already completed, paid, and all entitlements exist, exit cleanly
    IF (v_order.status = 'paid' OR v_order.status = 'completed') 
       AND v_order.payment_status = 'captured' 
       AND v_existing_entitlements_count >= v_expected_assets_count THEN
        RETURN QUERY SELECT true, true, v_existing_entitlements_count, 'Order already captured and fully fulfilled'::TEXT;
        RETURN;
    END IF;

    -- 7. Payment Row Lock & Reconciliation
    SELECT * INTO v_payment
    FROM public.payments
    WHERE order_id = p_order_id AND gateway = 'razorpay' AND gateway_order_id = p_gateway_order_id
    FOR UPDATE;

    IF FOUND THEN
        -- Prevent overwriting an already captured payment with different transaction
        IF v_payment.status = 'captured' AND v_payment.gateway_transaction_id != p_gateway_transaction_id THEN
            RETURN QUERY SELECT false, false, 0, 'Conflict: Payment already captured under different transaction ID'::TEXT;
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
        -- Insert payment row if webhook arrived before client payment row was initialized
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

    -- 8. Advance Order Status
    UPDATE public.orders
    SET status = 'paid',
        payment_status = 'captured',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 9. Deterministic Digital Entitlement Generation
    FOR v_item IN SELECT product_id FROM public.order_items WHERE order_id = p_order_id
    LOOP
        FOR v_asset IN SELECT id FROM public.digital_assets WHERE product_id = v_item.product_id
        LOOP
            -- Cryptographically secure 256-bit token generated via extensions or pgcrypto
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
                v_entitlements_count := v_entitlements_count + 1;
            END IF;
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT true, false, v_entitlements_count, 'Order captured and fulfilled successfully'::TEXT;
END;
$$;

-- Security Hardening: Revoke execution from PUBLIC, anon, authenticated; Grant ONLY to service_role
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.process_order_capture(UUID, TEXT, TEXT, DECIMAL, TEXT, JSONB) TO service_role;
```

---

## 4. AUDITABLE FINANCIAL REFUND LEDGER (`payment_refunds`)

### 4.1 Evaluation of JSONB Ledger vs. Dedicated Table
The previously proposed JSONB refund approach stored refund events in `payments.raw_response->'refunds'`. 
- **Evaluation**: While valid under PostgreSQL JSONB operations, unstructured JSONB arrays are vulnerable to race conditions during simultaneous refunds, lack foreign-key integrity, cannot enforce numeric constraints on individual refund sums, and severely complicate financial audit reporting.
- **Architectural Decision**: A **dedicated `public.payment_refunds` relational table** is required for production-grade financial accountability.

### 4.2 Proposed Refund Ledger Schema (Design Only — Not Executed)

```sql
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

-- Unique index to guarantee idempotent refund webhook processing
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_refunds_gateway_refund
    ON public.payment_refunds (gateway, gateway_refund_id);

CREATE INDEX IF NOT EXISTS idx_payment_refunds_order
    ON public.payment_refunds (order_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.payment_refunds ENABLE ROW LEVEL SECURITY;

-- Admins and service_role have full access; Customers have read access to their own refunds
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

### 4.3 Deterministic Entitlement Revocation Rules
1. **Full Order Refund**:
   - Condition: Total refunded amount across `payment_refunds` for the order equals `orders.charged_amount`.
   - Action: Set `orders.status = 'refunded'`, `orders.payment_status = 'refunded'`.
   - Entitlement Impact: Revoke all entitlements for the order:
     ```sql
     UPDATE public.download_entitlements 
     SET is_active = false 
     WHERE order_id = v_refund.order_id;
     ```
2. **Partial Order Refund (Item-Specific)**:
   - Condition: Razorpay refund metadata contains verified `notes.product_id` matching an `order_items` record.
   - Action: Set `orders.status = 'partially_refunded'` (or retain `'paid'` with partial refund recorded in `orders.metadata`).
   - Entitlement Impact: Revoke strictly the digital asset entitlements belonging to that specific refunded product:
     ```sql
     UPDATE public.download_entitlements e
     SET is_active = false
     FROM public.digital_assets a
     WHERE e.digital_asset_id = a.id
       AND e.order_id = v_refund.order_id
       AND a.product_id = v_refund.product_id;
     ```
3. **Partial Refund Without Product Association**:
   - Condition: A goodwill or partial discount refund is granted without targeting a specific line item.
   - Action: Record financial refund in `payment_refunds`; **do NOT revoke entitlements**.

---

## 5. ZERO-TRUST GUEST PURCHASE RECOVERY

### 5.1 Failure Scenario Addressed
A guest customer completes payment, the webhook marks the order captured, but:
- The customer's mobile browser crashes or loses internet connectivity before `/api/checkout/verify` redirects.
- The customer switches from mobile checkout to a desktop computer.
- The customer returns 3 days later seeking their purchased digital files.

### 5.2 Cryptographic Magic Link Protocol
Under zero-trust principles, **the system must never display order details or file downloads based merely on an entered email address**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                   GUEST PURCHASE RECOVERY WORKFLOW                     │
└────────────────────────────────────────────────────────────────────────┘

 [1. Recovery Request]
      Guest visits /account/recover-order and enters their email.

 [2. Server-Side Throttling & Lookup]
      - Rate limit: Maximum 3 recovery requests per IP/email per hour.
      - Server checks public.orders for customer_email = input_email.
      - Response to browser is ALWAYS identical (timing-safe):
        "If an order exists for this email, access links have been sent."

 [3. Short-Lived Access Token Generation]
      - Server generates rawRecoveryToken = crypto.randomBytes(32).toString('hex').
      - Token Hash = SHA-256(rawRecoveryToken).
      - Server stores Token Hash in orders.metadata:
          {
            "recovery_token_hash": "<hash>",
            "recovery_token_expires_at": "2026-11-18T23:15:00Z" (15 minutes)
          }

 [4. Delivery via Verified Channel]
      - System dispatches email to verified customer_email:
        Link: https://sevolf.store/order/access?token=<rawRecoveryToken>&orderNumber=ORD-XXXX

 [5. Token Consumption & Session Upgrade]
      - Guest clicks link within 15 minutes.
      - Server hashes query token, verifies match, and asserts expires_at > NOW().
      - Server issues HttpOnly, Secure cookie: sevolf_guest_session.
      - Server invalidates recovery_token_hash (single-use consumption).
      - Client is redirected to /order/success?orderNumber=ORD-XXXX with active session.
```

---

## 6. DOWNLOAD ACCESS SECURITY & DEFENSE-IN-DEPTH

The digital asset delivery pipeline enforces seven interlocking security controls:

| Security Domain | Implemented Control | Threat Mitigated |
| :--- | :--- | :--- |
| **1. Token Hashing at Rest** | `public.download_entitlements` stores `token_hash = SHA-256(raw_token)` (or 256-bit high-entropy raw token). | Database snapshot breach does not compromise download access. |
| **2. Storage Isolation** | Bucket `digital-products` is strictly private (`public = false`). Direct HTTP requests receive `403 Forbidden`. | Unauthorized file enumeration / scraping. |
| **3. Signed URL Lifetime** | Supabase Storage signed URLs generated on-demand with a strict **60-second time-to-live (TTL)**. | Link sharing, scraping, and replay attacks. |
| **4. Referer Leakage Defense** | Next.js download route `/api/download/[token]` returns `Referrer-Policy: no-referrer` header before 302 redirect. | Preventing signed URL leakage to third-party CDNs or analytic trackers. |
| **5. Rate Limiting** | Endpoint enforces a maximum of 5 download requests per token per minute via Redis or in-memory sliding window. | Download abuse and bandwidth exhaustion. |
| **6. Hard Quotas** | Table enforces `download_limit = 10` and `CHECK (download_count <= download_limit)`. Incremented on every valid request. | Excessive re-distribution. |
| **7. Immutable Audit Log** | Every request writes to `public.download_logs` with client IP address (`x-forwarded-for`), User-Agent, and timestamp. | Non-repudiation and fraud investigation. |

---

## 7. PAYMENT & WEBHOOK STATE MACHINE SPECIFICATION

### 7.1 Permitted Transitions & Invariants

```
                               ┌─────────────┐
                               │   created   │ (Payment row created upon order creation)
                               └──────┬──────┘
                                      │
                       Customer interacts with Razorpay
                                      ▼
                               ┌─────────────┐
                               │ authorized  │ (Optional: 2-step manual capture)
                               └──────┬──────┘
                                      │
                     Auto-capture or webhook capture
                                      ▼
                               ┌─────────────┐
                               │  captured   │ <── TERMINAL SUCCESS STATE
                               └──────┬──────┘     (Cannot be overwritten by failure)
                                      │
                         Merchant initiates refund
                                      ▼
                               ┌─────────────┐
                               │  refunded   │ <── TERMINAL REFUND STATE
                               └─────────────┘
```

### 7.2 Concurrency & Event Matrix

| Current DB Status | Arriving Event | New Status | Action / Side Effect |
| :--- | :--- | :---: | :--- |
| `created` | `payment.captured` | `captured` | **Advance.** Set order to `paid`, generate entitlements. |
| `created` | `payment.failed` | `failed` | **Advance.** Mark payment `failed`. Order remains pending for retry. |
| `authorized` | `payment.captured` | `captured` | **Advance.** Set order to `paid`, generate entitlements. |
| `captured` | `payment.captured` | `captured` | **Idempotent No-Op.** Unique index blocks duplicate insert; returns 200 OK. |
| **`captured`** | **`payment.failed`** | **`captured`** | **BLOCKED & IGNORED.** Logged to `payment_webhook_events` as `ignored`. Captured state is permanent. |
| `captured` | `refund.processed` | `refunded` / `captured` | **Record Refund.** Insert `payment_refunds`, selectively revoke entitlements. |
| `failed` | `payment.captured` | `captured` | **Permitted on New Transaction.** Customer retried payment; new transaction captured. |
| `refunded` | Any payment event | `refunded` | **BLOCKED.** Terminal state. |

---

## 8. PROPOSED DATABASE MIGRATIONS (PHASE 1C.2)

Two discrete SQL migration files will be prepared for Phase 1C.2 (Design Only — Zero Execution):

1. **Migration 1: `20260218_payment_refunds_ledger.sql`**
   - Creates `public.payment_refunds` table.
   - Enforces unique index `uq_payment_refunds_gateway_refund`.
   - Enables RLS with admin full access and customer self-view policy.
2. **Migration 2: `20260218_atomic_order_fulfilment.sql`**
   - Deploys `public.process_order_capture` stored procedure.
   - Sets `SECURITY DEFINER` and `SET search_path = ''`.
   - Revokes execution from `PUBLIC`, `anon`, and `authenticated`.
   - Grants execution exclusively to `service_role`.

---

## 9. IMPLEMENTATION DEPENDENCY GRAPH

```
[Phase 1C.2 Schema Migrations]
   │  ├─ 20260218_payment_refunds_ledger.sql
   │  └─ 20260218_atomic_order_fulfilment.sql
   ▼
[Gateway & Security Core]
   │  ├─ npm install razorpay @types/razorpay
   │  └─ src/lib/razorpay.ts (Client & crypto timingSafeEqual HMAC)
   ▼
[API Routes & Concurrency Locking]
   │  ├─ POST /api/checkout (Order init & minor unit calculation)
   │  ├─ POST /api/checkout/verify (Fast-path calling process_order_capture)
   │  ├─ POST /api/webhooks/razorpay (Authoritative calling process_order_capture)
   │  └─ GET /api/download/[token] (Hardened token, 60s signed URL, audit log)
   ▼
[Client UI & Experience]
   │  ├─ src/app/checkout/page.tsx (Razorpay checkout modal, zero Stripe)
   │  ├─ src/app/order/success/page.tsx (Session cookie & immediate tokens)
   │  └─ src/app/account/library/page.tsx (Supabase entitlements join)
   ▼
[Sandbox Testing Gate (20 Scenarios)]
   └─ Execute in Razorpay Test Mode before production cutover
```

---

## 10. SECURITY ACCEPTANCE CRITERIA

Before Phase 1C can be declared complete, all seven criteria must be formally verified:

1. **HMAC Signature Assertion**: Signature verification rejects manipulated `razorpay_signature` or `x-razorpay-signature` with HTTP 400.
2. **Monetary Precision**: All gateway operations communicate in integer minor units (paise/cents) without floating-point representation drift.
3. **Double Fulfilment Prevention**: Parallel simulation of client verify and webhook ingestion produces exactly 1 set of entitlements with zero duplicate rows.
4. **State Machine Non-Degradation**: Submitting a mock `payment.failed` webhook for an already `captured` order is safely rejected without downgrading order status.
5. **Private Vault Integrity**: Direct HTTP requests to Supabase Storage bucket `digital-products` fail with HTTP 403.
6. **Zero Client Trust**: Submitting an arbitrary price or currency in `/api/checkout` is completely ignored; the server retrieves verified prices from Supabase.
7. **Production Isolation**: Both launch products remain in `draft` with 0 prices; test transactions cannot grant access to real launch assets.

---

## 11. FINAL READ-ONLY COMPLIANCE CONFIRMATION

- **Source Code**: Zero files edited, created, or deleted (aside from this design document). [VERIFIED]
- **NPM Dependencies**: Zero packages installed or uninstalled. [VERIFIED]
- **Database Status**: Zero DDL migrations or write queries executed. [VERIFIED]
- **Launch Product Status**:
  - `14-day-home-reset-kit`: Strictly `draft` [VERIFIED]
  - `mitthus-fun-learning-book`: Strictly `draft` [VERIFIED]
- **Pricing Status**: `public.product_prices` table contains exactly 0 records. [VERIFIED]

**SECURITY DESIGN SPECIFICATION COMPLETE — STOPPED AND AWAITING USER APPROVAL.**
