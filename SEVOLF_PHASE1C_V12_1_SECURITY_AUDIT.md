# SEVOLF PHASE 1C — V12.1 SECURITY AUDIT & CORRECTION PLAN

**Audit Date:** 2026-11-19  
**Auditor Role:** Senior PostgreSQL/Supabase Security Engineer & Next.js Backend Architect  
**Status:** Audit Completed | STRICTLY READ-ONLY (Zero source code, database, migration, or environment mutations)

---

## 1. EXECUTIVE VERDICT

### **VERDICT: NOT APPROVED — BLOCKERS FOUND**

The SEVOLF digital commerce implementation demonstrates significant conceptual hardening across iterations V1 through V12, notably in transaction locking, idempotent payment insertion, and hash-at-rest token models. However, comprehensive static analysis of the actual repository, the V12 proposal document, the standalone test suite, and the Next.js download API route (`src/app/api/download/[token]/route.ts`) revealed **seven critical architectural and security blockers**.

### Summary of Critical Blockers:
1. **Unprotected Demonstration Backdoor:** `src/app/api/download/[token]/route.ts` fabricates and streams a dummy PDF whenever a token starts with `token_sample_`, completely bypassing entitlement validation, customer authentication, status checks, and download logging.
2. **Download Token Hash-at-Rest Decoupling:** The API route performs lookups against the legacy `token` column (`.eq("token", token)`), completely ignoring the proposed SHA-256 `token_hash` column.
3. **Download Accounting Race Condition:** Entitlement checking, download logging, and counter incrementation occur as separate asynchronous client-side operations rather than an atomic database transaction.
4. **Guest Customer Download Denial:** The download API unconditionally enforces that the requesting visitor possess an active Supabase authenticated session matching `user_id` or `customer_email`, completely locking out guest purchasers who receive bearer download links via email.
5. **Entitlement Revocation Reactivation Discrepancy:** The `process_order_capture` procedure in the V12 proposal document (`SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md`) omits `revocation_reason` handling entirely, allowing previously revoked entitlements to be silently reactivated by delayed or duplicate capture events.
6. **Incomplete Sandbox Cardinality in Proposed Capture RPC:** The proposed `process_order_capture` procedure in the V12 review document validates sandbox asset storage paths but fails to enforce `v_order_items_count = 1` or `quantity = 1`.
7. **Privileged RLS Test Simulation:** Test 27 in `supabase/tests/phase1c_v12_test_suite.sql` sets JWT claim session variables but executes within a single `DO $$` block under the privileged `postgres`/`superuser` role where table ownership or superuser status bypasses RLS by default.

Implementation is **NOT APPROVED** until the V12.1 corrective architecture specified herein is reviewed and explicitly authorized.

---

## 2. REPOSITORY INSPECTION

The following actual workspace files were inspected in their entirety:

| File Path | Description | Verified State |
|---|---|---|
| `src/app/api/download/[token]/route.ts` | Customer download API route (Next.js App Router) | **VERIFIED ACTIVE** (136 lines). Contains fabricated sample token bypass, non-atomic counter updates, legacy token lookups, and guest lockout. |
| `src/app/account/library/page.tsx` | Customer account digital library UI | **VERIFIED ACTIVE** (105 lines). Contains hardcoded `token_sample_892144_01` and `token_sample_714002_02` sample tokens. |
| `supabase/migrations/20260218_initial_sevolf_digital_commerce.sql` | Base schema migration | **VERIFIED ACTIVE** (762 lines). Defines `download_entitlements` with `token VARCHAR(255) UNIQUE NOT NULL`, `user_id UUID REFERENCES profiles(id)`, `customer_email VARCHAR(255)`. |
| `supabase/migrations/20260218_pricing_and_currency_engine.sql` | Multi-currency pricing migration | **VERIFIED ACTIVE** (246 lines). Adds `charged_amount` and `charged_currency` to `orders`. |
| `docs/SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md` | V12 Corrective Review Proposal Document | **VERIFIED ACTIVE** (1,582 lines, 86,127 bytes). Contains proposed DDL, RPCs, and documentation. |
| `supabase/tests/phase1c_v12_test_suite.sql` | Standalone V12 PostgreSQL 18 Test Suite | **VERIFIED ACTIVE** (629 lines, 36,030 bytes). Contains 28 test scenarios and 52 ASSERT statements. |
| `src/lib/supabase/admin.ts` | Privileged Supabase service-role client | **VERIFIED ACTIVE** (14 lines). Exports `createAdminClient()` utilizing `SUPABASE_SERVICE_ROLE_KEY`. |

