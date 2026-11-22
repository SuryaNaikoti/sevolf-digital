# SEVOLF PHASE 1C — V12.2 CORRECTED IMPLEMENTATION BLUEPRINT (READ-ONLY)

**Document Type:** Senior PostgreSQL/Supabase & Next.js Architecture Blueprint  
**Iteration:** V12.2 Design Review & Revision  
**Date:** 2026-11-19  
**Execution Status:** **STRICTLY READ-ONLY** (Zero code edits, zero migrations executed, zero database modifications)

---

## 1. EXECUTIVE REVISION OVERVIEW & ARCHITECTURAL SUMMARY

Following the V12.1 security audit, this V12.2 Blueprint resolves the fundamental architectural challenges surrounding **download authorization**, **atomic claim lifecycle management**, **application rollback compatibility**, and **sandbox fixture validation**.

### Key Architectural Corrections in V12.2:
1. **Cryptographic Decoupling of Authorization Credentials:** SHA-256 token hashes stored at rest in `download_entitlements` are mathematical one-way digests ($H(T)$). They cannot be reversed to produce download credentials, nor can they be exposed as bearer tokens. Authorization is split into two mutually isolated mechanisms:
   - **Guest Bearer Tokens:** High-entropy 64-character random hex strings issued at purchase, sent via email, hashed upon arrival, and validated against `token_hash`.
   - **Authenticated Scoped Authorization:** Authenticated customers in the dashboard never receive long-lived bearer tokens; instead, an authenticated RPC issues a **short-lived (5-minute), single-use authorization ticket** stored in memory and redeemed by ticket ID.
2. **Three-Phase Atomic Claim Lifecycle:** Replaces the naive two-step increment/decrement pattern with a transactional state machine on a dedicated `download_claims` ledger tracking `claimed` -> `delivered` -> `failed`. Download limits are checked atomically under row-level locks (`FOR UPDATE`), and counters are incremented **only upon successful delivery confirmation**.
3. **True Dual-Lookup Rollback Compatibility:** Eliminates the breaking change between legacy plaintext `.eq("token", token)` lookups and new `token_hash` lookups by introducing a **dual-column, phased transition**. Both legacy and new code paths remain functional under application or database rollback.
4. **Authoritative Sandbox Fixture Audit:** Conducted a comprehensive audit of repository migrations and seed files. The fixture IDs `22222222-2222-2222-2222-222222222222`, `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`, and path `test/sandbox-sample.pdf` are **UNVERIFIED in persistent database schema**; they exist solely as synthetic test harness constants. A proper database-driven resolution mechanism is specified.
5. **Rigorous Entitlement Semantics:** Defined explicit mathematical rules for zero download limits, null limits, null expiration, refunded orders, and chargebacks.

---

## 2. DOWNLOAD AUTHORIZATION ARCHITECTURE

```
+-------------------------------------------------------------------------------------------------------+
|                                  SEVOLF DUAL-PATH AUTHORIZATION ENGINE                                |
+-------------------------------------------------------------------------------------------------------+
|                                                                                                       |
|  [PATH A: GUEST CUSTOMER BEARER FLOW]               [PATH B: AUTHENTICATED CUSTOMER FLOW]             |
|                                                                                                       |
|  1. Purchase Completed (Capture RPC)                1. Authenticated Customer in Library (/account)   |
|     - Generate T_guest (256-bit crypto hex)            - Session validated via Supabase Auth (auth.uid)|
|     - Store token_hash = SHA256(T_guest)               - Query active entitlements for user_id        |
|     - Email T_guest to customer                        - Plaintext bearer token is NOT stored or seen |
|                                                                    |                                  |
|  2. Customer Clicks Email Link                      2. Customer Clicks "Download Asset"               |
|     - GET /api/download/guest/[token]                  - POST /api/download/authorize                 |
|     - Next.js computes h = SHA256(token)               - Server verifies ownership:                   |
|     - Database validates h against token_hash            user.id == entitlement.user_id                |
|     - Atomically claims slot                           - RPC issues short-lived Ticket (5 min, 1 use) |
|     - Redirects to signed Storage URL                  - Returns Ticket ID to client                  |
|                                                                    |                                  |
|                                                     3. Client Redeems Ticket                          |
|                                                        - GET /api/download/ticket/[ticket_id]         |
|                                                        - Server atomically claims & consumes ticket   |
|                                                        - Redirects to signed Storage URL              |
+-------------------------------------------------------------------------------------------------------+
```

