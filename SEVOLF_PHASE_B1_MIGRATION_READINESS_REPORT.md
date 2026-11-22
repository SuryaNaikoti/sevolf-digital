# SEVOLF DIGITAL PRODUCT STUDIO
# PHASE B.1: DATABASE MIGRATION READINESS AUDIT REPORT

**Audit Date:** 2026-11-21  
**Auditor:** Antigravity AI  
**Scope:** SQL Migrations Analysis, Schema Discrepancy Verification, Application Contract Compatibility, Risk & Backfill Assessment  
**Audit Policy:** Read-Only Audit. Zero schema modifications, zero DDL execution, zero migrations applied.

---

## 1. Executive Summary

Phase B.1 delivers an exhaustive, read-only readiness audit of the three unapplied SQL migration files identified during the Phase B functional audit:
1. `supabase/migrations/20260220_phase1c_fulfilment_and_claims.sql`
2. `supabase/migrations/20260220_phase1c_procedures.sql`
3. `supabase/migrations/20260221_phase2_platform_extensions.sql`

### Core Audit Findings
- **Crucial Schema Absence Confirmed:** The active PostgreSQL schema is missing the core fulfilment infrastructure introduced in Phase 1C:
  - Missing tables: `payment_attempts`, `refunds`, `download_claims`, and `order_delivery_outbox`.
  - Missing columns: `orders.is_sandbox`, `digital_assets.is_active`, `payments.payment_attempt_id`, and `download_entitlements.token_hash`.
  - Missing stored procedures: `process_order_capture`, `claim_download_entitlement`, `finalize_download_claim`, `fail_download_claim`, `process_order_refund`, `claim_pending_delivery_jobs`, `complete_delivery_job`, and `fail_delivery_job`.
- **Application Compatibility Verification: 100% Match on Phase 1C:** The TypeScript RPC invocations in `src/services/payments/paymentCaptureService.ts`, `src/app/api/download/[token]/route.ts`, and `src/services/workers/outboxWorker.ts` exactly match the signatures, argument names, and types of `20260220_phase1c_procedures.sql`.
- **Phase 2 Migration Redundancy & Schema Conflict:**
  - `20260221_phase2_platform_extensions.sql` contains schema definitions that conflict with the existing architecture. Specifically, it attempts to recreate `public.coupons` (which already exists with different columns) and creates a parallel `collections` table when the active database and admin API already use `public.product_collections` and `public.collection_products`. Furthermore, Phase 2 creates an `admin_users` table which conflicts with the established `profiles JOIN roles` zero-trust RBAC hardened in Phase A.
- **Data Safety Status:** Zero production records are at risk. Active counts on affected tables: `orders` = 0, `payments` = 0, `download_entitlements` = 0.

### Recommendation
- **GO** for Phase 1C migrations (`20260220_phase1c_fulfilment_and_claims.sql` followed by `20260220_phase1c_procedures.sql`).
- **NO-GO / HOLD** for Phase 2 migration (`20260221_phase2_platform_extensions.sql`) until schema reconciliation is performed to avoid schema collisions with the existing `product_collections`, `coupons`, and `profiles` tables.

---

## 2. Individual Migration Inspection

### 1. `20260220_phase1c_fulfilment_and_claims.sql`
- **File Length:** 193 lines.
- **Transactional:** Yes (`BEGIN;` ... `COMMIT;`).
- **Idempotency:** Highly idempotent using `IF NOT EXISTS` on columns, tables, and indexes. Includes safe backfill for `token_hash`.
- **Destructive Operations:** None. Modifies existing tables additively (`ALTER COLUMN DROP NOT NULL`, `ADD COLUMN IF NOT EXISTS`).
- **Tables Created / Modified:**
  - `public.orders`: Adds `is_sandbox BOOLEAN NOT NULL DEFAULT FALSE`.
  - `public.digital_assets`: Adds `is_active BOOLEAN NOT NULL DEFAULT TRUE`, `updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`.
  - `public.payment_attempts` (Created): Pre-checkout intent ledger linking to `orders(id)`.
  - `public.payments`: Adds `payment_attempt_id UUID REFERENCES public.payment_attempts(id) ON DELETE SET NULL`, `updated_at`.
  - `public.download_entitlements`: Drops `NOT NULL` on `token` and `expires_at`. Adds `token_hash CHAR(64)`, `is_revoked`, `revocation_reason`, `revoked_at`, `updated_at`.
  - `public.refunds` (Created): Line-item financial ledger with gateway tracking and status checks.
  - `public.download_claims` (Created): Mutex and reservation ledger for token claims.
  - `public.order_delivery_outbox` (Created): Encrypted token payload delivery outbox with worker leases.
