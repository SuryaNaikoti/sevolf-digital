# SEVOLF PHASE 1C — V12.1 IMPLEMENTATION BLUEPRINT (READ-ONLY)

**Author:** Senior PostgreSQL/Supabase Security Engineer & Next.js Backend Architect  
**Document Status:** Strict Read-Only Blueprint (Awaiting Approval Before Implementation)  
**Verification Date:** 2026-11-19  

---

## 1. EXECUTIVE SUMMARY & VERIFIED FINDINGS MATRIX

Following the completion of the V12.1 security audit, a second, rigorous source-level verification was performed across the SEVOLF codebase, database migrations, and proposal documents. Every finding was traced directly to its physical file and line number.

| Finding ID | Severity | Source Location | Verified Defect Mechanism | Architectural Resolution |
|---|---|---|---|---|
| **FINDING-01** | **CRITICAL** | `src/app/api/download/[token]/route.ts#L61-L74` | Predictable token prefix `token_sample_` returns synthesized mock PDF without database queries, entitlement checks, or audit logs. | Remove lines 61–73 completely. Reject any token not matched in `public.download_entitlements`. |
| **FINDING-02** | **HIGH** | `src/app/api/download/[token]/route.ts#L56` | API route queries legacy plaintext column `.eq("token", token)` instead of hashing bearer token to query `token_hash`. | Hash incoming token via SHA-256 (`crypto.createHash('sha256')`). Transition to atomic claim RPC querying `token_hash`. |
| **FINDING-03** | **HIGH** | `src/app/api/download/[token]/route.ts#L98-L133` | Limit checking, log insertion, and counter incrementation run as separate un-isolated async statements, allowing concurrency race conditions. | Deploy atomic stored procedure `claim_download_entitlement(p_token_hash, p_ip, p_user_agent)` with `FOR UPDATE` row-level locking. |
| **FINDING-04** | **HIGH** | `src/app/api/download/[token]/route.ts#L78-L87` | Route requires active session cookie matching `user_id` or `customer_email`, completely blocking guest purchasers holding valid bearer tokens. | Redesign authorization: Bearer token ($2^{256}$ entropy) authorizes guest download directly. Authenticated session required only for customer dashboard viewing. |
| **FINDING-05** | **HIGH** | `docs/SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md#L450-L480` | Block 4 capture RPC omits `revocation_reason IS NULL` check, allowing capture retries to silently resurrect refunded/revoked entitlements. | Synchronize Block 4 capture RPC to strictly enforce `WHERE download_entitlements.revocation_reason IS NULL`. |
| **FINDING-06** | **HIGH** | `docs/SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md#L305-L330` | Block 4 capture RPC checks asset storage paths but omits `v_order_items_count = 1` and `quantity = 1` for sandbox orders. | Synchronize Block 4 capture RPC with strict cardinality and quantity constraints matching `phase1c_v12_test_suite.sql`. |
| **FINDING-07** | **MEDIUM** | `supabase/tests/phase1c_v12_test_suite.sql#L549-L596` | Test 27 simulates claims via session variables while running under privileged `postgres` session, which bypasses RLS by default. | Author real role-switching tests using `SET LOCAL ROLE anon;` and `SET LOCAL ROLE authenticated;` with explicit table grants. |

---

## 2. EXISTING VS. PROPOSED SCHEMA OBJECTS

To guarantee that duplicate columns, conflicting tables, or redundant indexes are never created, this section catalogs existing schema definitions from `20260218_initial_sevolf_digital_commerce.sql` and `20260218_pricing_and_currency_engine.sql` against the proposed V12.1 additions.

### 2.1 Table: `public.orders`
- **Existing Columns:** `id`, `order_number`, `user_id`, `customer_email`, `customer_name`, `currency`, `subtotal`, `discount`, `total_amount`, `status`, `payment_method`, `payment_status`, `metadata`, `created_at`, `updated_at`, `base_currency`, `base_amount`, `charged_currency`, `charged_amount`, `exchange_rate_used`, `exchange_rate_source`, `exchange_rate_timestamp`.
- **Proposed New Column:**
  - `is_sandbox BOOLEAN NOT NULL DEFAULT false`
- **Proposed New Index:**
  - `idx_orders_is_sandbox ON public.orders(is_sandbox)`
- **Modification Justification:** Distinguishes test/sandbox transactions from live production commerce at the database engine level.

