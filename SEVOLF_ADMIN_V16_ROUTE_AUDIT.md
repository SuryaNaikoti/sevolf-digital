# SEVOLF CONTROL CENTER — V16 ROUTE AUDIT & ARCHITECTURE INVENTORY

**Audit Date:** November 21, 2026  
**Auditor:** Senior Full-Stack Architect & Quality Lead  
**Scope:** Complete inspection of all administrative routes, layouts, navigation entries, headers, button states, and styling.

---

## 1. Route Inventory & Status Analysis

| Route Path | Current Module State | Layout / Header State | Design System / Colors | Action Status in Staging | Recommendation |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/admin` | Overview | Standard V15 Shell. Clean, no duplicate header. | 60/30/10 `#F6F6F7`, `#FFFFFF`, `#008060`. | Working metrics & shortcuts. | **Retain as Primary** |
| `/admin/readiness` | Launch Readiness Gate | Standard V15 Shell. Clean, no duplicate header. | 60/30/10 Polaris style. | Checklist functional, links to gates. | **Retain as Primary** |
| `/admin/products` | Product Catalogue | Standard V15 Shell. Clean, no duplicate header. | Polaris Table `#FFFFFF`, `#E1E3E5`. | View, Search, Filter, Edit links work. Create locked. | **Retain as Primary** |
| `/admin/products/[slug]`| Product Editor | Standard V15 Shell. Clean, no duplicate header. | 2-column Polaris editor layout. | Reads real draft product. Save disabled (staging). | **Retain as Primary** |
| `/admin/collections`| Collections | **DUPLICATE HEADER**: calls `<AdminHeader>` inside page. Uses dark grey cards (`bg-stone-900/40`). | **INCONSISTENT**: Dark stone aesthetic, poor contrast. | Edit & Create buttons disabled. | **Fix: remove header, use AdminCard / white surface** |
| `/admin/assets` | Digital Asset Vault | Standard V15 Shell. Clean, no duplicate header. | Polaris Table `#FFFFFF`, `#E1E3E5`. | Asset list functional, private storage flags active. | **Retain as Primary** |
| `/admin/orders` | Order Registry | Standard V15 Shell. Clean, no duplicate header. | Polaris Table `#FFFFFF`, `#E1E3E5`. | Real baseline (0 orders). | **Retain as Primary** |
| `/admin/customers` | Customer Directory | Standard V15 Shell. Clean, no duplicate header. | Polaris Table `#FFFFFF`, `#E1E3E5`. | Real baseline (0 customers). | **Retain as Primary** |
| `/admin/payments` | Payment Transactions | Standard V15 Shell. Clean, no duplicate header. | Polaris Table `#FFFFFF`, `#E1E3E5`. | Real baseline (0 payments). | **Retain as Primary** |
| `/admin/refunds` | Refund Processing | Standard V15 Shell. Clean, no duplicate header. | Polaris Table `#FFFFFF`, `#E1E3E5`. | V13 procedure rules documented. | **Retain as Primary** |
| `/admin/discounts` | Discounts & Coupons | **DUPLICATE HEADER**: calls `<AdminHeader>` inside page. Uses dark cards (`bg-stone-900/40`). | **INCONSISTENT**: Dark stone aesthetic, poor contrast. | Create disabled. | **Fix: remove header, use Polaris table & white card** |
| `/admin/content` | Content & CMS | **DUPLICATE HEADER**: calls `<AdminHeader>` inside page. Uses dark cards (`bg-stone-900/40`). | **INCONSISTENT**: Dark stone aesthetic. | Section list visible, preview functional. | **Fix: remove header, use white cards & proper contrast** |
| `/admin/analytics` | Analytics & Telemetry | **DUPLICATE HEADER**: calls `<AdminHeader>` inside page. Uses dark cards (`bg-stone-900/60`). | **INCONSISTENT**: Dark stone aesthetic. | Zero baseline enforced. | **Fix: remove header, use standard white metric cards** |
| `/admin/settings` | Settings & Integrations| Standard V15 Shell. Clean, no duplicate header. | Polaris Cards `#FFFFFF`, `#E1E3E5`. | 8 provider cards (all DISCONNECTED). | **Retain as Primary** |
| `/admin/inventory` | **BROKEN (404)** | Link in sidebar points to non-existent route. Falls back to Storefront 404! | N/A | Non-functional. | **Fix: Defer link from sidebar; add Admin fallback** |
| `/admin/draft-orders` | **BROKEN (404)** | Link in sidebar points to non-existent route. Falls back to Storefront 404! | N/A | Non-functional. | **Fix: Defer link from sidebar; add Admin fallback** |
| `/admin/campaigns` | **BROKEN (404)** | Link in sidebar points to non-existent route. Falls back to Storefront 404! | N/A | Non-functional. | **Fix: Defer link from sidebar; add Admin fallback** |
| `/admin/bundles` | Product Bundles | Calls `<AdminHeader>`. Uses dark stone cards. Unfinished. | **INCONSISTENT** | Non-functional. | **Fix: Defer link from primary navigation** |
| `/admin/subscriptions`| Subscriptions | Calls `<AdminHeader>`. Uses dark stone cards. Unfinished. | **INCONSISTENT** | Non-functional (recurring billing not ready). | **Fix: Defer link from primary navigation** |
| `/admin/reviews` | Reviews Moderation | Calls `<AdminHeader>`. Uses dark stone cards. Unfinished. | **INCONSISTENT** | Non-functional. | **Fix: Defer link from primary navigation** |

