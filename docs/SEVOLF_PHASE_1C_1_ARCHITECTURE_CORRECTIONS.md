# SEVOLF DIGITAL — PHASE 1C.1
# ARCHITECTURE CORRECTION ADDENDUM

**Document Title:** `SEVOLF_PHASE_1C_1_ARCHITECTURE_CORRECTIONS.md`  
**Workspace:** `E:\Projects\Sevolf Digital`  
**Reference Document:** `docs/SEVOLF_PHASE_1C_1_READ_ONLY_AUDIT.md`  
**Database Reference:** `kqoqdxoicqxulefnruvn` (Singapore, AWS `ap-southeast-1`)  
**Timestamp:** November 18, 2026, 22:00 IST  
**Execution Context:** Strictly Read-Only Architecture Design (Zero Writes, Zero Migrations, Zero Package Changes)

---

## 1. EXECUTIVE SUMMARY & ADDENDUM PURPOSE

The baseline Phase 1C.1 audit established that the deployed Phase 1B database schema is healthy, structurally sound, and 100% verified against live Supabase project `kqoqdxoicqxulefnruvn`. 

This **Architecture Correction Addendum** resolves five critical implementation challenges that were identified during the initial review:
1. **Guest Checkout Security**: Replacing unauthenticated email lookups and reusable query-string tokens with cryptographically secure, SHA-256 hashed 256-bit guest access tokens, session-bound cookies, and verified-email account linking.
2. **Refund Representation & Schema Realism**: Accommodating the strict constraint `CHECK (amount >= 0)` in `public.payments` without attempting invalid negative row insertions, while properly modeling Razorpay refund IDs, partial refunds, and selective entitlement revocations.
3. **Dedicated Sandbox Isolation**: Preserving the launch products (`14-day-home-reset-kit` and `mitthus-fun-learning-book`) in `draft` with zero prices, while structuring an isolated, server-gated sandbox test harness that prevents test checkouts from leaking into customer views or generating unearned entitlements.
4. **Test Data Cleanup & Dependency Graph**: Establishing a formal, non-destructive dry-run cleanup specification accounting for all cascading foreign keys (`order_items`, `payments`, `download_entitlements`, `download_logs`, `payment_webhook_events`).
5. **Atomic Fulfilment Engine**: Designing a unified, idempotent PostgreSQL stored procedure (`process_order_capture`) shared by both client-side checkout verification and server-to-server webhook ingestion, eliminating race conditions and partial failures.

---

## 2. ITEM 1 — GUEST CHECKOUT SECURITY ARCHITECTURE

### 2.1 Original Audit Finding
In the initial application audit, guest checkout was identified as vulnerable:
- The existing `/app/checkout/page.tsx` accepted unauthenticated customer `email` and `fullName`.
- The prototype download endpoint `/api/download/[token]/route.ts` permitted arbitrary tokens starting with `token_sample_` and checked `customer_email` directly against session cookies.
- No cryptographic mechanism existed to allow a guest purchaser to prove legitimate order ownership immediately post-checkout without exposing raw credentials in browser history, logs, or URL query strings.

### 2.2 Identified Weaknesses
1. **Email Spoofing Risk**: If an order status or receipt page (`/order/success?orderNumber=ORD-123&email=victim@example.com`) relies solely on unauthenticated email matching, an attacker who guesses an order number and email can view private purchase receipts and digital download links.
2. **Referer & Browser History Leakage**: Passing raw download tokens or access keys directly in GET query parameters leaks access credentials into browser history, ISP logs, and HTTP `Referer` headers when clicking external links.
3. **Unverified Account Hijacking**: Linking historical guest orders to a newly created account based simply on an unverified string match allows an attacker to register a victim's email and instantly hijack all unlinked digital purchases before the victim claims them.

