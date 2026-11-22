# SEVOLF DIGITAL COMMERCE — ADMIN API SECURITY & DATA INTEGRITY AUDIT REPORT

**Target Scope:** `src/app/api/admin/*` Route Handlers & V16 Staging Verification Records  
**Audit Standard:** Zero-Trust Authorization, Fail-Closed Security, DB Constraint Integrity  
**Date:** 2026-11-21  
**Status:** AUDIT COMPLETED — PENDING ARCHITECTURAL APPROVAL

---

## 1. Executive Summary

This independent security and data-integrity audit evaluates the newly deployed administrative Route Handlers:

1. `POST/PATCH/DELETE /api/admin/products` & `/api/admin/products/[slug]`
2. `POST/PATCH /api/admin/collections`
3. `POST/PATCH /api/admin/coupons`
4. `POST/PATCH /api/admin/assets`

### Key Assessment Findings:

- **Critical Vulnerability (AUTH-01):** The newly introduced API routes currently use `createAdminClient()` (bypassing RLS with `SUPABASE_SERVICE_ROLE_KEY`) without first authenticating the caller's session via Supabase Auth cookies or verifying that the caller possesses the `admin` role in `public.profiles`. Any unauthenticated HTTP client or malicious network caller can issue requests directly to `/api/admin/*` to create, edit, or delete draft products, collections, coupons, and asset metadata.
- **Service-Role Boundary (SECR-01):** Service-role credentials are restricted strictly to server-side Node.js execution and are **never exposed or leaked to the client browser**.
- **Staging Invariant Gates (STAG-01):** Direct publication (`status: 'published'`) and production price activation are explicitly blocked within `/api/admin/products`. However, status parameter tampering and missing schema sanitization on other fields require formal Zod validation schemas.
- **Storage Verification Gap (STOR-01):** Asset registration in `/api/admin/assets` inserts metadata into `public.digital_assets` without verifying whether the referenced file object physically exists within the private `digital-products` Storage bucket.
- **Test Artifact Ledger:** Five staging verification records currently reside in the live database. Exact states have been cataloged with remediation recommendations below.

---

## 2. In-Depth API Route Vulnerability Analysis

### Finding 1: Unauthenticated Admin Endpoint Exposure (CRITICAL)

- **Affected Routes:**
  - `src/app/api/admin/products/route.ts` (GET, POST)
  - `src/app/api/admin/products/[slug]/route.ts` (GET, PATCH, DELETE)
  - `src/app/api/admin/collections/route.ts` (GET, POST, PATCH)
  - `src/app/api/admin/coupons/route.ts` (GET, POST, PATCH)
  - `src/app/api/admin/assets/route.ts` (GET, POST, PATCH)
- **Evidence:**
  Every route directly initializes `const supabase = createAdminClient()` and executes operations without calling `supabase.auth.getUser()` or checking `public.profiles.role_id`.
  In `src/middleware.ts`, session protection is applied only to `/account/*`; `/api/admin/*` routes have no middleware-level or handler-level authentication check.
- **Impact:**
  An unauthorized external actor or malicious user could trigger `POST /api/admin/products` or `DELETE /api/admin/products/slug` without an active session.
- **Severity:** **CRITICAL (CVSS 9.1)**
- **Recommended Fix:**
  Implement a central server-side helper `requireAdminSession()` that:
  1. Inspects the request using `createSupabaseServerClient()` via cookies.
  2. Retrieves the authenticated user via `supabase.auth.getUser()`.
  3. Verifies that the user has an `admin` role in `public.profiles` (or calls the PostgreSQL `public.is_admin()` helper).
  4. Returns `401 Unauthorized` if unauthenticated, or `403 Forbidden` if not an admin, before executing any privileged `createAdminClient()` query.

---

### Finding 2: Missing Object Existence Check in Storage Bucket (HIGH)

- **Affected Route:** `src/app/api/admin/assets/route.ts` (POST)
- **Evidence:**
  `POST /api/admin/assets` takes `file_name` and `storage_path` from the request body and directly inserts a row into `public.digital_assets`. It does not perform `supabase.storage.from('digital-products').list(...)` or `getMetadata()` to verify that the file actually exists in private storage.
- **Impact:**
  Phantom digital assets (such as `Declutter-Checklist-A4.pdf`) can be registered and bound to products without a corresponding binary file in private storage, leading to download failure (`404` or `500`) when an authorized customer attempts to claim the entitlement.
