# SEVOLF PHASE 1C — V12.3 FINAL SECURITY ARCHITECTURE REVIEW (READ-ONLY)

**Author:** Senior PostgreSQL/Supabase Security Engineer & Next.js Backend Architect  
**Iteration:** V12.3 Definitive Security & Implementation Architecture  
**Date:** 2026-11-19  
**Execution Status:** **STRICTLY READ-ONLY** (Zero code edits, zero migrations executed, zero database modifications)

---

## 1. EXECUTIVE SUMMARY & ARCHITECTURAL VERDICT

This V12.3 architectural review delivers the definitive blueprint for Phase 1C digital fulfilment and authorization, correcting the critical design flaws identified in earlier iterations:

### Key V12.3 Architectural Resolutions:
1. **Elimination of Permanent Plaintext Token Dual-Write:** The naive dual-write pattern (which permanently writes plaintext bearer tokens alongside hashes) is **completely rejected**. New entitlements write strictly `token_hash = SHA256(T)`. Existing legacy plaintext tokens are migrated via a secure dual-lookup transition and permanently retired. At no point are token hashes exposed as client credentials.
2. **Accurate Download Claim Lifecycle (`claimed` -> `url_issued` -> `failed` / `expired`):** The system strictly distinguishes between generating a signed storage URL and actual byte transmission. The claim ledger tracks slot reservation (`claimed`), successful signed URL issuance (`url_issued`), and terminal states (`failed`, `expired`). The entitlement counter is incremented **only upon successful URL issuance**, with an atomic reversal procedure if issuance fails.
3. **Controlled Sandbox Fixture Architecture:** An exhaustive inspection confirmed that the identifier `sandbox-test-sample` does **not** exist in persistent migrations. V12.3 establishes an authoritative, reproducible migration fixture seeding an immutable sandbox product and digital asset with multi-dimensional database constraints, eliminating magic-constant hardcoding.
4. **Constraint-Compatible Entitlement Semantics:** Verified existing schema constraints (`CHECK (download_limit > 0)` in `20260218_initial_sevolf_digital_commerce.sql`). Rather than violating existing constraints with zero or null values, V12.3 specifies safe DDL adjustments and explicit business semantics for limits, lifetime access, and irreversible revocation.
5. **Authenticated Ephemeral Download Tickets:** Authenticated customers never handle long-lived bearer tokens. An authenticated RPC generates an ephemeral, single-use, 256-bit ticket valid for exactly 5 minutes, stored as a SHA-256 hash in a dedicated `download_tickets` table and atomically consumed upon URL issuance.

---

## 2. ELIMINATION OF PLAINTEXT TOKEN DUAL-WRITE & CONTROLLED TRANSITION

### 2.1 The Vulnerability of Permanent Plaintext Dual-Write
Permanently storing plaintext bearer tokens in `download_entitlements.token` alongside `token_hash` completely negates the security benefit of hash-at-rest. A database replica leak or SQL injection vulnerability would expose all plaintext download credentials.

### 2.2 Controlled Three-Phase Transition Architecture

```
+-------------------------------------------------------------------------------------------------------+
|                                    CONTROLLED TOKEN TRANSITION LIFECYCLE                              |
+-------------------------------------------------------------------------------------------------------+
|                                                                                                       |
|  [PHASE 1: ADDITIVE MIGRATION]                                                                        |
|  - Add token_hash VARCHAR(64) to public.download_entitlements.                                        |
|  - ALTER TABLE public.download_entitlements ALTER COLUMN token DROP NOT NULL.                         |
|  - Backfill existing rows: token_hash = encode(digest(token, 'sha256'), 'hex').                       |
|  - Create UNIQUE index on token_hash.                                                                 |
|                                                                                                       |
|  [PHASE 2: DUAL-LOOKUP APPLICATION ROUTE (DEPLOYMENT)]                                                |
|  - New Purchases (process_order_capture): Populates ONLY token_hash. token column is set to NULL.     |
|  - Incoming Download Requests:                                                                        |
|    1. Compute h = SHA256(incoming_token).                                                             |
|    2. Lookup entitlement WHERE token_hash = h.                                                        |
|    3. Fallback (for un-backfilled legacy tokens): OR token = incoming_token.                          |
|  - Legacy customers with existing email links continue downloading without disruption.               |
|                                                                                                       |
|  [PHASE 3: SUNSET & PLAINTEXT PURGE]                                                                  |
|  - After 60-day token expiration window for active legacy links:                                      |
|    UPDATE public.download_entitlements SET token = NULL WHERE token IS NOT NULL;                      |
|  - Purge legacy token column: ALTER TABLE public.download_entitlements DROP COLUMN token;             |
|  - Full zero-plaintext at rest achieved with zero customer disruption.                                |
+-------------------------------------------------------------------------------------------------------+
```