### 2.3 Corrected Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SECURE GUEST CHECKOUT LIFECYCLE                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [1. Checkout Submission]
      Customer (Guest) submits email & items to /api/checkout.
      Server generates:
        - rawGuestAccessToken = crypto.randomBytes(32).toString('hex') (256-bit entropy)
        - guestAccessTokenHash = SHA-256(rawGuestAccessToken)
      Server writes guestAccessTokenHash into orders.metadata->>'guest_access_token_hash'.

 [2. Post-Payment Secure Session]
      Upon payment capture verification, server issues an HttpOnly, Secure, SameSite=Lax cookie:
        Set-Cookie: sevolf_guest_session=<rawGuestAccessToken>; Path=/; HttpOnly; Secure; Max-Age=86400
      Browser redirects to /order/success?orderNumber=ORD-XXXX (NO secret in query string).

 [3. Order & Receipt Retrieval]
      /order/success reads cookie sevolf_guest_session.
      Server hashes cookie value with SHA-256 and queries:
        SELECT * FROM orders 
        WHERE order_number = $1 
          AND metadata->>'guest_access_token_hash' = $2;
      If match: Access granted. If mismatch/missing: 403 Forbidden.

 [4. Account Linking Protocol (Verified Email Only)]
      When customer registers with Supabase Auth:
        - Trigger checks auth.users.email_confirmed_at IS NOT NULL.
        - Linking ONLY occurs if email is verified.
        - Sets orders.user_id = auth.uid() and download_entitlements.user_id = auth.uid().
        - Clears guest_access_token_hash from metadata.
```

### 2.4 Existing Schema Compatibility [VERIFIED]
- **Zero Schema Change Required:** `public.orders` already includes a `metadata JSONB` column.
- The hashed token is stored cleanly as:
  `orders.metadata = jsonb_build_object('guest_token_hash', '<sha256_hex>')`.
- Download tokens in `public.download_entitlements.token` remain independent 256-bit unguessable tokens (`VARCHAR(255) UNIQUE`).

### 2.5 Security Considerations
- **Brute Force Infeasibility:** 256 bits of cryptographically random entropy makes collision or guessing mathematically impossible ($2^{256}$ search space).
- **Zero Token Leakage in Database Breach:** Even if read access to `orders` is compromised, the attacker only obtains the SHA-256 hash, not the raw token required to authenticate.
- **Strict Revocation:** Setting `metadata->>'guest_token_hash' = NULL` immediately revokes all guest session access (e.g. upon account linking or suspected compromise).

---

## 3. ITEM 2 — REFUND ARCHITECTURE & SCHEMA REALISM

### 3.1 Original Audit Finding
The initial audit noted that refunds were represented by `orders.status = 'refunded'` and `payments.status = 'refunded'`, and suggested recording negative payment rows.

### 3.2 Identified Weaknesses
1. **Schema Check Violation:** Direct inspection of `public.payments` DDL reveals:
   ```sql
   amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0)
   ```
   Attempting to insert a negative amount (e.g. `-1299.00`) fails instantly with PostgreSQL check constraint violation `payments_amount_check`.
2. **Partial Refund Ambiguity:** `orders.status` is a single string column. If an order of ₹2,297 (2 items) receives a partial refund of ₹499 for 1 item, setting `orders.status = 'refunded'` falsely implies the entire order was cancelled, while leaving it as `paid` hides the refund.
3. **Entitlement Granularity:** If an order includes both the *Home Reset Kit* and *Mitthu's Fun Learning Book*, a refund for Mitthu must revoke only Mitthu's download entitlement, leaving the Home Reset Kit active.

### 3.3 Corrected Refund Architecture

#### A. Payment Refund Ledger Design
Because `payments.amount` must be $\ge 0$, and `payments.status` permits `'refunded'`, refunds are modeled using **Payment Metadata & Webhook Audit Records**:
1. **Full Refund**:
   - Update `public.payments`:
     - `status = 'refunded'`
     - `raw_response = raw_response || jsonb_build_object('refund_id', rzp_refund_id, 'refund_amount', amount, 'refunded_at', NOW())`
   - Update `public.orders`:
     - `status = 'refunded'`
     - `payment_status = 'refunded'`
   - Update `public.download_entitlements`:
     - Set `is_active = false` for all rows where `order_id = target_order_id`.
2. **Partial Refund**:
   - `public.payments` record retains `amount = original_amount` (positive), with refund transaction details recorded in `raw_response->'refunds'`:
     ```json
     {
       "refunds": [
         {
           "refund_id": "rfnd_Pxyz123456",
           "amount": 499.00,
           "currency": "INR",
           "item_id": "4959d0a1-2512-4a96-9cb9-bb78b37fa0da",
           "created_at": "2026-11-18T22:00:00Z"
         }
       ]
     }
     ```
   - Update `public.orders`:
     - `status = 'processing'` (or custom metadata `'partially_refunded'`)
     - `metadata = metadata || jsonb_build_object('refunded_amount', 499.00)`
   - Selective Entitlement Revocation:
     - The webhook receives `notes.product_id` or line item reference from Razorpay Refund.
     - Revokes strictly the entitlement linked to the refunded product:
       ```sql
       UPDATE public.download_entitlements e
       SET is_active = false
       FROM public.digital_assets a
       WHERE e.digital_asset_id = a.id
         AND e.order_id = target_order_id
         AND a.product_id = refunded_product_id;
       ```

### 3.4 Existing Schema Compatibility [VERIFIED]
- **Zero Schema Change Required for Phase 1C:** Fully supported via `payments.status`, `payments.raw_response`, and `orders.metadata`.
- *Optional Future Schema Enhancement (Phase 2):* If detailed financial reporting is required later, a dedicated `public.payment_refunds` table can be introduced via migration. For Phase 1C, the JSONB ledger approach requires zero DDL.

---

## 4. ITEM 3 — DEDICATED SANDBOX ISOLATION

### 4.1 Original Audit Finding
The launch products (`14-day-home-reset-kit` and `mitthus-fun-learning-book`) must remain strictly in `draft` with zero approved price records. Testing checkout required defining an isolated test product.

### 4.2 Identified Weaknesses
1. If a test product is inserted with `status = 'published'`, it immediately appears on `/shop`, collection pages, and search results.
2. If test mode checkouts use standard public routes without environment checks, real customers could stumble upon test products or test gateways.
3. If test checkouts create rows in production tables without distinct markers, test metrics contaminate production revenue and order reporting.

### 4.3 Corrected Sandbox Isolation Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SANDBOX ISOLATION ARCHITECTURE                                  │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [1. Launch Products Preservation]
      - 14-day-home-reset-kit       -> status: 'draft', prices count: 0 [STRICT IMMUTABILITY]
      - mitthus-fun-learning-book   -> status: 'draft', prices count: 0 [STRICT IMMUTABILITY]

 [2. Dedicated Sandbox Product (In Database)]
      - Title: "SEVOLF Architecture Test Asset"
      - Slug: "sevolf-test-asset-sandbox"
      - Status: 'draft' (NEVER published; completely invisible to public storefront queries)
      - Category: 'digital-tools'
      - Test Price: INR 1.00 (100 paise) / USD 0.05 (5 cents)

 [3. Isolated Test Checkout Route]
      - Public Storefront (/api/checkout):
          * Validates: WHERE status = 'published'
          * Test product is REJECTED by standard public storefront.
      - Gated Sandbox Route (/api/checkout/sandbox-test):
          * Condition: ONLY active if process.env.NODE_ENV !== 'production' 
                       OR request contains x-sevolf-sandbox-secret header.
          * Explicitly loads product slug 'sevolf-test-asset-sandbox'.
          * Asserts process.env.RAZORPAY_KEY_ID starts with 'rzp_test_'.
          * Order number format: ORD-SANDBOX-YYYYMMDD-XXXX.

 [4. Entitlement Isolation]
      - Test product links to a dummy test file in digital_assets:
        storage_path: 'test/sandbox-sample.pdf'.
      - Entitlements generated for sandbox orders grant access ONLY to the test asset.
```