---

## 3. CRITICAL BLOCKERS

### Finding ID: SEC-BLK-01 — Fabricated Sample Token Bypass in Production API
- **Severity:** **CRITICAL**
- **File & Line:** `src/app/api/download/[token]/route.ts#L61-L74`
- **Actual Behaviour:**
  ```typescript
  if (token.startsWith("token_sample_")) {
    return new NextResponse(
      "%%PDF-1.4\n%% SEVOLF Digital - Protected Digital Edition\n%% Token: " + token,
      {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="SEVOLF-Digital-${token.slice(0, 12)}.pdf"`,
        },
      }
    );
  }
  ```
- **Expected Behaviour:** Any download request presenting a token that does not correspond to an active, unexpired, and non-exhausted entitlement record in `public.download_entitlements` must be rejected with HTTP 404/403.
- **Security / Business Impact:** Predictable token synthesis allows unauthenticated users to generate valid PDF HTTP 200 payloads without purchasing products or possessing valid database records.
- **Recommended Correction:** Remove lines 61–73 entirely. Replace with a unified database lookup error handler.

---

### Finding ID: SEC-BLK-02 — Download API Uses Legacy Plaintext Token Column
- **Severity:** **HIGH**
- **File & Line:** `src/app/api/download/[token]/route.ts#L56`
- **Actual Behaviour:**
  ```typescript
  const { data: entitlement, error: entError } = await adminClient
    .from("download_entitlements")
    .select(...)
    .eq("token", token)
    .single();
  ```
- **Expected Behaviour:** In alignment with the V12 hash-at-rest architecture, the incoming bearer token must be hashed via SHA-256 (`crypto.createHash('sha256').update(token).digest('hex')`) and queried against `token_hash`. A fallback to `token` should only be permitted during a transitional backfill window.
- **Security / Business Impact:** If the database migration makes `token` nullable and populates only `token_hash` on new purchases (as defined in `process_order_capture`), new customers will receive 404 errors when attempting to download purchased assets.
- **Recommended Correction:** Update the route to compute `token_hash = sha256(token)` and execute an atomic claim RPC or query `.eq("token_hash", tokenHash)`.

---

### Finding ID: SEC-BLK-03 — Non-Atomic Download Verification & Counter Race Condition
- **Severity:** **HIGH**
- **File & Line:** `src/app/api/download/[token]/route.ts#L98-L133`
- **Actual Behaviour:** The API route performs three disconnected operations:
  1. Checks `if (entitlement.download_count >= entitlement.download_limit)` (Line 98).
  2. Generates a signed storage URL (Line 111).
  3. Inserts into `download_logs` (Line 123) and updates `download_count` (Line 129).
- **Expected Behaviour:** Entitlement status verification, expiration checking, download limit evaluation, log insertion, and counter incrementation must execute within a single atomic database transaction utilizing row-level locking (`FOR UPDATE`). If signed URL creation fails, the counter must not increment.
- **Security / Business Impact:** Concurrent requests using the same token (e.g. multi-connection download accelerators) can easily bypass `download_limit`, obtaining dozens of simultaneous downloads before the first counter update completes. Furthermore, if storage fails after logging, customer download allowances are permanently consumed without delivering the file.
- **Recommended Correction:** Author a PostgreSQL stored procedure `claim_download_entitlement(p_token_hash, p_ip, p_user_agent)` that atomically evaluates and reserves the download slot.

---

### Finding ID: SEC-BLK-04 — Total Denial of Service for Guest Customer Downloads
- **Severity:** **HIGH**
- **File & Line:** `src/app/api/download/[token]/route.ts#L78-L87`
- **Actual Behaviour:**
  ```typescript
  const isOwner =
    (user && entitlement.user_id && user.id === entitlement.user_id) ||
    (user && entitlement.customer_email && user.email === entitlement.customer_email);

  if (!isOwner) {
    return NextResponse.json(
      { error: "Access denied. You do not hold ownership entitlement for this asset." },
      { status: 403 }
    );
  }
  ```
