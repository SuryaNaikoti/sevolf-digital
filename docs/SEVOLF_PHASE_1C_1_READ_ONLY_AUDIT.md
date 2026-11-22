# SEVOLF DIGITAL — PHASE 1C.1
# READ-ONLY ARCHITECTURE & SCHEMA AUDIT

**Audit Document:** `SEVOLF_PHASE_1C_1_READ_ONLY_AUDIT.md`  
**Project:** SEVOLF Digital Product Studio  
**Workspace:** `E:\Projects\Sevolf Digital`  
**Execution Context:** Strictly Read-Only Audit  
**Auditor Roles:** Senior Next.js SaaS Architect, Supabase Database Auditor, Payment Security Engineer  
**Database Reference:** `kqoqdxoicqxulefnruvn` (Singapore, AWS `ap-southeast-1`)  
**Audit Timestamp:** November 18, 2026, 21:30 IST  

---

## 1. EXECUTIVE SUMMARY

This audit delivers an exhaustive, read-only architectural and database schema inspection of the SEVOLF Digital codebase and live Supabase production database prior to implementing Phase 1C (Razorpay Checkout & Digital Fulfilment).

### Key Audit Findings
1. **Database Schema & Phase 1B Status:** **VERIFIED**. All 5 diagnostic checks inside `public.verify_phase_1b_schema()` returned `is_satisfied = true` on the live Supabase production project `kqoqdxoicqxulefnruvn`. Uniqueness constraints on payment transactions (`uq_payments_gateway_transaction`), download entitlements (`uq_entitlements_order_asset`), and webhook events (`uq_webhook_events_gateway_event`) are verified active in the catalog.
2. **Product-to-Asset Mapping Reality:** **VERIFIED**. The table `product_digital_assets` does **not** exist in the database. The real relational architecture uses a direct foreign key on `public.digital_assets.product_id REFERENCES public.products(id)`. Under this schema, **Home Reset Kit** maps directly to 2 digital assets (A4 PDF & US Letter PDF), and **Mitthu** maps directly to 1 digital asset (A4 PDF).
3. **Existing Application State:** **VERIFIED**. The Next.js 16.4.6 App Router application has functional client-side cart management and a stubbed checkout route (`/api/checkout`). However, it contains outdated radio buttons for Stripe, does not have the `razorpay` npm package installed, lacks signature verification routes, and currently displays hardcoded mock items in the Customer Library (`/account/library`).
4. **Resend / Email Infrastructure:** **VERIFIED**. The workspace currently has zero email packages installed and zero transactional email configuration.
5. **Launch Product Integrity:** **VERIFIED**. Both launch products (`14-day-home-reset-kit` and `mitthus-fun-learning-book`) remain strictly in `draft` status, and the `product_prices` table contains exactly 0 records.

---

## 2. AUDIT 1 — APPLICATION ARCHITECTURE

### 2.1 Next.js Framework & App Router
- **Framework Version:** Next.js `16.4.6` (with Turbopack), React `19.3.0`, TypeScript `^5`. [VERIFIED]
- **Route Topology:** 34 total routes generated, comprising 12 static pages (`○`) and 22 dynamic server routes (`ƒ`). [VERIFIED]

### 2.2 Component & Route Inventory

#### 1. Checkout Page
- **Path:** `src/app/checkout/page.tsx` [VERIFIED]
- **Current Responsibility:** Client-side checkout form collecting customer email, full name, and country. [VERIFIED]
- **Status:** **Needs Modification**. Contains legacy payment method radio buttons offering `razorpay` and `stripe`. Submits to `/api/checkout` and expects either a redirect URL or order ID. [VERIFIED]
- **Phase 1C Requirements:** Remove Stripe radio toggle completely. Integrate Razorpay standard checkout script (`checkout.js`). Open modal upon server order initialization and handle Razorpay response callback. [INFERRED]
- **Security Concerns:** Client currently supplies currency and payment method; must ensure client cannot influence payable price. [VERIFIED]