---

## 2. Identified Defect Categories

1. **Duplicate Header Rendering:**  
   In V14/V15, `AdminLayoutClient.tsx` was introduced with a global sticky `<AdminHeader>`. However, individual pages (`collections`, `content`, `discounts`, `analytics`, `bundles`, `subscriptions`, `reviews`) still contained local `<AdminHeader title="..." />` calls, resulting in two headers stacked on top of each other.
2. **Color System Inconsistency (Dark Stone vs Shopify Neutral):**  
   While `/admin`, `/admin/products`, `/admin/assets`, `/admin/orders`, `/admin/customers`, `/admin/payments`, `/admin/refunds`, and `/admin/settings` were updated to `#F6F6F7` and `#FFFFFF`, four pages (`collections`, `content`, `discounts`, `analytics`) retained dark stone cards (`bg-stone-900/40`), creating visual fragmentation.
3. **Broken Sidebar Links Leading to Storefront 404:**  
   The sidebar contained links for `Inventory`, `Draft Orders`, and `Campaigns`, but no Next.js page routes existed in `src/app/admin/`. When clicked or prefetched, they triggered customer-facing storefront 404 pages.
4. **Disabled Action Buttons Without Clarity:**  
   Several staging-safe operations (e.g. creating/editing draft coupons, editing collection metadata, creating staging draft products) were hardcoded with `disabled cursor-not-allowed` without explanation of why they were locked or what configuration unlocked them.

---

## 3. Corrective Plan (V16)

1. Build a unified shared admin component library in `src/components/admin/ui/` (`AdminCard`, `AdminPageHeader`, `AdminDataTable`, `AdminBadge`, `AdminButton`, etc.).
2. Update `AdminSidebar.tsx`:
   - Keep active modules: Overview, Launch Readiness, Online Store, Content, Products, Collections, Digital Assets, Orders, Customers, Payments, Refunds, Discounts, Analytics, Settings (General, Payments, Integrations, Security).
   - Defer: Inventory, Draft Orders, Campaigns, Bundles, Subscriptions, Reviews.
   - For direct URL access to deferred routes, provide a standard administrative deferred notice page (never customer storefront 404).
3. Update all individual admin pages to remove duplicate `<AdminHeader>` calls and standardize on the 60/30/10 color tokens.
4. Provide functional staging actions with modals/drawers and clear tooltips for restricted production actions (Publishing, Live Payments).