- **Expected Behaviour:** SEVOLF supports guest checkout. Customers who complete purchase via email without creating a password-authenticated Supabase profile must be able to download their purchased assets using the high-entropy bearer token sent to their email. Authenticated verification should be an added layer for user library screens, not a blanket blocker on token redemption.
- **Security / Business Impact:** Every guest purchaser clicking their order confirmation download link receives HTTP 403 Forbidden because `user` is null in their browser cookie jar.
- **Recommended Correction:** Formalize dual-path entitlement access: high-entropy bearer tokens authenticate guest downloads; authenticated sessions permit customer dashboard viewing and token reissuance.

---

### Finding ID: SEC-BLK-05 — Capture RPC in Review Document Omits Revocation Reason Logic
- **Severity:** **HIGH**
- **File & Line:** `docs/SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md#L450-L480` (Block 4)
- **Actual Behaviour:** The `process_order_capture` procedure authored in Block 4 of `SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md` implements the old conflict clause:
  ```sql
  ON CONFLICT (order_id, digital_asset_id) 
  DO UPDATE SET 
      token_hash = EXCLUDED.token_hash,
      token = NULL,
      is_active = true
  WHERE download_entitlements.order_id = p_order_id 
    AND download_entitlements.is_active = false;
  ```
- **Expected Behaviour:** As specified in V12 Section 1, the `ON CONFLICT` clause must evaluate `revocation_reason`:
  ```sql
  WHERE download_entitlements.order_id = p_order_id 
    AND download_entitlements.is_active = false
    AND download_entitlements.revocation_reason IS NULL;
  ```
- **Security / Business Impact:** If the SQL from Block 4 of the review document were deployed, capture retries would reactivate entitlements that had been revoked due to refunds, fraud, or chargebacks. (Note: The standalone test suite `phase1c_v12_test_suite.sql` had this correction, but the primary reference document `SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md` was out of sync).
- **Recommended Correction:** Synchronize Block 4 in `SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md` to include `revocation_reason IS NULL`.

---

### Finding ID: SEC-BLK-06 — Capture RPC in Review Document Omits Strict Sandbox Cardinality
- **Severity:** **HIGH**
- **File & Line:** `docs/SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md#L305-L330` (Block 4)
- **Actual Behaviour:** Block 4 in `SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md` checks that products have assets, but does not check `v_order_items_count = 1` or `oi.quantity = 1` for sandbox orders.
- **Expected Behaviour:** Sandbox orders must strictly enforce `v_order_items_count = 1` and `oi.quantity = 1`.
- **Security / Business Impact:** A sandbox order with multiple quantities or multiple line items could be marked paid and generate excess entitlements.
- **Recommended Correction:** Synchronize Block 4 in `SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md` with the strict cardinality checks present in `phase1c_v12_test_suite.sql`.

---

### Finding ID: SEC-BLK-07 — Privileged Superuser Execution of RLS Behavioral Tests
- **Severity:** **MEDIUM**
- **File & Line:** `supabase/tests/phase1c_v12_test_suite.sql#L549-L596` (Test 27)
- **Actual Behaviour:** Test 27 simulates roles by calling `PERFORM set_config('request.jwt.claim.sub', ...)` while executing as `postgres` (or `superuser`). In PostgreSQL, superusers and table owners bypass RLS policies by default unless `FORCE ROW LEVEL SECURITY` is enabled.
- **Expected Behaviour:** RLS testing should execute `SET LOCAL ROLE anon;` and `SET LOCAL ROLE authenticated;` with explicit grants, proving access control under real database role constraints.
- **Security / Business Impact:** Tests may falsely pass under privileged sessions because table permissions are not restricted as they would be for actual connection pool roles.
- **Recommended Correction:** Wrap role tests with `SET LOCAL ROLE anon` and `SET LOCAL ROLE authenticated`, restoring `RESET ROLE` at block completion, and apply `FORCE ROW LEVEL SECURITY` to the tables.

---

## 4. V12 SQL FINDINGS & ANALYSIS

### 4.1 Entitlement Reactivation Analysis
- **Finding:** In `phase1c_v12_test_suite.sql`, `process_order_capture` specifies:
  ```sql
  WHERE download_entitlements.order_id = p_order_id 
    AND download_entitlements.is_active = false
    AND download_entitlements.revocation_reason IS NULL;
  ```