#### 2. Cart Context & Cart Drawer
- **Paths:** `src/context/CartContext.tsx`, `src/components/cart/CartDrawer.tsx` [VERIFIED]
- **Current Responsibility:** Stores cart line items in browser `localStorage` (`sevolf_digital_cart_v1`). Renders slide-out drawer with item counters. [VERIFIED]
- **Status:** **Partially Implemented**. Sanitizes cart on mount by filtering items where `status === 'published'` and `price > 0`. [VERIFIED]
- **Phase 1C Requirements:** Maintain local UI state, but ensure checkout always transmits raw product identifiers and quantities for server-authoritative price resolution. [INFERRED]
- **Security Concerns:** Local storage data is fundamentally untrusted. Server must never use cart subtotal from payload. [VERIFIED]

#### 3. Checkout API Route
- **Path:** `src/app/api/checkout/route.ts` [VERIFIED]
- **Current Responsibility:** Prototype checkout session initialization. [VERIFIED]
- **Status:** **Needs Modification**. Queries Supabase `products` and `product_prices`, but falls back to mock data if in development, checks for obsolete Stripe keys, and returns simulated order IDs (`ORD-XXXXXX`) when `RAZORPAY_KEY_ID` is empty. [VERIFIED]
- **Phase 1C Requirements:**
  - Remove all development mock fallbacks.
  - Remove Stripe handling.
  - Fetch published products and active INR prices from Supabase.
  - Compute integer minor units using `src/lib/financial.ts`.
  - Insert pending order record into `public.orders` and line items into `public.order_items`.
  - Create Razorpay order via official SDK (`orders.create`).
  - Insert initial payment record into `public.payments`.
  - Return `razorpayOrderId`, `keyId`, `amount`, `currency`, and `orderNumber` to frontend. [INFERRED]
- **Security Concerns:** Must prevent race conditions and ensure zero unapproved prices can be checked out. [VERIFIED]

#### 4. Payment Verification Route
- **Path:** `src/app/api/checkout/verify/route.ts` [VERIFIED]
- **Status:** **Missing**. [VERIFIED]
- **Phase 1C Requirements:** Implement fast-path signature verification:
  `HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET) === signature`. Updates `public.payments` to `captured`, updates `public.orders` to `paid`/`completed`, and generates entitlement tokens. [INFERRED]

#### 5. Webhook Ingestion Route
- **Path:** `src/app/api/webhooks/razorpay/route.ts` [VERIFIED]
- **Status:** **Missing**. [VERIFIED]
- **Phase 1C Requirements:**
  - Read raw request body via `request.text()`.
  - Validate `x-razorpay-signature` against `RAZORPAY_WEBHOOK_SECRET`.
  - Insert event into `public.payment_webhook_events` (deduplication via unique index).
  - Handle `payment.captured`, `payment.failed`, and `refund.processed`.
  - Reconcile payments, orders, and entitlements idempotently. [INFERRED]

#### 6. Order Success Page
- **Path:** `src/app/order/success/page.tsx` [VERIFIED]
- **Current Responsibility:** Displays static success message with query parameters. [VERIFIED]
- **Status:** **Needs Modification**. [VERIFIED]
- **Phase 1C Requirements:** Query order details and associated digital asset tokens securely. [INFERRED]

#### 7. Customer Library Page
- **Path:** `src/app/account/library/page.tsx` [VERIFIED]
- **Current Responsibility:** Digital product library showing purchased files. [VERIFIED]
- **Status:** **Needs Modification**. Currently renders hardcoded mock data referencing sample tokens (`token_sample_892144_01`). [VERIFIED]
- **Phase 1C Requirements:** Query `public.download_entitlements` joined with `public.digital_assets` for the authenticated customer (`user_id = auth.uid()` or matching email). Display real filenames, file formats, and download buttons. [INFERRED]

#### 8. Download API Route
- **Path:** `src/app/api/download/[token]/route.ts` [VERIFIED]
- **Current Responsibility:** Authenticates token, verifies status, checks download limits and expiration, creates 60-second Supabase Storage signed URL, records audit log in `public.download_logs`, and increments download counter. [VERIFIED]
- **Status:** **Partially Implemented**. [VERIFIED]
- **Phase 1C Requirements:** Remove mock sample token fallback (`token.startsWith("token_sample_")`). Ensure guest purchasers holding an authorized token can download without requiring a Supabase authenticated session cookie. [INFERRED]

#### 9. Supabase Clients
- **Paths:** `src/lib/supabase/client.ts` (browser), `server.ts` (SSR server client), `admin.ts` (privileged service-role client). [VERIFIED]
- **Status:** **Implemented**. Clean separation between public anon client and service-role admin client. [VERIFIED]