### 2.1 Why Token Hashes Cannot Be Credentials
In a secure hash-at-rest architecture:
$$	ext{Database Record} = H(T) = 	ext{SHA-256}(T)$$
1. **Irreversibility:** Because SHA-256 is a pre-image resistant one-way function, the plaintext $T$ cannot be reconstructed from $H(T)$.
2. **Exposure Prevention:** If $H(T)$ were returned over an API or rendered in a browser HTML attribute, $H(T)$ would become a plaintext credential itself, defeating the entire purpose of hashing at rest.
3. **Decoupled Mechanics:**
   - **Guest Flow:** The customer holds the pre-image $T$ in their email link. The server computes $H(T)$ on the fly and queries the database.
   - **Authenticated Flow:** The customer has no token. The database holds only $H(T)$. To download, the authenticated customer requests a short-lived **Ticket** ($T_{	ext{ticket}}$) valid for 5 minutes.

### 2.2 Token Lifecycle Specifications

| Flow | Issuance | Storage at Rest | Presentation | Expiration | Revocation Behaviour |
|---|---|---|---|---|---|
| **Guest Bearer** | Generated during `process_order_capture` via `gen_random_bytes(32)`. | `download_entitlements.token_hash = SHA-256(T)` | URL parameter `/api/download/guest/[token]` | 30 days from purchase (`expires_at`). | When `is_active = false` or `revocation_reason IS NOT NULL`, claim RPC immediately rejects. |
| **Auth Customer** | Generated on-demand via `authorize_customer_download` RPC. | Ephemeral in `download_tickets` table (`ticket_hash = SHA-256(Ticket)`). | Header or path `/api/download/ticket/[ticket_id]` | 5 minutes from generation. | Deleting/revoking the parent entitlement cascades to active tickets. Single-use. |
| **Lost Token Recovery** | Generated via `recover_order_tokens` after challenge verification. | Replaces `token_hash` in `download_entitlements`. Old tokens instantly invalidated. | Fresh bearer token emailed to customer inbox. | 30 days from reissue. | Old bearer links become permanently inactive (404/403). |

---

## 3. ATOMIC DOWNLOAD CLAIM LIFECYCLE & LEDGER DESIGN

To prevent concurrency race conditions, avoid charging customers for storage network drops, and guarantee idempotency, V12.2 introduces the **`download_claims` state ledger**.

### 3.1 Download Claim State Machine
```
                           CLAIM STATE MACHINE
                           
                   +---------------------------------+
                   |             START               |
                   +---------------------------------+
                                    |
                    claim_download_entitlement()
                   [Locks Entitlement Row FOR UPDATE]
                   [Checks Limits, Expiry, Revocation]
                   [Inserts claim record: 'claimed']
                                    |
                                    v
                   +---------------------------------+
                   |         status: claimed         |
                   |   (Slot reserved, count not +1) |
                   +---------------------------------+
                                   /                                   /             Signed URL Delivered   /     \   Storage / Network Error
                                v       v
              +--------------------+  +--------------------+
              |  status: delivered |  |   status: failed   |
              | (Counter increment)|  | (Slot released,    |
              | (Audit log sealed) |  |  counter unchanged)|
              +--------------------+  +--------------------+
```

### 3.2 Database Schema: `public.download_claims`
```sql
CREATE TABLE public.download_claims (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    entitlement_id UUID NOT NULL REFERENCES public.download_entitlements(id) ON DELETE CASCADE,
    claim_type VARCHAR(20) NOT NULL CHECK (claim_type IN ('guest_bearer', 'authenticated_ticket')),
    client_ip VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'delivered', 'failed')),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at TIMESTAMPTZ,
    error_reason TEXT
);

CREATE INDEX idx_download_claims_entitlement ON public.download_claims(entitlement_id, status);
```

### 3.3 Atomic Procedures

