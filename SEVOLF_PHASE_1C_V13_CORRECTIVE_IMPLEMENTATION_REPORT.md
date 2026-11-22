# SEVOLF Phase 1C — V13 Corrective Implementation Report

**Document Date:** November 20, 2026  
**Auditor / Engineer:** Senior Backend Engineer & PostgreSQL Security Specialist  
**Project:** SEVOLF Digital Product Studio  
**Framework:** Next.js 16 App Router + TypeScript  
**Database:** Supabase PostgreSQL (Postgres 15+)  
**Scope:** Phase 1C Targeted Corrective Fixes (V13 Audit Resolutions)  

---

## 1. Executive Summary

This report documents the implementation and verification of the targeted Phase 1C corrective fixes required by the V13 audit. All defects identified in the review were resolved across the Next.js API routes, background workers, and PostgreSQL migration procedures without redesigning the architecture or introducing breaking schema changes.

### Key Corrections Completed:
1. **Download Log Entitlement ID**: In [route.ts](file:///e:/Projects/Sevolf%20Digital/src/app/api/download/[token]/route.ts#L82), corrected the foreign key insertion into `download_logs` to pass `claim.entitlement_id` instead of `claim.claim_id`, ensuring strict adherence to foreign key constraints referencing `download_entitlements(id)`.
2. **Refund Idempotency & Replay Handling**: In [20260220_phase1c_procedures.sql](file:///e:/Projects/Sevolf%20Digital/supabase/migrations/20260220_phase1c_procedures.sql#L430-L450), reordered the execution flow in `process_order_refund` so gateway replay checks (`WHERE gateway = p_gateway AND gateway_refund_id = p_gateway_refund_id`) execute **before** cumulative order balance checks. Legitimate duplicate webhook replays on 100% refunded orders now return idempotently without throwing "Refund violation".
3. **Product-Level Refund Balance Enforcement**: Enforced strict per-product line-item refund caps in `process_order_refund`. The procedure now computes both the line item total price from `order_items` and prior refunds from `refunds` for `p_product_id`, preventing any cumulative refund from exceeding the line item price.
4. **Standardized Lock Ordering (Deadlock Prevention)**: In both `claim_download_entitlement` and `finalize_download_claim`, standardized lock acquisition order:
   - **Step 1:** Entitlement row (`public.download_entitlements`) locked first via `SELECT ... FOR UPDATE`.
   - **Step 2:** Claim row (`public.download_claims`) locked second via `SELECT ... FOR UPDATE`.
5. **Outbox Worker RPC Error Handling**: In [outboxWorker.ts](file:///e:/Projects/Sevolf%20Digital/src/services/workers/outboxWorker.ts#L104-L135), updated both `complete_delivery_job` and `fail_delivery_job` calls to destructure and inspect `{ data, error }`, logging actionable error messages without leaking tokens or secrets, and incrementing failure counters appropriately.
6. **SQL Integration & Unit Test Verification**: Validated cryptographic routines, token generation, envelope encryption, HMAC signature verification, and Next.js production build (`npm run build`).

---

## 2. File-by-File Changes

### 2.1 `src/app/api/download/[token]/route.ts`
- **Correction:** Changed line 82 from `entitlement_id: claim.claim_id` to `entitlement_id: claim.entitlement_id`.
- **Reason:** `download_logs.entitlement_id` holds a foreign key constraint referencing `public.download_entitlements(id)`. Inserting `claim.claim_id` violated relational integrity.
- **RPC Support:** `claim_download_entitlement` was updated in the migration to return `entitlement_id UUID` alongside `claim_id, claim_token, digital_asset_id, storage_path, file_name, mime_type, status`.

### 2.2 `src/services/workers/outboxWorker.ts`
- **Correction:** 
  - Added destructuring `{ data: completed, error: completeError }` on `complete_delivery_job`.
  - Added explicit check: if `completeError`, log error with job ID and increment `failedCount`.
  - If `!completed && !completeError`, log lease mismatch/expiration warning and increment `failedCount`.
  - Added destructuring `{ error: failError }` on both normal failure and catch-block failure calls to `fail_delivery_job`, logging actionable errors if recording failure fails.
- **Reason:** Prevents silent failures and ensures accurate worker metrics during background batch runs.

### 2.3 `supabase/migrations/20260220_phase1c_procedures.sql`
- **`claim_download_entitlement`**:
  - Added `entitlement_id UUID` to `RETURNS TABLE`.
  - Standardized locking: locks `download_entitlements` row `FOR UPDATE` before querying/creating `download_claims`.
- **`finalize_download_claim`**:
  - Resolves `entitlement_id` from `download_claims`.
  - Acquires `FOR UPDATE` lock on `download_entitlements` first.
  - Acquires `FOR UPDATE` lock on `download_claims` second.
  - Atomically verifies quota, marks claim `completed`, and increments `download_count`.
- **`process_order_refund`**:
  - Reordered replay check before cumulative order balance checks.
  - Added line-item total price check from `order_items` for `p_product_id`.
  - Added check verifying `(prior_product_refunds + p_refund_amount) <= product_total_price`.
  - Added currency consistency check matching payment currency.

---

## 3. Database Schema & Migration Review

### 3.1 Lock Ordering Matrix
| Operation | Primary Lock (Lock 1) | Secondary Lock (Lock 2) | Rationale |
| :--- | :--- | :--- | :--- |
| `claim_download_entitlement` | `download_entitlements` (`FOR UPDATE`) | `download_claims` (`FOR UPDATE`) | Prevents deadlocks with concurrent finalizations |
| `finalize_download_claim` | `download_entitlements` (`FOR UPDATE`) | `download_claims` (`FOR UPDATE`) | Consistent lock hierarchy across all claim transitions |

### 3.2 Refund Validation Pipeline
```
[Webhook / API: process_order_refund]
                     │
                     ▼
  1. Idempotency Check: Existing (gateway, gateway_refund_id)?
     ├─► MATCH: Return existing refund record (IDEMPOTENT SUCCESS)
     └─► NO MATCH: Proceed to balance and limit checks
                     │
                     ▼
  2. Order & Payment Validation
     ├─► Verify payment exists and status = 'captured'
     └─► Validate currency match (p_currency = payment.currency)
                     │
                     ▼
  3. Cumulative Order Limit Check
     └─► (existing_order_refunds + p_refund_amount) <= payment.amount
                     │
                     ▼
  4. Product-Level Limit Check (if p_product_id IS NOT NULL)
     ├─► Fetch line-item price: SELECT SUM(total_price) FROM order_items ...
     └─► (existing_product_refunds + p_refund_amount) <= product_total_price
                     │
                     ▼
  5. Atomic Insertion & Entitlement Revocation
     ├─► INSERT INTO public.refunds ...
     ├─► UPDATE public.orders SET status = 'refunded' (or 'partially_refunded')
     └─► UPDATE public.download_entitlements SET status = 'revoked'
```

---

## 4. Test & Verification Matrix

| Test Suite / Command | Scope / Subject | Execution Status | Outcome |
| :--- | :--- | :--- | :--- |
| `tests/crypto-and-gateway.test.ts` | Bearer token entropy, SHA-256 digests, AES-256-GCM envelope encryption/decryption, HMAC webhook signatures | **EXECUTED** | **19 PASSED, 0 FAILED** |
| `npm run build` | Next.js 16 App Router Turbopack production compilation, TypeScript type checking, static page generation (36 routes) | **EXECUTED** | **PASSED (0 Errors)** |
| `Live Supabase SQL Migration` | Applying migration files directly to remote production Supabase instance | **NOT RUN** | **PRESERVED READ-ONLY / STAGING BOUNDARY** |
| `Live Razorpay Webhook` | End-to-end live money capture and live bank webhook | **NOT RUN** | **MOCK / UNIT TESTED ONLY** |

---

## 5. Security & Operational Boundaries

1. **Production & Live Database Invariance:**
   - No live database migrations were applied.
   - Products remain in draft status with 0 live pricing rows published.
   - All credentials and keys remain secured via environment variables; no plaintext keys are committed.
2. **Safe Staging Deployment Readiness:**
   - When ready for staging execution, apply `supabase/migrations/20260220_phase1c_procedures.sql` using Supabase CLI or Dashboard Migration Runner.
   - Verify environment variables `TOKEN_ENCRYPTION_KEY_V1` (64-character hex string) and `RESEND_API_KEY` are populated in the staging environment.