- **Verification:**
  1. When an entitlement is revoked via `process_order_refund`, `revocation_reason` is set to `'refund'`.
  2. If a delayed Razorpay webhook re-triggers `process_order_capture`, the `ON CONFLICT` condition fails because `revocation_reason` is not null.
  3. The entitlement remains `is_active = false` and `revocation_reason = 'refund'`.
  4. For administrative revocations, reasons like `'fraud'` or `'admin'` similarly prevent reactivation.
  5. **Verdict:** Verified sound in `phase1c_v12_test_suite.sql`, but missing from Block 4 in `SEVOLF_PHASE_1C_FINAL_SQL_REVIEW_V12.md`.

### 4.2 Sandbox Order Validation Analysis
- **Invariants Enforced:**
  1. `v_order_items_count = 1` (Rejects multiple items).
  2. `oi.quantity = 1` (Rejects quantity > 1).
  3. `oi.product_id = '22222222-2222-2222-2222-222222222222'` (Approved sandbox product).
  4. `da.id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'` (Approved sandbox asset).
  5. `da.storage_path = 'test/sandbox-sample.pdf'` (Approved sandbox path).
  6. Production orders reject sandbox products, sandbox assets, or any asset with path starting with `test/`.
- **Verdict:** Correctly implemented in `phase1c_v12_test_suite.sql`.

### 4.3 Refund and Revocation Lifecycle
- **Invariants Enforced:**
  1. Full refund (`v_total_refunded >= v_total_paid`) transitions order to `refunded` and sets `is_active = false, revocation_reason = 'refund'` on all order entitlements.
  2. Partial line-item refund sets `revocation_reason = 'refund'` only on entitlements associated with the refunded product.
  3. Repeated refund webhooks return `idempotent = true` and do not alter counts.
  4. Failed or pending refunds record status without revoking entitlements.

---

## 5. TEST-SUITE AUDIT & COVERAGE

### 5.1 Verification Matrix of 28 Test Scenarios

| Test | Objective | Actual Code Coverage | Status |
|---|---|---|---|
| **Test 1** | Successful clean capture | Exercises full capture flow, payment creation, entitlement generation | **VERIFIED** |
| **Test 2** | Duplicate capture idempotency | Hits existing payment verification branch | **VERIFIED** |
| **Test 3** | Cross-order payment collision | Hits cross-order transaction reuse rejection | **VERIFIED** |
| **Test 4** | Missing digital asset pre-mutation | Halts at Gate 2 before payment insertion | **VERIFIED** |
| **Test 5** | Duplicate order items for same product | Aggregates distinct products correctly | **VERIFIED** |
| **Test 6** | Full refund revocation | Sets `revocation_reason = 'refund'`, order status `refunded` | **VERIFIED** |
| **Test 7** | Refunded entitlement capture retry | Proves capture retry on refunded order fails | **VERIFIED** |
| **Test 8** | Pending-to-processed refund transition | Updates status from pending to processed cleanly | **VERIFIED** |
| **Test 9** | Payment attempt mismatch | Rejects nonexistent gateway order ID | **VERIFIED** |
| **Test 10** | Failed attempt rejection | Rejects capture on failed payment attempt | **VERIFIED** |
| **Test 11** | Sandbox order rejects production assets | Rejects production product in sandbox order | **VERIFIED** |
| **Test 12** | Production order rejects sandbox assets | Rejects sandbox product in production order | **VERIFIED** |
| **Test 13** | Exact canonical sandbox capture | Validates approved product + asset + path | **VERIFIED** |
| **Test 14** | Sandbox unapproved asset rejection | Rejects unapproved asset mapped to test order | **VERIFIED** |
| **Test 15** | Refund product ID mismatch | Rejects refund replay with differing product ID | **VERIFIED** |
| **Test 16** | Token rotation recovery | Rotates token hash on challenge recovery | **VERIFIED** |
| **Test 17** | Partial refund preserves other items | Retains active entitlement on non-refunded item | **VERIFIED** |
| **Test 18** | Duplicate refund idempotency | Replays identical processed refund idempotently | **VERIFIED** |
| **Test 19** | Payment cap exceeded rejection | Rejects refund exceeding captured amount | **VERIFIED** |
| **Test 20** | Pending refund transition to failed | Updates status from pending to failed | **VERIFIED** |
| **Test 21** | Security definer search path check | Verifies `proconfig[1] = 'search_path='` | **VERIFIED** |
| **Test 22** | Default refund status check | Verifies column default is `'pending'` | **VERIFIED** |
| **Test 23** | Fraud-revoked permanent lock | Validates capture cannot reactivate fraud revocation | **VERIFIED** |
| **Test 24** | Admin-revoked permanent lock | Validates capture cannot reactivate admin revocation | **VERIFIED** |
| **Test 25** | Sandbox multi-item rejection | Rejects sandbox order with 2 line items | **VERIFIED** |
| **Test 26** | Sandbox invalid quantity rejection | Rejects sandbox order with line quantity = 2 | **VERIFIED** |
| **Test 27** | Real RLS behavioral tests | Evaluates anon, Customer A, and Customer B | **PARTIALLY VERIFIED** (Session variable based; needs `SET LOCAL ROLE`) |
| **Test 28** | Challenge token lifecycle | Rejects reused, expired, and cross-order challenges | **VERIFIED** |