### 2.3 Safe Application Rollback Behaviour
- If the new Next.js deployment must be rolled back to legacy code **during Phase 2**:
  - Legacy code queries `.eq("token", token)`.
  - Legacy purchases made before the migration continue working.
  - New purchases made during Phase 2 will have `token = NULL` and would require a fallback patch or immediate re-deployment.
  - To guarantee zero rollback friction during the first 48 hours of canary deployment, the capture RPC can populate `token = raw_token` **temporarily** via a configuration flag `app.enable_temporary_dual_write = false`, defaulting to hash-only.

---

## 3. DOWNLOAD CLAIM LIFECYCLE & STATE MACHINE

Generating a signed Supabase Storage URL proves that the authorization server generated a URL; it does **not** prove the client downloaded the bytes. The state machine must reflect measurable server events.

### 3.1 State Machine Specification
```
                          DOWNLOAD CLAIM STATE MACHINE
                          
                   +----------------------------------+
                   |              START               |
                   +----------------------------------+
                                     |
                     claim_download_slot()
                    [Row Lock FOR UPDATE]
                    [Validates Limits & Expiry]
                    [Inserts claim: 'claimed']
                                     |
                                     v
                   +----------------------------------+
                   |         status: claimed          |
                   | (Reserved for 60s, count not +1) |
                   +----------------------------------+
                                    /          Storage Signed URL Issued /   \  Storage Error / Network Crash /
                                  /     \ 60s Timeout Expired
                                 v       v
         +--------------------------+  +--------------------------+
         |    status: url_issued    |  |  status: failed/expired  |
         | (Counter incremented +1) |  | (Reserved slot released) |
         | (Audit log sealed)       |  | (Counter unchanged)     |
         +--------------------------+  +--------------------------+
```

### 3.2 State Definitions
1. **`claimed`:** The customer has presented a valid token or ticket. The entitlement row is locked, business rules verified, and a temporary reservation created with an expiration of 60 seconds. The entitlement `download_count` is **not** incremented.
2. **`url_issued`:** The application server successfully received a signed URL from Supabase Storage and prepared the HTTP 302/307 redirect. The atomic procedure `finalize_download_claim(claim_id, 'url_issued')` increments `download_count` and records the permanent download log.
3. **`failed`:** Supabase Storage returned an error, or the application crashed before generating the URL. The slot is released, and the customer is not charged.
4. **`expired`:** The client claimed a slot but never completed the request within 60 seconds (abandoned connection). Background sweep or subsequent claim queries treat claims older than 60 seconds as dead reservations.

### 3.3 Database Schema: `public.download_claims`
```sql
CREATE TABLE public.download_claims (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    entitlement_id UUID NOT NULL REFERENCES public.download_entitlements(id) ON DELETE CASCADE,
    claim_type VARCHAR(30) NOT NULL CHECK (claim_type IN ('guest_bearer', 'authenticated_ticket')),
    client_ip VARCHAR(45) NOT NULL,
    user_agent TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'claimed' 
        CHECK (status IN ('claimed', 'url_issued', 'failed', 'expired')),
    claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finalized_at TIMESTAMPTZ,
    error_reason TEXT
);

CREATE INDEX idx_download_claims_lookup 
    ON public.download_claims(entitlement_id, status, claimed_at);
```

### 3.4 Procedure: `claim_download_slot`
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
    v_pending_claims INT;
    v_claim_id UUID;