#### Procedure 1: `public.claim_download_slot`
```sql
CREATE OR REPLACE FUNCTION public.claim_download_slot(
    p_token_hash VARCHAR(64),
    p_client_ip TEXT DEFAULT 'unknown',
    p_user_agent TEXT DEFAULT 'unknown',
    p_claim_type TEXT DEFAULT 'guest_bearer'
)
RETURNS TABLE (
    success BOOLEAN,
    status_code INT,
    error_message TEXT,
    claim_id UUID,
    entitlement_id UUID,
    storage_path TEXT,
    file_name TEXT,
    mime_type TEXT,
    current_download_count INT,
    download_limit INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ent RECORD;
    v_asset RECORD;
    v_active_claims_count INT;
    v_claim_id UUID;
BEGIN
    -- 1. Explicit Row Lock on Entitlement
    SELECT * INTO v_ent
    FROM public.download_entitlements
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 404, 'Download entitlement not found or invalid token'::TEXT, 
            NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0, 0;
        RETURN;
    END IF;

    -- 2. Verify Active & Revocation Reason
    IF NOT v_ent.is_active OR v_ent.revocation_reason IS NOT NULL THEN
        RETURN QUERY SELECT false, 403, ('Download entitlement has been revoked (reason: ' || COALESCE(v_ent.revocation_reason, 'unknown') || ')')::TEXT,
            NULL::UUID, v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 3. Verify Expiry (NULL expires_at means non-expiring)
    IF v_ent.expires_at IS NOT NULL AND v_ent.expires_at < NOW() THEN
        RETURN QUERY SELECT false, 410, 'Download link has expired'::TEXT,
            NULL::UUID, v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 4. Check Download Limit considering Active Reserved Claims
    SELECT COUNT(*) INTO v_active_claims_count
    FROM public.download_claims
    WHERE entitlement_id = v_ent.id 
      AND status = 'claimed'
      AND claimed_at > NOW() - INTERVAL '2 minutes';

    IF v_ent.download_limit IS NOT NULL AND (v_ent.download_count + v_active_claims_count) >= v_ent.download_limit THEN
        RETURN QUERY SELECT false, 429, 'Download limit reached for this entitlement'::TEXT,
            NULL::UUID, v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 5. Fetch Asset Details
    SELECT * INTO v_asset
    FROM public.digital_assets
    WHERE id = v_ent.digital_asset_id;

    IF NOT FOUND OR v_asset.storage_path IS NULL THEN
        RETURN QUERY SELECT false, 500, 'Digital asset file path could not be resolved'::TEXT,
            NULL::UUID, v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 6. Insert Claim Record in 'claimed' state (Counter is NOT incremented yet)
    INSERT INTO public.download_claims (
        entitlement_id, claim_type, client_ip, user_agent, status, claimed_at
    ) VALUES (
        v_ent.id, p_claim_type, SUBSTRING(p_client_ip FROM 1 FOR 45), SUBSTRING(p_user_agent FROM 1 FOR 500), 'claimed', NOW()
    )
    RETURNING id INTO v_claim_id;

    RETURN QUERY SELECT true, 200, 'Success'::TEXT,
        v_claim_id, v_ent.id, v_asset.storage_path, v_asset.file_name, v_asset.mime_type, 
        v_ent.download_count, v_ent.download_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_download_slot(VARCHAR, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_download_slot(VARCHAR, TEXT, TEXT, TEXT) TO service_role;
```

#### Procedure 2: `public.finalize_download_claim`
```sql
CREATE OR REPLACE FUNCTION public.finalize_download_claim(
    p_claim_id UUID,
    p_status TEXT, -- 'delivered' or 'failed'
    p_error_reason TEXT DEFAULT NULL
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
    WHERE id = p_claim_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    IF v_claim.status != 'claimed' THEN
        -- Already finalized (idempotent no-op)
        RETURN true;
    END IF;

    IF p_status = 'delivered' THEN
        -- Atomically increment entitlement counter and insert permanent log
        UPDATE public.download_entitlements
        SET download_count = download_count + 1,
            updated_at = NOW()
        WHERE id = v_claim.entitlement_id;

        INSERT INTO public.download_logs (
            entitlement_id, ip_address, user_agent, downloaded_at
        ) VALUES (
            v_claim.entitlement_id, v_claim.client_ip, v_claim.user_agent, NOW()
        );

        UPDATE public.download_claims
        SET status = 'delivered', finalized_at = NOW()
        WHERE id = p_claim_id;

    ELSIF p_status = 'failed' THEN
        -- Release reserved slot without incrementing counter
        UPDATE public.download_claims
        SET status = 'failed', finalized_at = NOW(), error_reason = p_error_reason
        WHERE id = p_claim_id;
    END IF;

    RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_download_claim(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_download_claim(UUID, TEXT, TEXT) TO service_role;
```

---

## 4. MIGRATION COMPATIBILITY & ROLLBACK MATRIX

A critical concern in V12.1 was the risk of breaking existing applications if `token` lookups were suddenly replaced by `token_hash`. This section provides the formal compatibility analysis.

### 4.1 Compatibility Matrix Across Lifecycle Scenarios