- **Extensions Required:** `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;`.
- **Indexes Created:** 7 performance and uniqueness indexes (e.g., `uq_payments_gateway_txn`, `uq_download_entitlements_token_hash`).
- **RLS Policies:** Explicit customer access (via order ownership check) and administrator full-access policies using `(SELECT public.is_admin())`.

---

### 2. `20260220_phase1c_procedures.sql`
- **File Length:** 938 lines.
- **Transactional:** Yes (`BEGIN;` ... `COMMIT;`).
- **Idempotency:** Fully idempotent using `CREATE OR REPLACE FUNCTION`.
- **Destructive Operations:** None. Strictly functions and permission grants.
- **Functions & Stored Procedures Defined:**
  1. `public.process_order_capture(...)`: Atomic webhook capture, payment attempt validation, order update, entitlement generation, and encrypted outbox job creation in a single transaction.
  2. `public.claim_download_entitlement(...)`: Evaluates token hash, checks quotas/revocations, and acquires atomic claim reservation.
  3. `public.finalize_download_claim(...)`: Finalizes download claim and increments entitlement `download_count`.
  4. `public.fail_download_claim(...)`: Releases reservation on storage signed URL generation failure without penalizing download count.
  5. `public.process_order_refund(...)`: Validates gateway refund idempotency, checks product-level balances, and revokes entitlements if 100% refunded.
  6. `public.claim_pending_delivery_jobs(...)`: Outbox worker queue consumer using `FOR UPDATE SKIP LOCKED` and lease expiration.
  7. `public.complete_delivery_job(...)`: Marks outbox delivery as succeeded.
  8. `public.fail_delivery_job(...)`: Increments retry count with exponential backoff; moves to `exhausted` after 5 attempts.
- **Security Definer & Access:** All 8 functions set `SECURITY DEFINER`, lock down `search_path = ''`, revoke execute from `PUBLIC`, and grant execute strictly to `service_role`.

---

### 3. `20260221_phase2_platform_extensions.sql`
- **File Length:** 191 lines.
- **Transactional:** Partial (No explicit transaction block `BEGIN/COMMIT`).
- **Idempotency:** Uses `CREATE TABLE IF NOT EXISTS`, but contains conflicting schemas.
- **Schema Conflicts Identified:**
  1. **Coupons Table Conflict:** Attempts `CREATE TABLE IF NOT EXISTS public.coupons` with schema `discount_type`, `discount_value`. The active database already has `public.coupons` with `discount_percent`, `discount_amount` (as used by the active admin APIs).
  2. **Collections Redundancy:** Creates `public.collections` and `public.product_collection_memberships`. The active database already has `public.product_collections` and `public.collection_products` actively wired to `/api/admin/collections`.
  3. **RBAC Collision:** Introduces `public.admin_users` and `admin_role` enum. This directly contradicts the authoritative `public.profiles JOIN public.roles` architecture hardened and verified in Phase A.
- **Destructive Operations:** High architectural disruption risk if executed without reconciliation.

---

## 3. Dependency Analysis & Execution Graph

```mermaid
flowchart TD
    Init["20260218_initial_sevolf_digital_commerce.sql\n(Applied & Active)"]
    Pricing["20260218_pricing_and_currency_engine.sql\n(Applied & Active)"]
    
    Init --> Fulf["20260220_phase1c_fulfilment_and_claims.sql\n(Schema & Ledgers)"]
    Pricing --> Fulf
    
    Fulf --> Proc["20260220_phase1c_procedures.sql\n(Stored Procedures & RPCs)"]
    
    Proc -.-> Ext["20260221_phase2_platform_extensions.sql\n(HOLD: Conflicts with Existing Schema)"]
```