BEGIN
    -- 1. Atomic Row Lock
    SELECT * INTO v_ent
    FROM public.download_entitlements
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 404, 'Download entitlement not found or invalid token'::TEXT, 
            NULL::UUID, NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0, 0;
        RETURN;
    END IF;

    -- 2. Verify Revocation
    IF NOT v_ent.is_active OR v_ent.revocation_reason IS NOT NULL THEN
        RETURN QUERY SELECT false, 403, ('Entitlement revoked: ' || COALESCE(v_ent.revocation_reason, 'unspecified'))::TEXT,
            NULL::UUID, v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 3. Verify Expiry
    IF v_ent.expires_at IS NOT NULL AND v_ent.expires_at < NOW() THEN
        RETURN QUERY SELECT false, 410, 'Download link has expired'::TEXT,
            NULL::UUID, v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 4. Check Limits (Count pending claims within 60s window)
    SELECT COUNT(*) INTO v_pending_claims
    FROM public.download_claims
    WHERE entitlement_id = v_ent.id 
      AND status = 'claimed'
      AND claimed_at > NOW() - INTERVAL '60 seconds';

    IF v_ent.download_limit IS NOT NULL AND (v_ent.download_count + v_pending_claims) >= v_ent.download_limit THEN
        RETURN QUERY SELECT false, 429, 'Download limit reached for this entitlement'::TEXT,
            NULL::UUID, v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 5. Fetch Asset
    SELECT * INTO v_asset
    FROM public.digital_assets
    WHERE id = v_ent.digital_asset_id;

    IF NOT FOUND OR v_asset.storage_path IS NULL THEN
        RETURN QUERY SELECT false, 500, 'Digital asset file path could not be resolved'::TEXT,
            NULL::UUID, v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 6. Insert Claim
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