---

## 6. DOWNLOAD API AUDIT & ATOMIC ACCOUNTING SPECIFICATION

### 6.1 Guest vs. Authenticated Policy Design
To support frictionless digital delivery while protecting account security:

1. **Guest Customers (Bearer Token Flow):**
   - The customer receives an email containing a link: `/api/download/[token]`.
   - The token is a 64-character cryptographically secure hex string ($2^{256}$ entropy).
   - The API hashes the token (`token_hash = sha256(token)`).
   - If the token hash matches an active, non-expired entitlement with `download_count < download_limit`, the download is authorized. No user session is required.
   
2. **Authenticated Customers (Account Dashboard Flow):**
   - When viewing the Library (`/account/library`), the UI queries `/api/account/entitlements`.
   - The customer session (`auth.uid()`) authorizes viewing order assets.
   - If a customer needs a fresh link, the server generates/reissues a token for their active entitlement.

3. **Rate Limiting & Abuse Prevention:**
   - IP-level rate limiting on `/api/download/[token]`: Maximum 10 requests per minute per IP.
   - Entitlement download limits (e.g. 5 or 10 lifetime downloads).

### 6.2 Atomic Download Accounting RPC (`claim_download_entitlement`)

To resolve **SEC-BLK-03**, download accounting must be handled by an atomic database procedure:

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
    -- 1. Atomically lock entitlement by token_hash
    SELECT * INTO v_ent
    FROM public.download_entitlements
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, 404, 'Download entitlement not found or invalid token'::TEXT, 
            NULL::UUID, NULL::TEXT, NULL::TEXT, NULL::TEXT, 0, 0;
        RETURN;
    END IF;

    -- 2. Verify active status
    IF NOT v_ent.is_active THEN
        RETURN QUERY SELECT false, 403, ('Download entitlement has been revoked (reason: ' || COALESCE(v_ent.revocation_reason, 'unknown') || ')')::TEXT,
            v_ent.id, NULL::TEXT, NULL::TEXT, NULL::TEXT, v_ent.download_count, v_ent.download_limit;
        RETURN;
    END IF;

    -- 3. Verify expiry
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

    -- 6. Atomically log download and increment count
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

---

## 7. DATABASE & RLS FINDINGS

### 7.1 Column Naming Consistency: `mime_type` vs `content_type`
- In `supabase/migrations/20260218_initial_sevolf_digital_commerce.sql` (Line 108), `public.digital_assets` defines:
  ```sql
  mime_type VARCHAR(100) NOT NULL,
  ```
- In earlier SQL review drafts, some queries referenced `a.content_type`.
- In `phase1c_v12_test_suite.sql` (Line 59), `digital_assets` has `mime_type VARCHAR(100) NOT NULL`.
- **Finding:** All future migrations and RPCs must strictly reference `mime_type`.

### 7.2 RLS Execution Context Hardening
To prevent superuser bypass during automated testing:
- Enable `ALTER TABLE public.download_entitlements FORCE ROW LEVEL SECURITY;`
- Enable `ALTER TABLE public.payment_attempts FORCE ROW LEVEL SECURITY;`
- Enable `ALTER TABLE public.payment_refunds FORCE ROW LEVEL SECURITY;`
- When writing tests in PostgreSQL, execute:
  ```sql
  SET LOCAL ROLE anon;
  -- verify access denied
  SET LOCAL ROLE authenticated;
  -- verify customer access
  RESET ROLE;
  ```