### 4.4 Existing Schema Compatibility [VERIFIED]
- **Compatible with Existing RLS:** Public RLS policy `Public can view published products` (`USING (status = 'published')`) natively blocks public discovery of the test product.
- Service-role admin client can query the draft test product inside the sandbox route without exposing it to customers.

---

## 5. ITEM 4 — TEST DATA CLEANUP SPECIFICATION (DRY-RUN REPORT)

### 5.1 Test Data Identifiers
To guarantee 100% precision when purging test records without risk to real orders:
- **Order Numbers**: Strictly prefixed with `ORD-SANDBOX-`.
- **Payment Gateway Order IDs**: Strictly prefixed with `order_test_` or matched by `gateway_order_id IN (SELECT gateway_order_id FROM payments WHERE order_id IN (...))`.
- **Webhook Events**: Webhook test payload `raw_payload->'payload'->'payment'->'entity'->>'notes'` contains `"environment": "sandbox"`.

### 5.2 Foreign-Key Dependency Graph [VERIFIED]
Direct inspection of database constraints establishes the cascading deletion hierarchy:

```
public.orders (Parent)
    │
    ├── ON DELETE CASCADE ──> public.order_items
    │
    ├── ON DELETE CASCADE ──> public.payments
    │
    └── ON DELETE CASCADE ──> public.download_entitlements
                                  │
                                  └── ON DELETE CASCADE ──> public.download_logs
```