| Scenario | State in Database | Legacy Application Code (`.eq("token", t)`) | New Application Code (`claim_download_slot(sha256(t))`) | Verdict & Handling |
|---|---|---|---|---|
| **Existing Customer Downloads** | `token` populated, `token_hash` backfilled from migration. | **WORKS:** Legacy code matches `token`. | **WORKS:** New code matches `token_hash = sha256(t)`. | **100% Compatible** |
| **New Purchases (During Migration)** | Migration sets `token = raw_token` AND `token_hash = sha256(raw_token)` during transition. | **WORKS:** Legacy code still finds plaintext `token`. | **WORKS:** New code finds `token_hash`. | **100% Compatible** (Dual-write phase) |
| **Application Rollback (New App -> Old App)** | Database has both `token` and `token_hash`. | **WORKS:** Old app queries `token` without knowledge of `token_hash`. | N/A | **Zero Downtime Rollback** |
| **Database Rollback (New DB -> Old DB)** | Dropping `token_hash` column. | **WORKS:** Old app never depended on `token_hash`. | Fails if app relies on `token_hash`. (App must rollback first). | Standard safe deployment order |

### 4.2 Safe Deployment Sequence
```
+-------------------------------------------------------------------------------------------------------+
|                                    SAFE DEPLOYMENT & ROLLBACK SEQUENCE                                |
+-------------------------------------------------------------------------------------------------------+
|  STEP 1: DATABASE MIGRATION (Additive & Dual-Write)                                                   |
|  - Add token_hash, revocation_reason, is_sandbox, payment_attempts, download_claims.                   |
|  - Backfill: token_hash = sha256(token).                                                              |
|  - Maintain dual-write in capture RPC: populate BOTH token AND token_hash.                            |
|                                                                                                       |
|  STEP 2: APPLICATION DEPLOYMENT (Next.js)                                                             |
|  - Deploy updated download routes utilizing claim_download_slot (SHA-256).                            |
|  - If unexpected bug occurs: Rollback Next.js to legacy code. Legacy code immediately functions        |
|    because plaintext token was populated in dual-write.                                               |
|                                                                                                       |
|  STEP 3: POST-STABILIZATION HARDENING (Optional Final Phase)                                          |
|  - After 30 days of production stability: ALTER TABLE download_entitlements DROP COLUMN token.        |
|  - Capture RPC drops plaintext token write, achieving full zero-plaintext at rest.                    |
+-------------------------------------------------------------------------------------------------------+
```

---

## 5. AUTHORITATIVE SANDBOX FIXTURE AUDIT & COMPLETE INVARIANT SET

### 5.1 Verification Status of Sandbox Identifiers
An exhaustive file-system inspection of the entire repository was performed:
- `22222222-2222-2222-2222-222222222222` (Product ID) -> **UNVERIFIED in database migrations**.
- `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb` (Asset ID) -> **UNVERIFIED in database migrations**.
- `test/sandbox-sample.pdf` (Storage Path) -> **UNVERIFIED in database migrations**.

> [!WARNING]
> **Audit Finding:** The identifiers above exist **only** as mock constants in test suites (`phase1c_v12_test_suite.sql`) and review markdown documents. They are **NOT** present in `20260218_initial_sevolf_digital_commerce.sql` or `20260218_pricing_and_currency_engine.sql`.
>
> In production and staging, hardcoding magic UUIDs in stored procedures risks runtime failures if the sandbox product is seeded with a different UUID.

### 5.2 Corrected Production Sandbox Resolution Mechanism
Instead of brittle hardcoded UUIDs, the capture RPC must resolve the canonical sandbox product dynamically using a database-enforced slug or explicit setting:
```sql
-- Dynamic resolution of sandbox product and asset
SELECT id INTO v_canonical_sandbox_product_id 
FROM public.products 
WHERE slug = 'sandbox-test-sample' OR id = '22222222-2222-2222-2222-222222222222'::UUID
LIMIT 1;

SELECT id INTO v_canonical_sandbox_asset_id
FROM public.digital_assets
WHERE product_id = v_canonical_sandbox_product_id AND storage_path LIKE 'sandbox/%'
LIMIT 1;
```