---

## 8. RECOMMENDED V12.1 CORRECTIONS (ORDERED PLAN)

### Phase 1: Database Migration & Atomic Procedure Deployment
1. Author migration `20260218120000_phase1c_v12_1_relational_hardening.sql`:
   - Add `is_sandbox` to `orders`.
   - Create `payment_attempts` with unique constraints.
   - Create `payment_refunds` with default `status = 'pending'`.
   - Add `payment_attempt_id` to `payments`.
   - Add `token_hash VARCHAR(64)` and `revocation_reason VARCHAR(50)` to `download_entitlements`.
   - Make `download_entitlements.token` nullable and create unique index on `token_hash`.
   - Backfill SHA-256 hashes for existing plaintext tokens.
   - Deploy `claim_download_entitlement` stored procedure.
   - Deploy hardened `process_order_capture`, `process_order_refund`, and `recover_order_tokens` RPCs.

### Phase 2: Next.js API Route Refactoring
1. Edit `src/app/api/download/[token]/route.ts`:
   - Remove the `token_sample_` backdoor.
   - Compute `token_hash = crypto.createHash('sha256').update(token).digest('hex')`.
   - Invoke `adminClient.rpc('claim_download_entitlement', { p_token_hash: tokenHash, p_client_ip: ip, p_user_agent: ua })`.
   - If successful, generate signed URL using `storage_path` and redirect.
   - Remove unconditional customer login requirement to allow guest bearer downloads.

### Phase 3: Customer Library Mock Token Cleanup
1. Edit `src/app/account/library/page.tsx`:
   - Replace hardcoded `token_sample_*` entries with dynamic library loading from Supabase API or graceful empty-state handling.

---

## 9. REQUIRED REGRESSION TESTS

| Test ID | Test Scenario | Execution Step | Expected Result |
|---|---|---|---|
| **REG-01** | Fabricated Token Rejection | GET `/api/download/token_sample_892144_01` | **HTTP 404** (JSON `{ error: "Download entitlement not found or invalid token" }`) |
| **REG-02** | Guest Bearer Download | GET `/api/download/<valid_64_char_token>` without session cookies | **HTTP 307/302 Redirect** to valid Supabase signed storage URL |
| **REG-03** | Download Limit Exceeded | GET `/api/download/<valid_token>` when `download_count >= download_limit` | **HTTP 429** (`Download limit reached`) |
| **REG-04** | Atomic Counter Increment | Concurrently execute 5 GET requests for entitlement with `download_limit = 2` | Exactly 2 requests return 302; remaining 3 return **HTTP 429** |
| **REG-05** | Revoked Entitlement Capture Retry | Trigger capture retry for order whose entitlement has `revocation_reason = 'refund'` | Capture succeeds idempotently; entitlement remains `is_active = false` |
| **REG-06** | Sandbox Multi-Item Rejection | Trigger sandbox capture with 2 order items | Fails with `Sandbox isolation violation: Sandbox order must contain exactly 1 line item` |
| **REG-07** | Real RLS Anon Write Block | `SET LOCAL ROLE anon; INSERT INTO public.payment_attempts ...` | Fails with PostgreSQL error `42501 (insufficient_privilege)` |

---

## 10. DEPLOYMENT READINESS CHECKLIST

Before authorizing production deployment of Phase 1C:

- [ ] **SEC-01:** Fabricated `token_sample_` logic completely purged from `src/app/api/download/[token]/route.ts`.
- [ ] **SEC-02:** Database RPC `claim_download_entitlement` verified for atomic row-locking.
- [ ] **SEC-03:** Guest download access confirmed operational without requiring active session cookie.
- [ ] **SEC-04:** Both launch products (`14-day-home-reset-kit` and `mitthus-fun-learning-book`) verified in `draft` status.
- [ ] **SEC-05:** Table `public.product_prices` verified at strictly 0 records.
- [ ] **SEC-06:** Migration `20260218120000_phase1c_v12_1_relational_hardening.sql` tested on staging Supabase instance with complete rollback verification.
- [ ] **SEC-07:** Real role testing (`anon`, `authenticated`, `service_role`) executed under actual PostgreSQL connection contexts.

---
**END OF REPORT — Awaiting explicit user approval before proceeding to implementation.**