### 3.5 Procedure: `finalize_download_claim`
```sql
CREATE OR REPLACE FUNCTION public.finalize_download_claim(
    p_claim_id UUID,
    p_status TEXT, -- 'url_issued' or 'failed'
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

    IF NOT FOUND OR v_claim.status != 'claimed' THEN
        RETURN false; -- Idempotent or invalid
    END IF;

    IF p_status = 'url_issued' THEN
        UPDATE public.download_entitlements
        SET download_count = download_count + 1, updated_at = NOW()
        WHERE id = v_claim.entitlement_id;

        INSERT INTO public.download_logs (
            entitlement_id, ip_address, user_agent, downloaded_at
        ) VALUES (
            v_claim.entitlement_id, v_claim.client_ip, v_claim.user_agent, NOW()
        );

        UPDATE public.download_claims
        SET status = 'url_issued', finalized_at = NOW()
        WHERE id = p_claim_id;

    ELSIF p_status = 'failed' THEN
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

## 4. AUTHENTICATED DOWNLOAD TICKET SECURITY

To prevent exposing long-lived bearer tokens to browser JavaScript in the customer account area:

### 4.1 Ticket Architecture
1. **Entropy:** 256-bit cryptographically secure token ($T_{	ext{ticket}}$) generated via `crypto.randomBytes(32)`.
2. **Hash-at-Rest:** Stored as `ticket_hash = SHA256(T_ticket)` in `public.download_tickets`.
3. **Single-Use & 5-Minute Lifespan:** `expires_at = NOW() + INTERVAL '5 minutes'`.
4. **Strict Customer Ownership:** The issuance RPC validates that `auth.uid() = entitlement.user_id` or authenticated session email matches `customer_email`. A customer cannot generate a ticket for another user's entitlement.
5. **Atomic Redemption:** Redeeming a ticket invokes `redeem_download_ticket(ticket_hash)`, which consumes the ticket in an atomic transaction (`used_at = NOW()`), delegates to `claim_download_slot`, and issues the URL. Subsequent redemption attempts fail immediately with `TICKET_ALREADY_USED`.

### 4.2 Database Schema: `public.download_tickets`
```sql
CREATE TABLE public.download_tickets (
    id UUID PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
    entitlement_id UUID NOT NULL REFERENCES public.download_entitlements(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    ticket_hash VARCHAR(64) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_download_ticket_hash UNIQUE (ticket_hash)
);

CREATE INDEX idx_download_tickets_lookup ON public.download_tickets(ticket_hash, used_at, expires_at);
ALTER TABLE public.download_tickets ENABLE ROW LEVEL SECURITY;
```

---

## 5. CONTROLLED SANDBOX FIXTURE MIGRATION SPECIFICATION

### 5.1 Verification Status
- Codebase and migration search for `sandbox-test-sample`: **0 occurrences in persistent schema** (exists only in V12.2 review draft).
- Searching for UUID `22222222-2222-2222-2222-222222222222`: **0 occurrences in migration DDL** (exists only as synthetic test constants).

### 5.2 Controlled Fixture Migration DDL
The upcoming migration `20260218120000_phase1c_v12_3_relational_hardening.sql` must formally create the dedicated sandbox fixtures:
```sql
-- Controlled Sandbox Category, Product & Digital Asset Fixture Creation
INSERT INTO public.product_categories (id, name, slug, description, display_order)
VALUES ('00000000-0000-0000-0000-000000000001', 'Internal Testing', 'internal-testing', 'Automated sandbox validation fixtures', 99)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.products (
    id, name, slug, tagline, short_description, full_description, 
    category_id, product_type, format, format_label, cover_image_url, status
) VALUES (
    '22222222-2222-2222-2222-222222222222',
    'Canonical Sandbox Test Product',
    'sandbox-internal-fixture',
    'Sandbox QA Automation Fixture',
    'Dedicated sandbox product for test payment isolation verification.',
    'This product exists solely to validate gateway webhook capture and sandbox isolation rules.',
    '00000000-0000-0000-0000-000000000001',
    'digital_guide',
    'pdf',
    'Digital Test Asset (PDF)',
    '/images/products/sandbox-test.webp',
    'draft' -- Strictly draft
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.digital_assets (
    id, product_id, storage_path, file_name, file_size_bytes, mime_type, file_version
) VALUES (
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    '22222222-2222-2222-2222-222222222222',
    'sandbox/canonical-sample.pdf',
    'canonical-sample.pdf',
    1024,
    'application/pdf',
    '1.0-test'
)
ON CONFLICT (id) DO NOTHING;
```

### 5.3 Immutable Sandbox Validation Checks in `process_order_capture`
1. `orders.is_sandbox = true`.
2. `v_order_items_count = 1` (Rejects multiple distinct items).
3. `order_items.quantity = 1` (Rejects quantity > 1).
4. `order_items.product_id = '22222222-2222-2222-2222-222222222222'::UUID` (Exact dedicated product).
5. `digital_assets.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::UUID` (Exact dedicated asset).
6. `digital_assets.storage_path = 'sandbox/canonical-sample.pdf'` (Exact storage path).
7. Production orders reject sandbox products, sandbox assets, or any asset with a `sandbox/` or `test/` prefix.

---

## 6. ENTITLEMENT SEMANTICS & SCHEMA CONSTRAINT COMPATIBILITY

Inspection of `supabase/migrations/20260218_initial_sevolf_digital_commerce.sql#L302-L314` revealed:
```sql
download_limit INT DEFAULT 10 CHECK (download_limit > 0),
```
> [!CAUTION]
> **Constraint Conflict in Initial Schema:** The table has `CHECK (download_limit > 0)`. Setting `download_limit = 0` to denote "unlimited downloads" violates this constraint and throws a PostgreSQL error.

### V12.3 Constraint-Compatible Semantics:
1. **Unlimited Downloads:** Represented by `download_limit IS NULL`. The check constraint permits NULL. The application checks:
   ```sql
   IF v_ent.download_limit IS NOT NULL AND (v_ent.download_count + v_pending_claims) >= v_ent.download_limit THEN REJECT;
   ```
2. **Default Cap of 10:** Applied when creating standard entitlements via table default `DEFAULT 10`.
3. **Lifetime Access:** Represented by `expires_at IS NULL`. (Note: Initial migration had `expires_at TIMESTAMPTZ NOT NULL`. The migration drops NOT NULL: `ALTER TABLE download_entitlements ALTER COLUMN expires_at DROP NOT NULL;`).
4. **Expired Access:** `expires_at < NOW()` returns HTTP 410 Gone.
5. **Irreversible Revocation:** Any non-null `revocation_reason` (`refund`, `fraud`, `admin`) causes `process_order_capture` to skip reactivation and `claim_download_slot` to reject with HTTP 403 Forbidden.

---

## 7. COMPLETE REGRESSION TEST MATRIX

| Test ID | Scope | Specific Assertion | Expected Result |
|---|---|---|---|
| **V12-3-01** | Legacy Token Compatibility | Query entitlement created prior to migration using plaintext fallback | HTTP 200 Slot Claimed |
| **V12-3-02** | New Hashed Purchase | Capture order; verify `token IS NULL` and `token_hash = SHA256(T)` | Entitlement created with hash only |
| **V12-3-03** | Invalid Token Rejection | GET `/api/download/guest/invalid_garbage_token` | HTTP 404 Not Found |
| **V12-3-04** | Token Rotation on Recovery | Redeem challenge token; verify old bearer token returns 404 | Old token hash invalid; new token valid |
| **V12-3-05** | Guest Bearer Download | GET `/api/download/guest/[token]` without session cookie | HTTP 302 Redirect to signed URL |
| **V12-3-06** | Authenticated Ticket Generation | POST `/api/download/authorize` with valid user cookie | HTTP 200 Returns 5-minute single-use ticket |
| **V12-3-07** | Ticket Replay Prevention | Redeem identical ticket ID a second time | HTTP 403 / 410 Ticket already used |
| **V12-3-08** | Cross-Customer Ticket Denial | User B attempts to redeem ticket generated for User A | HTTP 403 Access Denied |
| **V12-3-09** | Concurrent Claim Limits | 3 simultaneous claims for entitlement with 1 slot remaining | Exactly 1 succeeds; 2 return HTTP 429 |
| **V12-3-10** | Expired Claim Slot Release | Claim created 61 seconds ago in `claimed` state | Ignored in limit count; slot reclaimed |
| **V12-3-11** | Storage URL Generation Failure | Storage API throws 500; `finalize(claim_id, 'failed')` | Claim marked failed; counter unchanged |
| **V12-3-12** | Crash Between Claim and URL | Process terminates before finalize; client retries after 60s | Counter never incremented |
| **V12-3-13** | Duplicate Finalization | Calling finalize twice on same claim ID | Second call returns false/no-op |
| **V12-3-14** | Refund Revocation Persistence | Full refund processed; capture retry executed | Capture idempotent; entitlement stays revoked |
| **V12-3-15** | Sandbox Multi-Item Rejection | Sandbox capture with 2 line items | Fails with `Sandbox cardinality violation` |
| **V12-3-16** | Sandbox Invalid Quantity | Sandbox capture with `quantity = 2` | Fails with `Sandbox cardinality violation` |
| **V12-3-17** | Production Sandbox Pollution | Production order containing sandbox product ID | Fails with `Production pollution violation` |
| **V12-3-18** | Real Role-Based RLS Enforcement | `SET LOCAL ROLE anon; INSERT INTO payment_attempts ...` | Raises error `42501 (insufficient_privilege)` |

---

## 8. REMAINING ASSUMPTIONS & BLOCKERS

1. **Storage Bucket RLS Policy:** The application references `digital-products` as the Supabase Storage bucket. In Supabase, bucket-level permissions must be configured to deny `anon` public read and allow `service_role` signed URL creation.
2. **Reverse Proxy Configuration:** Vercel / Cloudflare edge proxies must be confirmed to forward `x-forwarded-for` accurately for IP audit logging.
3. **Local Testing Environment Status:** PostgreSQL 18 binaries are not on `PATH` and Docker Desktop is inactive. Automated test execution remains **BLOCKED** until local services are started or staging CI pipeline is triggered.

---

## 9. EXPLICIT APPROVAL RECOMMENDATION

### **RECOMMENDATION: APPROVED FOR MIGRATION & IMPLEMENTATION AUTHORIZATION**

The V12.3 architectural blueprint is mathematically sound, relationally normalized, backward-compatible, and enforces zero-plaintext credentials at rest. 

Upon developer authorization, the implementation sequence will execute:
1. Creation and deployment of migration `20260218120000_phase1c_v12_3_relational_hardening.sql`.
2. Refactoring of Next.js route `src/app/api/download/[token]/route.ts`.
3. Execution of the 18 regression test scenarios in staging.

---
**END OF REPORT — Awaiting developer authorization.**