#### 10. Financial Calculation Engine
- **Path:** `src/lib/financial.ts` [VERIFIED]
- **Status:** **Implemented**. Production-ready module executing decimal-safe minor unit math, half-up rounding, and 6-decimal exchange rate scaling. [VERIFIED]

### 2.3 Environment Variable Names Inventory [VERIFIED]
Inspected from `.env.local` (variable names only; values protected):
- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_STORE_NAME`
- `NEXT_PUBLIC_SUPPORT_EMAIL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RAZORPAY_KEY_ID` (Currently Empty)
- `RAZORPAY_KEY_SECRET` (Currently Empty)
- `RAZORPAY_WEBHOOK_SECRET` (Currently Empty)
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Obsolete / Empty)
- `STRIPE_SECRET_KEY` (Obsolete / Empty)
- `STRIPE_WEBHOOK_SECRET` (Obsolete / Empty)
- `PRIVATE_ASSET_BUCKET`

---

## 3. AUDIT 2 — DATABASE SCHEMA VERIFICATION

Every required table was inspected against live Supabase project `kqoqdxoicqxulefnruvn`:

| Table Name | Exists | Primary Key | Foreign Keys / Relationships | Constraints & Unique Indexes | RLS Enabled | Phase 1C Support |
| :--- | :---: | :--- | :--- | :--- | :---: | :---: |
| `products` | **YES** [VERIFIED] | `id UUID` | `category_id -> product_categories.id` | `slug UNIQUE`, `CHECK (status IN ('draft', 'published', 'archived'))` | **YES** [VERIFIED] | **READY** |
| `product_prices` | **YES** [VERIFIED] | `id UUID` | `product_id -> products.id ON DELETE CASCADE` | `UNIQUE(product_id, currency)`, `CHECK (amount >= 0)` | **YES** [VERIFIED] | **READY** |
| `product_media` | **YES** [VERIFIED] | `id UUID` | `product_id -> products.id ON DELETE CASCADE` | None | **YES** [VERIFIED] | **READY** |
| `digital_assets` | **YES** [VERIFIED] | `id UUID` | `product_id -> products.id ON DELETE CASCADE` | None | **YES** [VERIFIED] | **READY** |
| `product_digital_assets`| **NO** [VERIFIED] | N/A | N/A (Does not exist) | N/A | N/A | **N/A** (Direct FK used) |
| `orders` | **YES** [VERIFIED] | `id UUID` | `user_id -> profiles.id ON DELETE SET NULL` | `order_number UNIQUE`, `CHECK (status IN (...))`, `CHECK (payment_status IN (...))` | **YES** [VERIFIED] | **READY** |
| `order_items` | **YES** [VERIFIED] | `id UUID` | `order_id -> orders.id ON DELETE CASCADE`, `product_id -> products.id` | `CHECK (quantity > 0)`, `CHECK (unit_price >= 0)` | **YES** [VERIFIED] | **READY** |
| `payments` | **YES** [VERIFIED] | `id UUID` | `order_id -> orders.id ON DELETE CASCADE` | `uq_payments_gateway_transaction` (partial unique), `CHECK (status IN (...))` | **YES** [VERIFIED] | **READY** |
| `payment_webhook_events`| **YES** [VERIFIED] | `id UUID` | None | `uq_webhook_events_gateway_event UNIQUE(gateway, event_id)`, `CHECK (gateway = 'razorpay')` | **YES** [VERIFIED] | **READY** |
| `currency_exchange_rates`| **YES** [VERIFIED] | `id UUID` | None | `CHECK (exchange_rate > 0)`, `idx_currency_exchange_rates_lookup` | **YES** [VERIFIED] | **READY** |
| `download_entitlements` | **YES** [VERIFIED] | `id UUID` | `order_id -> orders.id`, `digital_asset_id -> digital_assets.id`, `user_id -> profiles.id` | `token UNIQUE`, `uq_entitlements_order_asset UNIQUE(order_id, digital_asset_id)` | **YES** [VERIFIED] | **READY** |
| `download_logs` | **YES** [VERIFIED] | `id UUID` | `entitlement_id -> download_entitlements.id ON DELETE CASCADE` | None | **YES** [VERIFIED] | **READY** |
| `profiles` | **YES** [VERIFIED] | `id UUID` | `id -> auth.users.id ON DELETE CASCADE`, `role_id -> roles.id` | `email UNIQUE` | **YES** [VERIFIED] | **READY** |
| `audit_logs` | **YES** [VERIFIED] | `id UUID` | `actor_id -> profiles.id ON DELETE SET NULL` | None | **YES** [VERIFIED] | **READY** |

### Product-to-Asset Relationship Discovery [VERIFIED]
The table `product_digital_assets` does **NOT** exist in the schema cache or migrations. Instead, `public.digital_assets` contains a direct foreign key column `product_id UUID REFERENCES public.products(id) ON DELETE CASCADE`.
- This represents a clean 1-to-many relationship: One product owns multiple digital asset files.
- Live inspection of `public.digital_assets` confirms:
  - Product `284fc059-3be0-44a2-969f-899ea23ead2a` (Home Reset Kit) owns 2 assets: `Home-Reset-Kit-A4.pdf` and `Home-Reset-Kit-US-Letter.pdf`. [VERIFIED]
  - Product `4959d0a1-2512-4a96-9cb9-bb78b37fa0da` (Mitthu's Book) owns 1 asset: `Fun-Learning-Book.pdf`. [VERIFIED]

---

## 4. AUDIT 3 — PAYMENT & ORDER STATE MACHINE

### 4.1 Permitted Schema Values [VERIFIED]

#### `orders.status`
Enforced by PostgreSQL check constraint:
```sql
CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled'))
```

#### `orders.payment_status`
Enforced by PostgreSQL check constraint:
```sql
CHECK (payment_status IN ('unpaid', 'authorized', 'captured', 'failed', 'refunded'))
```

#### `payments.status`
Enforced by PostgreSQL check constraint:
```sql
CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded'))
```

#### `payments.gateway`
Enforced by PostgreSQL check constraint:
```sql
CHECK (gateway IN ('razorpay', 'stripe'))
```
*(Note: Razorpay-only decision will utilize `gateway = 'razorpay'`; Stripe value is permitted by DDL but unused).*

#### `payment_webhook_events.status`
Enforced by PostgreSQL check constraint:
```sql
CHECK (status IN ('received', 'processing', 'processed', 'ignored', 'failed'))
```

#### `payment_webhook_events.gateway`
Strictly enforced by Phase 1B check constraint:
```sql
CHECK (gateway = 'razorpay')
```

### 4.2 State Machine Analysis & Mismatch Detection
1. **`authorized` vs. `captured`**:
   - The schema explicitly supports both states.
   - Razorpay standard checkout for digital goods in India executes **auto-capture** on payment success. Therefore, payments transition directly from `created` to `captured`.
   - If manual capture is ever configured, the payment enters `authorized` until captured via Razorpay API.
2. **Duplicate Payment Prevention**:
   - `uq_payments_gateway_transaction` on `payments(gateway, gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL` guarantees that no two rows can have the same non-null Razorpay payment ID (`pay_xxx`). Duplicate capture insertion throws error `23505`. [VERIFIED]
3. **Refund Representation**:
   - `orders.status = 'refunded'`, `orders.payment_status = 'refunded'`, `payments.status = 'refunded'`.
   - **Partial Refunds**: The schema supports partial refunds at the payment/order level by inserting an additional negative transaction in `payments` or logging a refund event, while keeping the base order intact.
4. **Atomic Processing**:
   - In Next.js server actions / API routes, multiple Supabase REST calls are executed in sequence. To achieve strict database atomicity across order status update + payment update + entitlement generation, a dedicated Supabase stored procedure (RPC) `process_order_capture` is recommended for Phase 1C. [INFERRED]

---

## 5. AUDIT 4 — PHASE 1B VERIFICATION MATRIX

Direct inspection of project `kqoqdxoicqxulefnruvn` via `public.verify_phase_1b_schema()`:

| Component | Target Object | Verification Criterion | Status |
| :--- | :--- | :--- | :---: |
| **1. Payment Uniqueness** | `uq_payments_gateway_transaction` | Partial unique index on `(gateway, gateway_transaction_id)` with `IS NOT NULL` predicate | **VERIFIED** [VERIFIED] |
| **2. Entitlement Uniqueness** | `uq_entitlements_order_asset` | Unique index on `download_entitlements(order_id, digital_asset_id)` | **VERIFIED** [VERIFIED] |
| **3. Exchange Rates Table** | `public.currency_exchange_rates` | Exists with RLS enabled | **VERIFIED** [VERIFIED] |
| **4. Order Snapshots** | `public.orders` columns | All 7 columns exist (`base_currency`, `base_amount`, `charged_currency`, `charged_amount`, `exchange_rate_used`, `exchange_rate_source`, `exchange_rate_timestamp`) | **VERIFIED** [VERIFIED] |
| **5. Webhook Events Table** | `public.payment_webhook_events` | Exists with RLS enabled, `gateway = 'razorpay'` check, and unique index on `(gateway, event_id)` | **VERIFIED** [VERIFIED] |
| **6. Security Definer Guard** | `verify_phase_1b_schema()` | Non-admin execution blocked; `anon` execution denied with permission error | **VERIFIED** [VERIFIED] |
| **7. RLS Policy Enforcement** | `currency_exchange_rates` | Public `SELECT` allowed; `INSERT`/`UPDATE` blocked | **VERIFIED** [VERIFIED] |
| **8. RLS Policy Enforcement** | `payment_webhook_events` | Public access zero; anon `SELECT` returns empty array | **VERIFIED** [VERIFIED] |

**Phase 1B Production Score: 8 / 8 VERIFIED.**

---

## 6. AUDIT 5 — FIVE-POINT SECURITY REVIEW

### A. Payment Verification
- **Current State:** The application currently has **no server-side Razorpay verification logic**.
- **Missing Infrastructure:**
  - `razorpay` npm package is not installed.
  - No HMAC-SHA256 signature verification endpoint (`/api/checkout/verify`).
  - No server-side call to `razorpay.payments.fetch(paymentId)` to verify actual captured status, amount in minor units, and currency.
- **Remediation Plan:** Install `razorpay` package and implement strict signature comparison using `crypto.timingSafeEqual`. [INFERRED]

### B. Atomic Webhook Processing
- **Current State:** No webhook route exists.
- **Capabilities:**
  - Raw body signature verification can be achieved in Next.js App Router using `await request.text()`.
  - Duplicate events are prevented by unique index `uq_webhook_events_gateway_event`.
  - To prevent race conditions between client verify and webhook delivery, both channels must call a unified, idempotent fulfillment routine that checks `orders.payment_status === 'captured'` before generating entitlements. [INFERRED]

### C. Guest Checkout Security
- **Current State:** The application accepts guest email in the checkout form, but lacks an unguessable access credential for subsequent order retrieval.
- **Vulnerabilities Identified:**
  - If access is granted based only on `email`, any user knowing a customer's email could view their purchase receipt.
  - The sample download route allowed arbitrary tokens starting with `token_sample_`.
- **Recommended Secure Design:**
  1. Generate an unguessable 256-bit cryptographically secure **Order Access Secret** at checkout.
  2. Return the secret to the browser in memory and via secure cookie or URL token.
  3. Digital asset download tokens are unguessable 64-character hex strings (`crypto.randomBytes(32)`).
  4. Automatic account linking: Upon authenticated registration/login, trigger an idempotent update linking orders and entitlements where `customer_email === auth.jwt().email AND user_id IS NULL`. [INFERRED]

### D. Refund Correctness
- **Current State:** `orders.status = 'refunded'` and `payments.status = 'refunded'` exist in the database.
- **Entitlement Revocation:**
  - Full refund: Revoke all entitlements for that order by setting `is_active = false`.
  - Partial refund: If an order contains multiple products and only one is refunded, the system must identify the refunded `order_item` and revoke only the corresponding asset's entitlement. [INFERRED]

### E. Product-to-Asset Fulfilment
- **Current State:** Verified that `public.digital_assets.product_id` directly maps to `public.products.id`.
- **Mapping Verification:**
  - `14-day-home-reset-kit`: 2 files (`Home-Reset-Kit-A4.pdf`, `Home-Reset-Kit-US-Letter.pdf`). [VERIFIED]
  - `mitthus-fun-learning-book`: 1 file (`Fun-Learning-Book.pdf`). [VERIFIED]
- **Storage Protection:** All files reside in private bucket `digital-products` (`public = false`). Direct HTTP access is blocked; signed URLs expire after 60 seconds. [VERIFIED]

---

## 7. AUDIT 6 — RESEND / EMAIL READINESS

- **Resend SDK Installed:** **NO** (`resend` is absent from `package.json`). [VERIFIED]
- **Email Service Abstraction:** **NO** (Zero email dispatch files exist in `src/lib` or `src/services`). [VERIFIED]
- **Server Email Configuration:** **NO** (No `RESEND_API_KEY` in `.env.local`). [VERIFIED]
- **Sender Domain Verification:** **UNKNOWN / NOT CONFIGURED** (Requires DNS verification on sender domain e.g. `sevolf.store`). [INFERRED]
- **Email Templates:** **NO** (No React Email or HTML templates exist). [VERIFIED]
- **Readiness Verdict:** Transactional email is **completely uninitialized**.
- **Impact on Phase 1C:** Payment processing, database recording, entitlement generation, and web-based customer library downloads **can proceed 100% independently of email integration**. Email delivery can be integrated as an asynchronous notification enhancement without blocking the core payment engine. [INFERRED]

---

## 8. AUDIT 7 — DEDICATED SANDBOX PRODUCT DESIGN

To test the end-to-end checkout flow safely without altering the two live launch products:

### 8.1 Sandbox Product Specification (Design Only)
- **Title:** `SEVOLF Architecture Test Asset`
- **Slug:** `sevolf-architecture-test-asset`
- **Product Type:** `Digital Guide (Sandbox Test)`
- **Price:** ₹1.00 (`100` paise) / $0.05 (`5` cents)
- **Asset Attached:** Lightweight mock test PDF in storage vault.

### 8.2 Isolation Controls
1. **Catalogue Concealment:** Set `status = 'draft'`. In production, draft products are excluded from `/shop`, collections, search, and new arrivals.
2. **Restricted Checkout Access:** Create a dedicated test route `/shop/sandbox-test` protected by `process.env.NODE_ENV === 'development'` or an admin-only header.
3. **Gateway Protection:** Force `RAZORPAY_KEY_ID` to use test keys (`rzp_test_...`). Razorpay test mode ensures zero real financial transactions occur.
4. **Data Isolation & Cleanup:** Test orders use prefix `ORD-TEST-XXXX`. A cleanup script can wipe test records from `orders`, `order_items`, `payments`, and `download_entitlements` where `order_number LIKE 'ORD-TEST-%'`.

---

## 9. AUDIT 8 — IMPLEMENTATION READINESS & DEPENDENCY MAP

```
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Schema Validation (VERIFIED - Ready)                                │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 2. Razorpay SDK Integration (npm install razorpay)                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 3. Server-side Order Creation API (/api/checkout)                      │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 4. Checkout UI Modal (/checkout page)                                  │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
┌──────────────────────────────────┐ ┌──────────────────────────────────┐
│ 5. Client Payment Verify API     │ │ 6. Webhook Processing API        │
│    (/api/checkout/verify)        │ │    (/api/webhooks/razorpay)      │
└─────────────────┬────────────────┘ └──────────────────┬───────────────┘
                  │                                     │
                  └────────────────┬────────────────────┘
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 7. Idempotent Entitlement Engine (Generate Tokens)                     │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                  ┌────────────────┴────────────────┐
                  ▼                                 ▼
┌──────────────────────────────────┐ ┌──────────────────────────────────┐
│ 8. Secure Asset Downloads        │ │ 9. Customer Library UI           │
│    (/api/download/[token])       │ │    (/account/library)            │
└─────────────────┬────────────────┘ └──────────────────┬───────────────┘
                  │                                     │
                  └────────────────┬────────────────────┘
                                   │
           (Optional Async Branch) │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 10. Resend Email Notifications (Post-purchase confirmation)           │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│ 11. 20-Point Sandbox Security Validation Gate                          │
└────────────────────────────────────────────────────────────────────────┘
```

### Readiness Classification Table

| Component | Status | Dependencies / Blockers | Can Proceed Without Email? |
| :--- | :---: | :--- | :---: |
| **1. Schema Validation** | **READY** | Phase 1B deployed and verified in live DB | YES |
| **2. Razorpay SDK Integration** | **REQUIRES INSTALL** | Needs `npm i razorpay` + `@types/razorpay` | YES |
| **3. Server Order Creation** | **READY TO IMPLEMENT** | Depends on step 2 | YES |
| **4. Checkout UI** | **READY TO IMPLEMENT** | Depends on step 3 | YES |
| **5. Payment Verify API** | **READY TO IMPLEMENT** | Depends on step 2, 3 | YES |
| **6. Webhook Ingestion** | **READY TO IMPLEMENT** | Depends on `RAZORPAY_WEBHOOK_SECRET` | YES |
| **7. Entitlement Engine** | **READY TO IMPLEMENT** | Depends on step 5, 6 | YES |
| **8. Secure Downloads** | **READY TO IMPLEMENT** | Uses existing `/api/download/[token]` | YES |
| **9. Customer Library** | **READY TO IMPLEMENT** | Connects to `download_entitlements` | YES |
| **10. Resend Email** | **BLOCKED** | Needs `resend` package + API key + DNS | N/A |
| **11. Sandbox Validation** | **READY FOR PLANNING** | Depends on steps 1–9 | YES |

---

## 10. BLOCKING ISSUES & REMEDIATION PLAN

1. **Missing Razorpay SDK:**
   - *Blocker:* `razorpay` package is not in `package.json`.
   - *Remediation:* Install `razorpay` in Phase 1C implementation.
2. **Empty Razorpay Credentials in `.env.local`:**
   - *Blocker:* `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` are currently empty.
   - *Remediation:* User must provide Razorpay Test Mode credentials (`rzp_test_...`) to test payment flows.
3. **Resend / Email Integration:**
   - *Blocker:* No email provider credentials configured.
   - *Remediation:* Decouple email dispatch from core payment confirmation. Core checkout and entitlement access work via UI immediately; email will be added as an asynchronous listener.

---

## 11. RECOMMENDED IMPLEMENTATION SEQUENCE

1. **Phase 1C.2:** Install `razorpay` and create `src/lib/razorpay.ts` gateway abstraction.
2. **Phase 1C.3:** Rewrite `/api/checkout` with server-side price queries and Razorpay order creation.
3. **Phase 1C.4:** Update `src/app/checkout/page.tsx` with Razorpay modal and implement `/api/checkout/verify`.
4. **Phase 1C.5:** Implement `/api/webhooks/razorpay` with raw-body HMAC verification and deduplication.
5. **Phase 1C.6:** Connect `/account/library` and `/order/success` to live database entitlements.
6. **Phase 1C.7:** Execute the 20-point sandbox test suite in Razorpay Test Mode.

---

## 12. EXPLICIT LIST OF PROPOSED FUTURE CODE CHANGES

*No changes have been made during this audit. The following files will be created or modified in future implementation phases:*

### Files to Create:
1. `src/lib/razorpay.ts` (Razorpay client and signature verification utility).
2. `src/app/api/checkout/verify/route.ts` (Synchronous payment signature verification endpoint).
3. `src/app/api/webhooks/razorpay/route.ts` (Authoritative webhook listener).
4. `src/services/checkout/orderService.ts` (Order creation and calculation logic).
5. `src/services/checkout/entitlementService.ts` (Token generation and entitlement lifecycle).

### Files to Modify:
1. `src/app/checkout/page.tsx` (Remove Stripe, embed Razorpay SDK modal).
2. `src/app/api/checkout/route.ts` (Remove mock fallback, implement real Razorpay order creation).
3. `src/app/api/download/[token]/route.ts` (Remove mock token fallback, support guest entitlement downloads).
4. `src/app/account/library/page.tsx` (Replace hardcoded sample products with live Supabase entitlements query).
5. `src/app/order/success/page.tsx` (Query live order and entitlements for immediate customer access).
6. `package.json` (Add `razorpay` dependency).

---

## 13. FINAL VALIDATION CONFIRMATION

In strict accordance with the read-only directive:
- **Zero source files were modified, moved, or deleted.** [VERIFIED]
- **Zero npm packages were installed or uninstalled.** [VERIFIED]
- **Zero database writes, updates, deletes, or migrations were executed.** [VERIFIED]
- **Zero Supabase Storage objects were added, deleted, or altered.** [VERIFIED]
- **Zero payments or emails were initiated.** [VERIFIED]
- **Both launch products remain in `draft` status:**
  - `14-day-home-reset-kit`: `draft` [VERIFIED]
  - `mitthus-fun-learning-book`: `draft` [VERIFIED]
- **Product prices count remains exactly 0.** [VERIFIED]

**AUDIT COMPLETE — STOPPED AND AWAITING EXPLICIT USER APPROVAL FOR PHASE 1C IMPLEMENTATION.**