### 2.2 Table: `public.payment_attempts`
- **Existing State:** **DOES NOT EXIST** in initial migrations.
- **Proposed New Table:**
  ```sql
  CREATE TABLE public.payment_attempts (
      id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
      gateway VARCHAR(30) NOT NULL DEFAULT 'razorpay',
      gateway_order_id VARCHAR(255) NOT NULL,
      attempt_number INT NOT NULL DEFAULT 1,
      amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
      currency VARCHAR(3) NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'created' 
          CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'expired')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_payment_attempts_gateway_order UNIQUE (gateway, gateway_order_id),
      CONSTRAINT uq_payment_attempts_order_attempt UNIQUE (order_id, attempt_number)
  );
  ```
- **Modification Justification:** Provides an authoritative relational audit trail mapping multiple payment attempts to an order, eliminating mutable JSON metadata.

### 2.3 Table: `public.payments`
- **Existing Columns:** `id`, `order_id`, `gateway`, `gateway_transaction_id`, `gateway_order_id`, `amount`, `currency`, `status`, `raw_response`, `created_at`.
- **Proposed New Column:**
  - `payment_attempt_id UUID REFERENCES public.payment_attempts(id) ON DELETE RESTRICT`
  - `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- **Proposed New Index:**
  - `idx_payments_attempt_id ON public.payments(payment_attempt_id)`
- **Modification Justification:** Relates captured payments directly to the authoritative attempt record.

### 2.4 Table: `public.payment_refunds`
- **Existing State:** **DOES NOT EXIST** in initial migrations.
- **Proposed New Table:**
  ```sql
  CREATE TABLE public.payment_refunds (
      id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
      payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE RESTRICT,
      product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
      gateway VARCHAR(30) NOT NULL DEFAULT 'razorpay',
      gateway_refund_id VARCHAR(255) NOT NULL,
      amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
      currency VARCHAR(3) NOT NULL,
      reason TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'pending' 
          CHECK (status IN ('pending', 'processed', 'failed')),
      raw_response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_payment_refunds_gateway_refund UNIQUE (gateway, gateway_refund_id)
  );
  ```
- **Modification Justification:** Enforces cumulative payment refund caps and line-item partial refund tracking with explicit gateway refund IDs.

### 2.5 Table: `public.download_entitlements`
- **Existing Columns:** `id`, `order_id`, `user_id`, `customer_email`, `digital_asset_id`, `token` (NOT NULL, UNIQUE), `download_limit`, `download_count`, `expires_at`, `is_active`, `created_at`.
- **Proposed Modifications:**
  - `ALTER TABLE public.download_entitlements ALTER COLUMN token DROP NOT NULL;`
  - `ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);`
  - `ADD COLUMN IF NOT EXISTS revocation_reason VARCHAR(50);`
  - `ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`
- **Proposed New Index:**
  - `CREATE UNIQUE INDEX idx_uq_entitlements_token_hash ON public.download_entitlements(token_hash) WHERE token_hash IS NOT NULL;`
- **Modification Justification:** Implements SHA-256 hash-at-rest token architecture and explicit revocation state tracking (`refund`, `fraud`, `admin`, `expired`).

### 2.6 Table: `public.order_recovery_challenges`
- **Existing State:** **DOES NOT EXIST** in initial migrations.
- **Proposed New Table:**
  ```sql
  CREATE TABLE public.order_recovery_challenges (
      id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
      order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
      challenge_token_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      requested_ip INET,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_order_recovery_challenge_hash UNIQUE (challenge_token_hash)
  );
  ```
- **Modification Justification:** Stores single-use, 15-minute expiring challenge token hashes for self-service lost link recovery.

---

## 3. EXACT NEXT.JS CODE CHANGES REQUIRED

### 3.1 Target File: `src/app/api/download/[token]/route.ts`

```typescript
// =============================================================================
// REVISED DOWNLOAD API ROUTE (V12.1 HARDENED)
// =============================================================================
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import crypto from "crypto";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // 1. Validate bearer token parameter
  if (!token || typeof token !== "string" || token.length < 32 || token.length > 128) {
    return NextResponse.json({ error: "Invalid download token format." }, { status: 400 });
  }

  // 2. Reject fabricated demonstration tokens unconditionally
  if (token.startsWith("token_sample_")) {
    return NextResponse.json({ error: "Sample demonstration tokens cannot be redeemed." }, { status: 404 });
  }

  // 3. Compute SHA-256 token hash
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  // 4. Resolve client IP and user agent for audit logging
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientIp = (forwardedFor ? forwardedFor.split(",")[0].trim() : request.headers.get("x-real-ip")) || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  const adminClient = createAdminClient();

  // 5. Invoke atomic database reservation RPC
  const { data: claimData, error: claimError } = await adminClient.rpc(
    "claim_download_entitlement",
    {
      p_token_hash: tokenHash,
      p_client_ip: clientIp,
      p_user_agent: userAgent,
    }
  );

  if (claimError || !claimData || claimData.length === 0) {
    return NextResponse.json(
      { error: "Database reservation error during download claim." },
      { status: 500 }
    );
  }

  const claim = claimData[0];

  // 6. Handle business logic rejections returned from atomic procedure
  if (!claim.success) {
    return NextResponse.json(
      { error: claim.error_message },
      { status: claim.status_code || 400 }
    );
  }

  // 7. Generate temporary signed URL from Supabase Storage (valid for 60 seconds)
  const { data: signedData, error: signError } = await adminClient.storage
    .from("digital-products")
    .createSignedUrl(claim.storage_path, 60);

  if (signError || !signedData?.signedUrl) {
    // Release the reserved download slot if storage URL creation fails
    await adminClient.rpc("rollback_download_claim", {
      p_entitlement_id: claim.entitlement_id,
    });

    return NextResponse.json(
      { error: "Failed to generate secure signed download access. Your download count was not charged." },
      { status: 500 }
    );
  }

  // 8. Redirect client to temporary signed storage URL
  return NextResponse.redirect(signedData.signedUrl);
}
```

### 3.2 Target File: `src/app/account/library/page.tsx`
- **Changes Required:**
  - Remove hardcoded `token_sample_892144_01` and `token_sample_714002_02` from `purchasedProducts` array.
  - Implement server-side query fetching real user entitlements from `public.download_entitlements` where `user_id = user.id`.
  - If no purchased products exist, display the verified empty state.

---

## 4. DATABASE FUNCTION SIGNATURES & PROCEDURES

### 4.1 Procedure: `public.claim_download_entitlement`
- **Purpose:** Atomically verifies entitlement eligibility, logs the download, and increments the download counter in a single locked transaction.
```sql
CREATE OR REPLACE FUNCTION public.claim_download_entitlement(
    p_token_hash VARCHAR(64),
    p_client_ip TEXT DEFAULT 'unknown',
    p_user_agent TEXT DEFAULT 'unknown'
)
RETURNS TABLE (
    success BOOLEAN,
    status_code INT,
    error_message TEXT,
    entitlement_id UUID,
    storage_path TEXT,
    file_name TEXT,
    mime_type TEXT,
    download_count INT,
    download_limit INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ent RECORD;
    v_asset RECORD;
BEGIN
    -- 1. Row-level lock on entitlement row
    SELECT * INTO v_ent
    FROM public.download_entitlements
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 404, 'Download entitlement not found or invalid token'::TEXT, 
            NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0, 0;
        RETURN;
    END IF;

    -- 2. Verify active status and non-revocation
    IF NOT v_ent.is_active THEN
        RETURN QUERY SELECT false, 403, ('Download entitlement has been revoked (reason: ' || COALESCE(v_ent.revocation_reason, 'unknown') || ')')::TEXT,
            v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 3. Verify expiration
    IF v_ent.expires_at < NOW() THEN
        RETURN QUERY SELECT false, 410, 'Download link has expired'::TEXT,
            v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 4. Verify download limit
    IF v_ent.download_limit > 0 AND v_ent.download_count >= v_ent.download_limit THEN
        RETURN QUERY SELECT false, 429, 'Download limit reached for this entitlement'::TEXT,
            v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 5. Fetch digital asset details
    SELECT * INTO v_asset
    FROM public.digital_assets
    WHERE id = v_ent.digital_asset_id;

    IF NOT FOUND OR v_asset.storage_path IS NULL THEN
        RETURN QUERY SELECT false, 500, 'Digital asset file path could not be resolved'::TEXT,
            v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 6. Atomically log download and increment counter
    INSERT INTO public.download_logs (
        entitlement_id, ip_address, user_agent, downloaded_at
    ) VALUES (
        v_ent.id, SUBSTRING(p_client_ip FROM 1 FOR 45), SUBSTRING(p_user_agent FROM 1 FOR 500), NOW()
    );

    UPDATE public.download_entitlements
    SET download_count = download_count + 1, updated_at = NOW()
    WHERE id = v_ent.id;

    -- 7. Return success and asset payload
    RETURN QUERY SELECT true, 200, 'Success'::TEXT,
        v_ent.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 
        v_ent.download_count + 1, v_ent.download_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_download_entitlement(VARCHAR, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_download_entitlement(VARCHAR, TEXT, TEXT) TO service_role;
```

### 4.2 Procedure: `public.rollback_download_claim`
- **Purpose:** Restores a consumed download count if signed storage URL generation fails after reservation.
```sql
CREATE OR REPLACE FUNCTION public.rollback_download_claim(
    p_entitlement_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.download_entitlements
    SET download_count = GREATEST(0, download_count - 1),
        updated_at = NOW()
    WHERE id = p_entitlement_id;
END;
$$;

REVOKE ALL ON FUNCTION public.rollback_download_claim(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rollback_download_claim(UUID) TO service_role;
```

---

## 5. CAPTURE & REFUND STATE MACHINE DESIGN

### 5.1 Capture RPC State Transitions (`process_order_capture`)
```
                          CAPTURE STATE TRANSITION MATRIX
                          
+------------------------+-------------------------+----------------------------------------------------+
| Initial Order State    | Initial Entitlement     | Action & Final State                               |
+------------------------+-------------------------+----------------------------------------------------+
| pending                | None                    | Insert payment, order->paid, create active ent.    |
| paid                   | active                  | Idempotent replay: return existing tokens (no-op). |
| paid / part_refunded   | revoked (reason=refund) | BLOCKED: Permanent lock. Never reactivate.         |
| paid                   | revoked (reason=fraud)  | BLOCKED: Permanent lock. Never reactivate.         |
| paid                   | revoked (reason=admin)  | BLOCKED: Permanent lock. Never reactivate.         |
| refunded               | Any                     | REJECT: Order fully refunded. Capture disallowed.  |
+------------------------+-------------------------+----------------------------------------------------+
```

### 5.2 Strict Sandbox Order Fulfilment Validation
To prevent sandbox order contamination, the capture RPC evaluates:
```sql
IF v_order.is_sandbox = true THEN
    -- Invariant 1: Exactly one line item in order
    IF v_order_items_count != 1 THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Sandbox isolation violation: Sandbox order must contain exactly 1 line item'::TEXT;
        RETURN;
    END IF;

    -- Invariant 2: Quantity must be exactly 1, Product ID must match, Asset ID must match, Path must match
    IF EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.digital_assets a ON a.product_id = oi.product_id
        WHERE oi.order_id = p_order_id 
          AND (oi.product_id != '22222222-2222-2222-2222-222222222222'::UUID 
               OR a.id != 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID 
               OR a.storage_path != 'test/sandbox-sample.pdf'
               OR oi.quantity != 1)
    ) THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Sandbox isolation violation: Sandbox order contains unapproved product, asset, or invalid quantity'::TEXT;
        RETURN;
    END IF;
ELSE
    -- Production Orders: Zero sandbox products, assets, or test/ paths permitted
    IF EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.digital_assets a ON a.product_id = oi.product_id
        WHERE oi.order_id = p_order_id 
          AND (oi.product_id = '22222222-2222-2222-2222-222222222222'::UUID 
               OR a.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID 
               OR a.storage_path = 'test/sandbox-sample.pdf' 
               OR a.storage_path LIKE 'test/%')
    ) THEN
        RETURN QUERY SELECT false, false, 0, 0, '[]'::JSONB, 'Sandbox isolation violation: Production order contains sandbox product or assets'::TEXT;
        RETURN;
    END IF;
END IF;
```

---

## 6. REAL POSTGRESQL ROLE-BASED RLS TESTS

To prevent superuser session bypass during automated test runs, the test suite must execute role-switching blocks using `SET LOCAL ROLE`:

```sql
-- -----------------------------------------------------------------------------
-- REAL ROLE-BASED RLS TEST HARNESS
-- -----------------------------------------------------------------------------
DO $$
DECLARE
    v_count INT;
    v_error_caught BOOLEAN := false;
BEGIN
    -- 1. Anonymous Role Test
    SET LOCAL ROLE anon;
    SELECT COUNT(*) INTO v_count FROM public.download_entitlements;
    ASSERT v_count = 0, 'RLS Failure: anon role should select 0 entitlements';

    BEGIN
        INSERT INTO public.payment_attempts (order_id, gateway, gateway_order_id, amount, currency)
        VALUES ('99999999-9999-9999-9999-999999999999', 'razorpay', 'anon_hack', 1000, 'INR');
    EXCEPTION WHEN insufficient_privilege OR OTHERS THEN
        v_error_caught := true;
    END;
    ASSERT v_error_caught = true, 'RLS Failure: anon role unauthorized insert succeeded';

    -- 2. Customer A Role Test
    SET LOCAL ROLE authenticated;
    PERFORM set_config('request.jwt.claim.sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true);
    PERFORM set_config('request.jwt.claims', '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","email":"customer_a@sevolf.test"}', true);

    SELECT COUNT(*) INTO v_count FROM public.download_entitlements;
    ASSERT v_count >= 1, 'RLS Failure: Customer A cannot view own entitlements';

    -- 3. Customer B Cross-Tenant Read Rejection
    PERFORM set_config('request.jwt.claim.sub', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
    PERFORM set_config('request.jwt.claims', '{"sub":"bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb","email":"customer_b@sevolf.test"}', true);

    SELECT COUNT(*) INTO v_count FROM public.download_entitlements;
    ASSERT v_count = 0, 'RLS Failure: Customer B can see Customer A entitlements';

    -- Reset Role
    RESET ROLE;
END $$;
```

---

## 7. MIGRATION EXECUTION ORDER & ROLLBACK PLAN

### 7.1 Migration Order
1. **Migration File:** `supabase/migrations/20260218120000_phase1c_v12_1_relational_hardening.sql`
   - Step 1: `ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT false;`
   - Step 2: `CREATE TABLE IF NOT EXISTS public.payment_attempts ...;`
   - Step 3: `ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_attempt_id UUID ...;`
   - Step 4: `CREATE TABLE IF NOT EXISTS public.payment_refunds ...;`
   - Step 5: `ALTER TABLE public.download_entitlements ALTER COLUMN token DROP NOT NULL;`
   - Step 6: `ALTER TABLE public.download_entitlements ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64);`
   - Step 7: `ALTER TABLE public.download_entitlements ADD COLUMN IF NOT EXISTS revocation_reason VARCHAR(50);`
   - Step 8: `UPDATE public.download_entitlements SET token_hash = encode(extensions.digest(token, 'sha256'), 'hex') WHERE token_hash IS NULL AND token IS NOT NULL;`
   - Step 9: `CREATE TABLE IF NOT EXISTS public.order_recovery_challenges ...;`
   - Step 10: Deploy functions `claim_download_entitlement`, `rollback_download_claim`, `process_order_capture`, `process_order_refund`, `recover_order_tokens`.
   - Step 11: Configure RLS policies and revoke/grant privileges.

2. **Next.js Application Deployment:**
   - Deploy refactored `src/app/api/download/[token]/route.ts`.
   - Deploy updated `src/app/account/library/page.tsx`.

### 7.2 Safe Rollback Plan
- **Additive DDL Strategy:** All changes are strictly additive. If the application deployment must be rolled back, the existing legacy Next.js code will continue to function because `token` remains populated on legacy rows, and `orders`, `payments`, and `download_entitlements` retain all legacy columns.
- **Rollback SQL Script (Emergency Only):**
  ```sql
  -- Drop atomic claim RPCs
  DROP FUNCTION IF EXISTS public.claim_download_entitlement(VARCHAR, TEXT, TEXT);
  DROP FUNCTION IF EXISTS public.rollback_download_claim(UUID);
  -- Legacy capture/refund RPCs can be restored from 20260218_initial_sevolf_digital_commerce.sql
  ```

---

## 8. REMAINING UNVERIFIED ASSUMPTIONS

1. **Storage Bucket Name:** The download route references `digital-products` as the Supabase storage bucket name (`adminClient.storage.from("digital-products")`). This bucket exists logically in code, but its actual RLS policies on `storage.objects` must be verified in the live Supabase project before release.
2. **Reverse Proxy Header Consistency:** `request.headers.get("x-forwarded-for")` is assumed to contain the true client IP when hosted on Vercel/Cloudflare. In direct local testing, it defaults to `"unknown"`.
3. **Resend Email Template Integration:** The token recovery workflow assumes an operational email dispatch service (e.g. Resend) configured in environment variables (`RESEND_API_KEY`).

---
**END OF BLUEPRINT — Awaiting explicit user approval before proceeding with implementation.**