### Dependency Rules:
1. `20260220_phase1c_procedures.sql` depends directly on tables and columns created in `20260220_phase1c_fulfilment_and_claims.sql` (e.g. `payment_attempts`, `order_delivery_outbox`, `download_claims`, `orders.is_sandbox`).
2. Therefore, `20260220_phase1c_fulfilment_and_claims.sql` **MUST** be executed before `20260220_phase1c_procedures.sql`.
3. `20260221_phase2_platform_extensions.sql` should be **deferred and refactored**.

---

## 4. Active Database Comparison Matrix

| Object Name | Object Type | Migration Target | Present in Active DB? | Verification Details |
|---|---|---|---|---|
| `pgcrypto` | Extension | Phase 1C Schema | Unknown / Requires CREATE EXTENSION | Will be safely installed in `extensions` schema. |
| `orders.is_sandbox` | Column | Phase 1C Schema | **MISSING** | Probed with `orders.insert`: returns `PGRST204 column missing`. |
| `digital_assets.is_active` | Column | Phase 1C Schema | **MISSING** | Confirmed unapplied. |
| `payment_attempts` | Table | Phase 1C Schema | **MISSING** | Probed with select: returns `PGRST205 table missing`. |
| `payments.payment_attempt_id` | Column | Phase 1C Schema | **MISSING** | Foreign key to `payment_attempts`. Table does not exist. |
| `download_entitlements.token_hash`| Column | Phase 1C Schema | **MISSING** | Probed with insert: returns `PGRST204 column missing`. |
| `refunds` | Table | Phase 1C Schema | **MISSING** | Table does not exist in schema cache. |
| `download_claims` | Table | Phase 1C Schema | **MISSING** | Table does not exist in schema cache. |
| `order_delivery_outbox` | Table | Phase 1C Schema | **MISSING** | Table does not exist in schema cache. |
| `process_order_capture` | Procedure | Phase 1C Proc | **MISSING** | Probed via `supabase.rpc`: returns `PGRST202 function missing`. |
| `claim_download_entitlement` | Procedure | Phase 1C Proc | **MISSING** | Probed via `supabase.rpc`: returns `PGRST202 function missing`. |
| `finalize_download_claim` | Procedure | Phase 1C Proc | **MISSING** | Probed via `supabase.rpc`: returns `PGRST202 function missing`. |
| `fail_download_claim` | Procedure | Phase 1C Proc | **MISSING** | Probed via `supabase.rpc`: returns `PGRST202 function missing`. |
| `process_order_refund` | Procedure | Phase 1C Proc | **MISSING** | Probed via `supabase.rpc`: returns `PGRST202 function missing`. |
| `claim_pending_delivery_jobs` | Procedure | Phase 1C Proc | **MISSING** | Probed via `supabase.rpc`: returns `PGRST202 function missing`. |
| `complete_delivery_job` | Procedure | Phase 1C Proc | **MISSING** | Probed via `supabase.rpc`: returns `PGRST202 function missing`. |
| `fail_delivery_job` | Procedure | Phase 1C Proc | **MISSING** | Probed via `supabase.rpc`: returns `PGRST202 function missing`. |

---

## 5. Application Contract Compatibility Assessment

Inspection of the application service layer confirms exact parity with `20260220_phase1c_procedures.sql`:

### 1. `process_order_capture`
- **Application Caller:** `src/services/payments/paymentCaptureService.ts` (Line 139)
- **Parameters Passed:**
  - `p_order_id`: UUID
  - `p_gateway_transaction_id`: string
  - `p_gateway_order_id`: string
  - `p_charged_amount`: number
  - `p_charged_currency`: string
  - `p_delivery_payloads`: Array of `{ asset_id, token_hash, encrypted_payload }`
  - `p_raw_payload`: Record<string, unknown>