*Note on `public.payment_webhook_events`:* This table has **NO foreign key** to `orders` (it is an independent audit ledger). Webhook events must be purged by matching `event_id` or receipt notes.

### 5.3 Dry-Run Cleanup Protocol (Design Only — Zero Execution)

```sql
-- DRY RUN 1: Preview affected rows before deletion
SELECT 'orders' AS table_name, count(*) FROM public.orders WHERE order_number LIKE 'ORD-SANDBOX-%'
UNION ALL
SELECT 'order_items', count(*) FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE order_number LIKE 'ORD-SANDBOX-%')
UNION ALL
SELECT 'payments', count(*) FROM public.payments WHERE order_id IN (SELECT id FROM public.orders WHERE order_number LIKE 'ORD-SANDBOX-%')
UNION ALL
SELECT 'download_entitlements', count(*) FROM public.download_entitlements WHERE order_id IN (SELECT id FROM public.orders WHERE order_number LIKE 'ORD-SANDBOX-%')
UNION ALL
SELECT 'download_logs', count(*) FROM public.download_logs WHERE entitlement_id IN (
    SELECT id FROM public.download_entitlements WHERE order_id IN (SELECT id FROM public.orders WHERE order_number LIKE 'ORD-SANDBOX-%')
);

-- DRY RUN 2: Preview affected webhook events
SELECT 'payment_webhook_events' AS table_name, count(*) 
FROM public.payment_webhook_events 
WHERE raw_payload::text LIKE '%ORD-SANDBOX-%';
```

When cleanup is authorized in a future phase, executing:
```sql
DELETE FROM public.orders WHERE order_number LIKE 'ORD-SANDBOX-%';
```
will automatically and cleanly cascade-delete all child records in `order_items`, `payments`, `download_entitlements`, and `download_logs` in a single atomic transaction without orphan rows.

---

## 6. ITEM 5 — ATOMIC FULFILMENT & RECONCILIATION ENGINE

### 6.1 Original Audit Finding
The initial audit identified that `/api/checkout/verify` (browser fast-path) and `/api/webhooks/razorpay` (server authoritative path) could both attempt to update payment status and generate entitlements simultaneously, creating a potential race condition.

### 6.2 Identified Weaknesses
1. **Network Race Condition**: If the customer browser triggers verify at the exact millisecond Razorpay's webhook arrives, parallel execution could cause duplicate entitlement generation or deadlocks.
2. **Double Capture Overwrite**: If a delayed failure or timeout webhook arrives after a capture, naive application logic could overwrite `orders.status = 'paid'` back to `'failed'`.
3. **Partial Failure Vulnerability**: If the server marks `payments.status = 'captured'` but crashes before inserting `download_entitlements`, the customer is charged without receiving their digital products.

### 6.3 Corrected Atomic Fulfilment Architecture

To ensure 100% database consistency, fulfillment is consolidated into a **single idempotent PostgreSQL stored procedure (`SECURITY DEFINER`)**:

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
    message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_order RECORD;
    v_item RECORD;
    v_asset RECORD;
    v_token TEXT;
BEGIN
    -- 1. Lock the order row for update to serialize concurrent verify/webhook execution
    SELECT * INTO v_order 
    FROM public.orders 
    WHERE id = p_order_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT false, false, 'Order not found'::TEXT;
        RETURN;
    END IF;

    -- 2. Idempotency Check: If order is already completed and paid, return clean success immediately
    IF v_order.status = 'paid' OR v_order.payment_status = 'captured' THEN
        RETURN QUERY SELECT true, true, 'Order already captured and fulfilled'::TEXT;
        RETURN;
    END IF;

    -- 3. Strict Monetary Verification: Validate captured amount and currency against frozen order snapshot
    IF v_order.charged_amount != p_charged_amount OR v_order.charged_currency != p_charged_currency THEN
        RETURN QUERY SELECT false, false, 'Monetary mismatch: charged amount/currency does not match order snapshot'::TEXT;
        RETURN;
    END IF;

    -- 4. Update or Insert Payment Record
    UPDATE public.payments
    SET gateway_transaction_id = p_gateway_transaction_id,
        status = 'captured',
        raw_response = p_raw_payload
    WHERE order_id = p_order_id AND gateway_order_id = p_gateway_order_id;

    -- 5. Update Order Status
    UPDATE public.orders
    SET status = 'paid',
        payment_status = 'captured',
        updated_at = NOW()
    WHERE id = p_order_id;

    -- 6. Generate Digital Entitlements for every asset linked to purchased products
    FOR v_item IN SELECT product_id FROM public.order_items WHERE order_id = p_order_id
    LOOP
        FOR v_asset IN SELECT id FROM public.digital_assets WHERE product_id = v_item.product_id
        LOOP
            -- Generate cryptographically strong random token
            v_token := encode(gen_random_bytes(32), 'hex');
            
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
        END LOOP;
    END LOOP;

    RETURN QUERY SELECT true, false, 'Order fulfilled successfully'::TEXT;