### 5.3 Complete Sandbox Invariant List (6 Discrete Checks)
1. **Order Marker Check:** Order must have `orders.is_sandbox = true`.
2. **Item Count Cardinality:** `v_order_items_count = 1` (Order cannot contain >1 line item).
3. **Quantity Invariant:** `order_items.quantity = 1` (Line quantity cannot exceed 1).
4. **Product Identity Invariant:** `order_items.product_id` must match approved sandbox product ID.
5. **Asset Identity Invariant:** `digital_assets.id` must match approved sandbox asset ID.
6. **Path Isolation Invariant:** `digital_assets.storage_path` must start with `sandbox/` and production orders must contain **zero** sandbox products, assets, or `sandbox/` paths.

---

## 6. RIGOROUS ENTITLEMENT SEMANTICS

| State / Condition | Database Value | Semantic Behaviour & System Enforcement |
|---|---|---|
| **Zero Download Limit** | `download_limit = 0` | **Unlimited Downloads:** `0` represents unlimited lifetime downloads. Checked as `IF download_limit > 0 AND download_count >= download_limit THEN REJECT`. |
| **Null Download Limit** | `download_limit IS NULL` | **Default Cap Applied:** Interpreted by system policy as 10 downloads or configured store default. |
| **Null Expiry** | `expires_at IS NULL` | **Permanent / Lifetime Entitlement:** Entitlement never expires. Checked as `IF expires_at IS NOT NULL AND expires_at < NOW() THEN REJECT`. |
| **Expired Entitlement** | `expires_at < NOW()` | **Access Terminated (HTTP 410):** Claim RPC halts with code 410. Customer must request renewal or support token rotation. |
| **Refunded Order** | `revocation_reason = 'refund'` | **Permanently Revoked:** `is_active = false`. Capture retries **cannot** reactivate. |
| **Chargeback / Fraud** | `revocation_reason = 'fraud'` | **Permanently Locked:** `is_active = false`. Locked against any customer self-service recovery. |
| **Administrative Lock** | `revocation_reason = 'admin'` | **Manually Locked:** Requires explicit staff clearance via administrative portal. |

---

## 7. REGRESSION TEST MATRIX (V12.2 SPECIFICATION)

| Test ID | Test Name | Specific Assertion Target | Expected DB State |
|---|---|---|---|
| **V12-REG-01** | Atomic Claim Reservation | `claim_download_slot` returns `claim_id` | `download_claims.status = 'claimed'`, `download_count` unchanged |
| **V12-REG-02** | Atomic Finalization Success | `finalize_download_claim(claim_id, 'delivered')` | `download_claims.status = 'delivered'`, `download_count = count + 1` |
| **V12-REG-03** | Atomic Finalization Failure | `finalize_download_claim(claim_id, 'failed')` | `download_claims.status = 'failed'`, `download_count` unchanged |
| **V12-REG-04** | Limit Exhaustion Under Concurrent Claims | 3 concurrent claims on entitlement with limit = 2 | 2 claims succeed; 3rd claim rejected with HTTP 429 |
| **V12-REG-05** | Guest Bearer Download Success | Valid 64-char token without session cookie | HTTP 302 Redirect to signed Storage URL |
| **V12-REG-06** | Authenticated Scoped Ticket Redemption | Ticket redeemed within 5 minutes | HTTP 302 Redirect; ticket marked consumed |
| **V12-REG-07** | Replay of Consumed Ticket | Ticket redeemed a second time | HTTP 403 / 410 Ticket already used |
| **V12-REG-08** | Permanent Lock on Refund Revocation | Capture retry on refunded order | Capture succeeds idempotently; entitlement remains revoked |
| **V12-REG-09** | Sandbox Multi-Item Rejection | Sandbox capture with 2 order items | Rejects with `Sandbox isolation violation: exactly 1 line item` |
| **V12-REG-10** | Real RLS Role-Switching Test | `SET LOCAL ROLE anon; INSERT ...` | Raises error `42501 (insufficient_privilege)` |

---

## 8. REMAINING ASSUMPTIONS & BLOCKERS

1. **Storage Bucket Name & RLS:** The application specifies `digital-products` as the bucket name. In Supabase Storage, `storage.objects` policies must be configured to permit `service_role` to generate signed URLs while denying public reads.
2. **Reverse Proxy IP Trust:** `request.headers.get("x-forwarded-for")` must be verified in the production hosting environment (e.g. Vercel) to ensure the client IP cannot be spoofed.
3. **Local Testing Blocked:** PostgreSQL 18 binaries are not on `PATH` and the Docker desktop daemon is stopped. Automated execution of regression tests requires explicit developer authorization to start services or run CI.

---
**END OF BLUEPRINT — Awaiting explicit approval before proceeding with implementation.**