- **SQL Definition:** Line 10-18 in `20260220_phase1c_procedures.sql`.
- **Verdict:** **PERFECT MATCH (100% Type and Parameter Alignment).**

### 2. `claim_download_entitlement`
- **Application Caller:** `src/app/api/download/[token]/route.ts` (Line 22)
- **Parameters Passed:** `p_raw_token: string`, `p_idempotency_key: string`
- **SQL Definition:** Line 358-361 in `20260220_phase1c_procedures.sql`.
- **Verdict:** **PERFECT MATCH.**

### 3. `claim_pending_delivery_jobs`
- **Application Caller:** `src/services/workers/outboxWorker.ts` (Line 82)
- **Parameters Passed:** `p_batch_size: number`, `p_lease_seconds: number`
- **SQL Definition:** Line 809-813 in `20260220_phase1c_procedures.sql`.
- **Verdict:** **PERFECT MATCH.**

---

## 6. Data Safety & Risk Assessment

### 1. Existing Record Audit
- `public.orders`: **0 records**.
- `public.payments`: **0 records**.
- `public.download_entitlements`: **0 records**.
- `public.coupons`: **3 records** (All active and untouched).
- `public.digital_assets`: **4 records** (Adding `is_active DEFAULT TRUE` is fully non-destructive).
- `public.products`: **4 records** (Unaffected).

### 2. Locking & Downtime Risk
- Because `orders`, `payments`, and `download_entitlements` currently contain **zero rows**, table alterations (`ADD COLUMN`, `ALTER COLUMN DROP NOT NULL`) will execute in sub-millisecond time.
- Zero row locks or contention will occur.
- **Zero downtime risk.**

### 3. Rollback Safety
- Both Phase 1C migrations are enclosed in explicit `BEGIN ... COMMIT` blocks. Any syntax error or permission check failure will rollback atomically without partial application.

---

## 7. Recommended Execution Order & Staging Procedure

### Step 1: Pre-Migration Backup Checklist
- [x] Record active row counts on core tables (`orders`: 0, `payments`: 0, `entitlements`: 0, `coupons`: 3, `products`: 4).
- [ ] Export Supabase PostgreSQL database dump via Supabase Dashboard / CLI (`supabase db dump`).
- [ ] Verify database connection permissions for `service_role` and `postgres`.

### Step 2: Staging Migration Execution Sequence
1. **Apply Migration 1**:
   Execute `supabase/migrations/20260220_phase1c_fulfilment_and_claims.sql` via Supabase SQL Editor.
   *Verification query:*
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'orders' AND column_name = 'is_sandbox';
   ```
2. **Apply Migration 2**:
   Execute `supabase/migrations/20260220_phase1c_procedures.sql` via Supabase SQL Editor.
   *Verification query:*
   ```sql
   SELECT routine_name FROM information_schema.routines 
   WHERE routine_schema = 'public' AND routine_name = 'process_order_capture';
   ```
3. **Post-Migration Schema Cache Reload**:
   Notify PostgREST schema cache to immediately pick up new tables and RPCs:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

### Step 3: Phase 2 Action
- **Hold** `20260221_phase2_platform_extensions.sql`. Refactor in a future sprint to remove redundant `coupons` and `collections` tables and align with `product_collections` and `profiles`.

---

## 8. Final GO / NO-GO Recommendation

| Target Migration | Readiness Status | Recommendation | Reason |
|---|---|---|---|
| `20260220_phase1c_fulfilment_and_claims.sql` | Ready & Safe | **GO (Approved for Staging)** | Non-destructive, transactional, required prerequisite for procedures. |
| `20260220_phase1c_procedures.sql` | Ready & Safe | **GO (Approved for Staging)** | 100% application parity, strict security definer, required for checkout/downloads. |
| `20260221_phase2_platform_extensions.sql` | Schema Conflicts | **NO-GO (Hold / Refactor)** | Clashes with existing `coupons`, `product_collections`, and `profiles` RBAC. |

**Audit Status:** Completed and certified. Awaiting explicit user confirmation before any migration is applied.