END;
$$;
```

### 6.4 Key Architectural Guarantees
- **Row Locking (`FOR UPDATE`)**: Prevents race conditions. If `/api/checkout/verify` and `/api/webhooks/razorpay` arrive simultaneously, the first acquires the row lock, fulfills the order, and the second cleanly exits via `already_processed = true`.
- **All-or-Nothing Atomicity**: If any step fails, the entire transaction rolls back. A customer is never left in a state where payment is marked captured without download entitlements being generated.
- **Monetary Snapshot Assertion**: Prevents payment manipulation. The database itself refuses to mark an order captured if the amount or currency differs from `orders.charged_amount` and `orders.charged_currency`.

---

## 7. SUMMARY OF PROPOSED SCHEMA EVOLUTIONS (FOR FUTURE PHASE 1C.2)

To implement the corrected architecture, the following single, non-breaking SQL enhancement will be proposed in Phase 1C.2:

```sql
-- Proposed enhancement in Phase 1C.2 (NOT EXECUTED NOW):
-- 1. Create atomic fulfilment RPC function: public.process_order_capture(...)
-- 2. Revoke execute from PUBLIC and anon; Grant execute strictly to service_role.
```
*No alterations to existing tables or columns are necessary.*

---

## 8. REVISED IMPLEMENTATION SEQUENCE FOR PHASE 1C

```
Stage 1C.2: Atomic Fulfilment Function & Gateway Core
  ├─ Create atomic RPC `process_order_capture` in Supabase
  ├─ Install `razorpay` npm package
  └─ Implement `src/lib/razorpay.ts` with signature verification

Stage 1C.3: Server Checkout API & Sandbox Route
  ├─ Refactor `/api/checkout` to query authoritative prices & create Razorpay order
  └─ Build isolated `/api/checkout/sandbox-test` for test products

Stage 1C.4: Client Checkout UI & Fast-Path Verify
  ├─ Update `/checkout/page.tsx` with Razorpay modal
  └─ Implement `/api/checkout/verify` calling `process_order_capture`

Stage 1C.5: Authoritative Webhook Ingestion
  ├─ Implement `/api/webhooks/razorpay` with raw HMAC SHA256 verification
  ├─ Store events in `payment_webhook_events`
  └─ Call `process_order_capture` for `payment.captured`

Stage 1C.6: Customer Experience & Downloads
  ├─ Connect `/account/library` to live `download_entitlements`
  ├─ Update `/api/download/[token]` to support guest hashed tokens
  └─ Update `/order/success` with immediate receipt & download links

Stage 1C.7: Sandbox Testing & Test Data Purge
  ├─ Run 20-scenario sandbox test matrix with test cards & UPI
  ├─ Validate refund flow & partial revocation
  └─ Execute clean-up protocol for `ORD-SANDBOX-%` records
```

---

## 9. FINAL VALIDATION & READ-ONLY CONFIRMATION

- **Source Code Files**: Zero files were edited, created, or deleted (aside from this documentation addendum). [VERIFIED]
- **NPM Packages**: Zero packages installed or uninstalled. [VERIFIED]
- **Database Operations**: Zero DDL migrations, zero INSERT/UPDATE/DELETE queries executed. [VERIFIED]
- **Supabase Storage**: Zero files or buckets modified. [VERIFIED]
- **Product & Price Guardrails**:
  - `14-day-home-reset-kit`: Remains strictly in `draft`. [VERIFIED]
  - `mitthus-fun-learning-book`: Remains strictly in `draft`. [VERIFIED]
  - `product_prices`: Table contains exactly 0 records. [VERIFIED]

**ADDENDUM COMPLETE — STOPPED AND AWAITING EXPLICIT USER APPROVAL FOR PHASE 1C.2.**
