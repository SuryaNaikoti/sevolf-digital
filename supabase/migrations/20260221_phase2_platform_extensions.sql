-- ============================================================================
-- SEVOLF DIGITAL PRODUCT STUDIO: PHASE 2 SCHEMA EXTENSIONS
-- Migration: 20260221_phase2_platform_extensions.sql
-- Description: Extends Phase 1C architecture with Collections, Content Management,
--              Coupons/Discounts, Product Bundles, Reviews, Integration Registry,
--              Admin Roles & Audit Logging.
-- NOTE: Written to repository for staging validation. DO NOT APPLY DIRECTLY TO LIVE SUPABASE.
-- ============================================================================

-- 1. ROLE-BASED ACCESS CONTROL (RBAC) & ADMIN PERMISSIONS
CREATE TYPE public.admin_role AS ENUM (
  'owner',
  'administrator',
  'product_manager',
  'support_agent',
  'analyst'
);

CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  role public.admin_role NOT NULL DEFAULT 'product_manager',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_resource ON public.admin_audit_logs (resource_type, resource_id);

-- 2. COLLECTIONS & TAXONOMY
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  cover_image_url TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  seo_title TEXT,
  seo_description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.product_collection_memberships (
  collection_id UUID NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  PRIMARY KEY (collection_id, product_id)
);

-- 3. PRODUCT BUNDLES
CREATE TABLE IF NOT EXISTS public.product_bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE UNIQUE,
  discount_percentage NUMERIC(5, 2) DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.product_bundle_items (
  bundle_id UUID NOT NULL REFERENCES public.product_bundles(id) ON DELETE CASCADE,
  included_product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (bundle_id, included_product_id)
);

-- 4. DISCOUNTS & COUPONS
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
  discount_value NUMERIC(12, 2) NOT NULL CHECK (discount_value > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  min_order_amount NUMERIC(12, 2) DEFAULT 0.00,
  max_discount_amount NUMERIC(12, 2),
  max_uses INTEGER,
  uses_count INTEGER NOT NULL DEFAULT 0,
  per_customer_limit INTEGER DEFAULT 1,
  start_date TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  expiry_date TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON public.coupons (code) WHERE is_active = true;

-- 5. REVIEWS & TESTIMONIALS (MODERATED)
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  verified_purchase BOOLEAN NOT NULL DEFAULT false,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  moderated_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  moderated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_reviews_product_approved ON public.product_reviews (product_id, created_at DESC) WHERE status = 'approved';

-- 6. CONTENT MANAGEMENT & HOMEPAGE CONFIGURATION
CREATE TABLE IF NOT EXISTS public.content_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key TEXT NOT NULL UNIQUE,
  title TEXT,
  subtitle TEXT,
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. INTEGRATION REGISTRY & HEALTH (SERVER ONLY, SECURE METADATA)
CREATE TABLE IF NOT EXISTS public.integration_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL CHECK (category IN ('payments', 'email', 'messaging', 'storage', 'analytics', 'ai', 'platform')),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('disconnected', 'configured', 'active', 'error')),
  environment TEXT NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'live')),
  encrypted_config TEXT,
  last_checked_at TIMESTAMPTZ,
  last_error TEXT,
  updated_by UUID REFERENCES public.admin_users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collection_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integration_registry ENABLE ROW LEVEL SECURITY;

-- Public storefront access policies (read-only for active/visible elements)
CREATE POLICY "Public read access for visible collections"
  ON public.collections FOR SELECT USING (is_visible = true);

CREATE POLICY "Public read access for collection memberships"
  ON public.product_collection_memberships FOR SELECT USING (true);

CREATE POLICY "Public read access for product bundles"
  ON public.product_bundles FOR SELECT USING (true);

CREATE POLICY "Public read access for approved product reviews"
  ON public.product_reviews FOR SELECT USING (status = 'approved');

CREATE POLICY "Public read access for visible content sections"
  ON public.content_sections FOR SELECT USING (is_visible = true);

-- Strict service_role & admin access for sensitive tables
CREATE POLICY "Service role full access on admin_users"
  ON public.admin_users FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on admin_audit_logs"
  ON public.admin_audit_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on coupons"
  ON public.coupons FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access on integration_registry"
  ON public.integration_registry FOR ALL TO service_role USING (true) WITH CHECK (true);