- **Severity:** **HIGH (Data Integrity Risk)**
- **Recommended Fix:**
  Prior to inserting into `public.digital_assets`, call `supabase.storage.from('digital-products').list(folderPath)` to verify that the object exists and that its actual byte size matches `file_size_bytes`.

---

### Finding 3: Missing Schema Validation (Zod) & Raw Error Message Leakage (MEDIUM)

- **Affected Routes:** All `/api/admin/*` routes.
- **Evidence:**
  Payloads are parsed via raw `await req.json()` with manual `if (!name) ...` assertions rather than a strict Zod schema.
  Database error responses return raw PostgreSQL errors:
  ```ts
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  ```
- **Impact:**
  PostgreSQL constraint names, schema topology, and database internal column names are returned to the caller.
- **Severity:** **MEDIUM**
- **Recommended Fix:**
  Validate incoming payloads with Zod schemas. Map database errors to sanitized user-facing messages (e.g. _"A product with this slug already exists"_ for unique violations) and log detailed error diagnostics server-side.

---

### Finding 4: Incomplete Relationship Validation on Asset-to-Product Binding (MEDIUM)

- **Affected Route:** `src/app/api/admin/assets/route.ts` (POST, PATCH)
- **Evidence:**
  When `product_id` is supplied in the request body, the route does not explicitly verify that `product_id` matches a valid, non-archived record in `public.products` prior to submission.
- **Impact:**
  Foreign-key constraint violations are caught only at the database layer (`23503`), rather than validated gracefully at the API layer.
- **Severity:** **MEDIUM**
- **Recommended Fix:**
  Query `public.products` to ensure the target product exists and is active/draft before inserting or updating asset binding.

---

## 3. Verification of Mandated Security Checks

| Security Requirement                                     |     Status     | Audit Observation & Evidence                                                                                                                                                 |
| -------------------------------------------------------- | :------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Every route requires authenticated administrator**     |  ❌ **FAIL**   | Routes do not verify auth cookies or caller session. (See Finding 1).                                                                                                        |
| **Authorization enforced server-side**                   |  ❌ **FAIL**   | Enforced only via UI state disabling in browser; backend handlers lack session verification.                                                                                 |
| **Service-role credentials never reach browser**         |  ✅ **PASS**   | `SUPABASE_SERVICE_ROLE_KEY` is loaded exclusively inside Node.js Server Route Handlers (`@/lib/supabase/admin`). Client bundle contains zero service keys.                   |
| **Request payloads validated server-side**               | ⚠️ **PARTIAL** | Basic null/empty checks exist, but lacks type coercion and strict Zod validation.                                                                                            |
| **Unauthorized users cannot create/edit/delete**         |  ❌ **FAIL**   | Bypassing UI allows direct REST execution due to missing session verification.                                                                                               |
| **Draft products cannot be published via API tampering** |  ✅ **PASS**   | `POST` and `PATCH` in `/api/admin/products` explicitly check `if (body.status === "published")` and return `403 Forbidden` (`PRODUCTION_PUBLISH_GATED`).                     |
| **Production prices cannot be activated via API calls**  |  ✅ **PASS**   | Direct price activation flags are rejected with `403 Forbidden` (`PRODUCTION_PRICING_GATED`). Staging price reference is displayed without mutating `public.product_prices`. |
| **Coupon activation cannot bypass staging restrictions** | ⚠️ **PARTIAL** | Coupon codes can be toggled active/inactive, but no customer checkout can redeem them because the storefront checkout rejects unapproved coupons.                            |
| **Asset registration verifies object exists in Storage** |  ❌ **FAIL**   | No `storage.from().list()` check before inserting row into `public.digital_assets`. (See Finding 2).                                                                         |
| **Product and asset relationships validated**            | ⚠️ **PARTIAL** | Database enforces foreign key, but API handler lacks pre-validation.                                                                                                         |
| **Database errors handled without exposing secrets**     | ⚠️ **PARTIAL** | No secrets leaked, but raw PostgreSQL error strings (`error.message`) are returned in 400 responses.                                                                         |

---

## 4. Audit of V16 Staging Verification Records

The following 5 records were created in the database during V16 verification testing. Each record was inspected via direct SQL query with zero modifications made:

| #     | Item / Record Name                         | Target Table                 | Current Database State                                                                                                                                                                                       | Audit Finding                                                                                                                                     | Recommendation                                                                       |
| ----- | ------------------------------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **1** | **Test Productivity Playbook**             | `public.products`            | `id`: `3c8ebf78-8672-4a20-9207-b62adb129bb8`<br>`slug`: `test-productivity-playbook`<br>`status`: `draft`<br>`created_at`: `2026-11-21T06:51:58.76744Z`                                                      | Test record safely isolated in `draft` status. Not visible on public storefront (`status = 'published'` RLS policy).                              | **DELETE** upon approval to restore pristine catalogue state.                        |
| **2** | **WELCOME20**                              | `public.coupons`             | `id`: `57e6cc70-8ad5-412e-8543-a0d553df3f6c`<br>`code`: `WELCOME20`<br>`discount_percent`: `20`<br>`is_active`: `true`<br>`times_used`: `0`                                                                  | Active test coupon. Checkout validation does not expose public discounts unless published.                                                        | **REVERT / DEACTIVATE** or **DELETE** upon approval.                                 |
| **3** | **Home & Living (Studio Edition)**         | `public.product_collections` | `id`: `415ad7b5-0242-4eaf-9e19-379930c490fe`<br>`name`: `Home & Living (Studio Edition)`<br>`slug`: `home-living`<br>`updated_at`: `2026-11-21T06:52:02.234Z`                                                | Name was modified from original seed value _"Home & Living"_. Collection is active and visible on storefront.                                     | **REVERT** name back to _"Home & Living"_ to preserve production consistency.        |
| **4** | **Modified 14-Day Home Reset Kit Tagline** | `public.products`            | `slug`: `14-day-home-reset-kit`<br>`tagline`: _"A restorative step-by-step system for reclaiming serenity in your home."_<br>`updated_at`: `2026-11-21T06:51:59.211Z`                                        | The tagline is currently aligned with the original high-quality seed copy. Product remains safely in `draft`.                                     | **RETAIN** (Tagline is accurate and high quality).                                   |
| **5** | **Declutter-Checklist-A4.pdf**             | `public.digital_assets`      | `id`: `6fdd5602-acbf-4f32-afb2-92a3ce5f28a1`<br>`storage_path`: `products/digital-assets/Declutter-Checklist-A4.pdf`<br>`product_id`: `284fc059-3be0-44a2-969f-899ea23ead2a`<br>`checksum`: `a5e0a9e525efbb` | **Phantom Asset**: Verified that no file exists at `products/digital-assets/Declutter-Checklist-A4.pdf` in the `digital-products` Storage bucket. | **DELETE** record from `public.digital_assets` to prevent entitlement claim failure. |

---

## 5. Proposed Remediation Plan (Awaiting Approval)

Before executing any changes or applying remediation code, user approval is required on the following sequence:

1. **Step 1 — Create `src/lib/auth/adminGate.ts`:**
   Implement `requireAdminSession(request: Request)` that verifies the Supabase session and confirms the caller's role is `admin` in `public.profiles`. Return 401/403 before any database query.
2. **Step 2 — Integrate Auth Checks on all `/api/admin/*` Routes:**
   Add `const auth = await requireAdminSession(req); if (auth.error) return auth.response;` at the top of every GET, POST, PATCH, and DELETE handler.
3. **Step 3 — Add Storage Object Verification in `/api/admin/assets`:**
   Check `supabase.storage.from('digital-products').list()` before inserting metadata.
4. **Step 4 — Add Zod Schema Validation & Sanitize Error Outputs:**
   Reject malformed payloads with typed validation errors and replace raw PostgreSQL messages with friendly sanitized descriptions.
5. **Step 5 — Clean Up Test Records:**
   - Delete draft product `test-productivity-playbook`.
   - Delete test coupon `WELCOME20`.
   - Revert collection name to _"Home & Living"_.
   - Delete phantom asset `Declutter-Checklist-A4.pdf`.
   - Retain updated flagship tagline for `14-day-home-reset-kit`.

---

## 6. Audit Conclusion

The new admin APIs correctly block storefront publication, price activation, and credential leakage to the browser. However, **they critically lack server-side session authentication**, allowing unauthenticated REST requests to modify draft records.

Remediation must be applied before considering Phase 1C/V16 production-ready.
