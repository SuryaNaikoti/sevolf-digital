-- ==============================================================================
-- SEVOLF DIGITAL COMMERCE PLATFORM - PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- Migration: 20260218_initial_sevolf_digital_commerce.sql
-- Target Database: Singapore (AWS ap-southeast-1) - Project: kqoqdxoicqxulefnruvn
-- Final Security Hardened & Deployment-Ready Edition
-- ==============================================================================

-- 0. EXTENSIONS & TRANSACTION PREPARATION
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. ROLES & PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.roles (name, description) VALUES
    ('customer', 'Standard registered customer'),
    ('editor', 'Editorial manager & content creator'),
    ('admin', 'Full administrator for storefront and future admin dashboard')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    role_id UUID REFERENCES public.roles(id) ON DELETE RESTRICT,
    country VARCHAR(100) DEFAULT 'India',
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. HELPER FUNCTIONS & PRIVILEGE ENFORCEMENT
-- ==============================================================================

-- Admin RBAC helper function: Uses empty search_path with fully qualified identifiers
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles p
        JOIN public.roles r ON p.role_id = r.id
        WHERE p.id = (SELECT auth.uid()) AND r.name = 'admin'
    );
END;
$$ LANGUAGE plpgsql;

-- Profile privilege escalation prevention trigger
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- Prevent customers from changing their role_id or user id
    IF NEW.role_id IS DISTINCT FROM OLD.role_id THEN
        -- Only service_role or existing admin can alter roles
        IF NOT (
            (SELECT auth.role()) = 'service_role' OR 
            (SELECT public.is_admin())
        ) THEN
            RAISE EXCEPTION 'Unauthorized: Patrons cannot modify their assigned role or access tier.';
        END IF;
    END IF;
    IF NEW.id IS DISTINCT FROM OLD.id THEN
        RAISE EXCEPTION 'Unauthorized: User ID cannot be modified.';
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- Trigger function to automatically populate public.profiles on new auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    default_role_id UUID;
BEGIN
    SELECT id INTO default_role_id FROM public.roles WHERE name = 'customer' LIMIT 1;
    INSERT INTO public.profiles (id, email, full_name, role_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
        default_role_id
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
        updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. PRODUCT CATEGORIES & COLLECTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.product_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.product_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    tagline TEXT,
    description TEXT,
    image_url TEXT,
    is_featured BOOLEAN DEFAULT false,
    display_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. PRODUCTS CORE TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    tagline TEXT,
    short_description TEXT NOT NULL,
    full_description TEXT NOT NULL,
    category_id UUID REFERENCES public.product_categories(id) ON DELETE RESTRICT,
    product_type VARCHAR(100) NOT NULL,
    format VARCHAR(50) NOT NULL,
    format_label VARCHAR(150) NOT NULL,
    cover_image_url TEXT NOT NULL,
    licence_type VARCHAR(50) DEFAULT 'personal',
    licence_description TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    is_featured BOOLEAN DEFAULT false,
    is_new_arrival BOOLEAN DEFAULT false,
    is_bestseller BOOLEAN DEFAULT false,
    is_bundle BOOLEAN DEFAULT false,
    tags TEXT[] DEFAULT '{}',
    seo_title VARCHAR(255),
    seo_description TEXT,
    educational_meta JSONB,
    specifications JSONB,
    key_benefits TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.collection_products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    collection_id UUID REFERENCES public.product_collections(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    display_order INT DEFAULT 0,
    UNIQUE(collection_id, product_id)
);

-- ==============================================================================
-- 5. PRODUCT MEDIA & DIGITAL ASSETS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.product_media (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text TEXT,
    media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('cover', 'mockup', 'gallery', 'preview')),
    display_order INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.digital_assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(100) NOT NULL,
    file_version VARCHAR(50) DEFAULT '1.0',
    checksum VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. PRICING & MULTI-CURRENCY ARCHITECTURE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.product_prices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    compare_at_amount DECIMAL(12, 2) CHECK (compare_at_amount IS NULL OR compare_at_amount >= amount),
    is_default BOOLEAN DEFAULT false,
    UNIQUE(product_id, currency)
);

-- ==============================================================================
-- 7. BUNDLE DEFINITIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.bundles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.bundle_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bundle_id UUID REFERENCES public.bundles(id) ON DELETE CASCADE,
    included_product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bundle_id, included_product_id)
);

-- ==============================================================================
-- 8. COMMERCE: CARTS, ORDERS, ORDER ITEMS & PAYMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.carts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    session_id VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'INR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cart_id UUID REFERENCES public.carts(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    quantity INT DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(cart_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_email VARCHAR(255) NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount DECIMAL(12, 2) DEFAULT 0 CHECK (discount >= 0),
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'paid', 'failed', 'refunded', 'cancelled')),
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'authorized', 'captured', 'failed', 'refunded')),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE RESTRICT,
    product_name VARCHAR(255) NOT NULL,
    unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    total_price DECIMAL(12, 2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    gateway VARCHAR(50) NOT NULL CHECK (gateway IN ('razorpay', 'stripe')),
    gateway_transaction_id VARCHAR(255),
    gateway_order_id VARCHAR(255),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('created', 'authorized', 'captured', 'failed', 'refunded')),
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. DIGITAL LIBRARY & SECURED TIME-LIMITED DOWNLOAD ENTITLEMENTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.download_entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    customer_email VARCHAR(255) NOT NULL,
    digital_asset_id UUID REFERENCES public.digital_assets(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    download_limit INT DEFAULT 10 CHECK (download_limit > 0),
    download_count INT DEFAULT 0 CHECK (download_count >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.download_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entitlement_id UUID REFERENCES public.download_entitlements(id) ON DELETE CASCADE,
    ip_address VARCHAR(45),
    user_agent TEXT,
    downloaded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. LICENCES, SUBSCRIPTIONS, COUPONS, WISHLISTS & AUDIT LOGS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.licences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_item_id UUID REFERENCES public.order_items(id) ON DELETE CASCADE,
    licence_key VARCHAR(100) UNIQUE NOT NULL,
    licence_type VARCHAR(50) NOT NULL,
    holder_email VARCHAR(255) NOT NULL,
    issued_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'canceled', 'incomplete')),
    plan_name VARCHAR(100) NOT NULL,
    current_period_start TIMESTAMPTZ NOT NULL,
    current_period_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.coupons (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    discount_percent INT CHECK (discount_percent > 0 AND discount_percent <= 100),
    discount_amount DECIMAL(12, 2) CHECK (discount_amount IS NULL OR discount_amount > 0),
    valid_until TIMESTAMPTZ,
    max_uses INT,
    times_used INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name VARCHAR(100) NOT NULL,
    rating INT CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT NOT NULL,
    is_verified_purchase BOOLEAN DEFAULT false,
    status VARCHAR(20) DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.wishlists (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
    subscribed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    target_table VARCHAR(100) NOT NULL,
    target_id UUID,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 11. INDEXING FOR PERFORMANCE & INTEGRITY
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status_featured ON public.products(status, is_featured);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);
CREATE INDEX IF NOT EXISTS idx_product_media_product ON public.product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_prices_product ON public.product_prices(product_id);
CREATE INDEX IF NOT EXISTS idx_digital_assets_product ON public.digital_assets(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON public.orders(customer_email);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_download_entitlements_token ON public.download_entitlements(token);
CREATE INDEX IF NOT EXISTS idx_download_entitlements_user ON public.download_entitlements(user_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_entitlement ON public.download_logs(entitlement_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON public.cart_items(cart_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_user ON public.wishlists(user_id);

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) ACTIVATION
-- ==============================================================================
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.digital_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bundle_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.carts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.licences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Clean existing policies before recreating (Idempotency)
DROP POLICY IF EXISTS "Public can view published products" ON public.products;
DROP POLICY IF EXISTS "Public can view categories" ON public.product_categories;
DROP POLICY IF EXISTS "Public can view collections" ON public.product_collections;
DROP POLICY IF EXISTS "Public can view collection products" ON public.collection_products;
DROP POLICY IF EXISTS "Public can view product media" ON public.product_media;
DROP POLICY IF EXISTS "Public can view product prices" ON public.product_prices;
DROP POLICY IF EXISTS "Public can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can access own entitlements" ON public.download_entitlements;
DROP POLICY IF EXISTS "Users can manage own wishlist" ON public.wishlists;
DROP POLICY IF EXISTS "Users can view own carts" ON public.carts;
DROP POLICY IF EXISTS "Users can insert own carts" ON public.carts;
DROP POLICY IF EXISTS "Users can update own carts" ON public.carts;
DROP POLICY IF EXISTS "Users can delete own carts" ON public.carts;
DROP POLICY IF EXISTS "Users can view own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can insert own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can update own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Users can delete own cart items" ON public.cart_items;
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "Admins have full access to products" ON public.products;
DROP POLICY IF EXISTS "Admins have full access to orders" ON public.orders;
DROP POLICY IF EXISTS "Admins have full access to payments" ON public.payments;
DROP POLICY IF EXISTS "Admins have full access to entitlements" ON public.download_entitlements;
DROP POLICY IF EXISTS "Admins have full access to digital assets" ON public.digital_assets;

-- ==============================================================================
-- 13. RLS POLICIES SPECIFICATION
-- ==============================================================================

-- 13.1 Storefront Public Access (Published Only)
CREATE POLICY "Public can view published products"
    ON public.products FOR SELECT
    USING (status = 'published');

CREATE POLICY "Public can view categories"
    ON public.product_categories FOR SELECT
    USING (true);

CREATE POLICY "Public can view collections"
    ON public.product_collections FOR SELECT
    USING (true);

CREATE POLICY "Public can view collection products"
    ON public.collection_products FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = collection_products.product_id
            AND p.status = 'published'
        )
    );

CREATE POLICY "Public can view product media"
    ON public.product_media FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_media.product_id
            AND p.status = 'published'
        )
    );

CREATE POLICY "Public can view product prices"
    ON public.product_prices FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.products p
            WHERE p.id = product_prices.product_id
            AND p.status = 'published'
        )
    );

CREATE POLICY "Public can view reviews"
    ON public.reviews FOR SELECT
    USING (status = 'approved');

-- 13.2 Customer Profile Policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- 13.3 Orders & Order Items Policies (Strictly Read-Only for Customers)
CREATE POLICY "Users can view own orders"
    ON public.orders FOR SELECT
    USING ((SELECT auth.uid()) = user_id OR customer_email = ((SELECT auth.jwt()) ->> 'email'));

CREATE POLICY "Users can view own order items"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            WHERE o.id = order_items.order_id
            AND (o.user_id = (SELECT auth.uid()) OR o.customer_email = ((SELECT auth.jwt()) ->> 'email'))
        )
    );

-- 13.4 Download Entitlements & Logs (Strictly Read-Only for Customers)
CREATE POLICY "Users can access own entitlements"
    ON public.download_entitlements FOR SELECT
    USING ((SELECT auth.uid()) = user_id OR customer_email = ((SELECT auth.jwt()) ->> 'email'));

-- 13.5 Carts & Cart Items (Granular CRUD)
CREATE POLICY "Users can view own carts"
    ON public.carts FOR SELECT
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can insert own carts"
    ON public.carts FOR INSERT
    WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can update own carts"
    ON public.carts FOR UPDATE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can delete own carts"
    ON public.carts FOR DELETE
    USING ((SELECT auth.uid()) = user_id);

CREATE POLICY "Users can view own cart items"
    ON public.cart_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.carts c
            WHERE c.id = cart_items.cart_id
            AND c.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can insert own cart items"
    ON public.cart_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.carts c
            WHERE c.id = cart_items.cart_id
            AND c.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can update own cart items"
    ON public.cart_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.carts c
            WHERE c.id = cart_items.cart_id
            AND c.user_id = (SELECT auth.uid())
        )
    );

CREATE POLICY "Users can delete own cart items"
    ON public.cart_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.carts c
            WHERE c.id = cart_items.cart_id
            AND c.user_id = (SELECT auth.uid())
        )
    );

-- 13.6 Customer Wishlist (Granular CRUD)
CREATE POLICY "Users can manage own wishlist"
    ON public.wishlists FOR ALL
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

-- 13.7 Newsletter Subscriber (Public Insert Only)
CREATE POLICY "Anyone can subscribe to newsletter"
    ON public.newsletter_subscribers FOR INSERT
    WITH CHECK (true);

-- 13.8 Administrator Full Access Policies (RBAC)
CREATE POLICY "Admins have full access to products"
    ON public.products FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins have full access to orders"
    ON public.orders FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins have full access to payments"
    ON public.payments FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins have full access to entitlements"
    ON public.download_entitlements FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins have full access to digital assets"
    ON public.digital_assets FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

-- ==============================================================================
-- 14. SUPABASE STORAGE RLS POLICIES (Storage Schema)
-- ==============================================================================
DROP POLICY IF EXISTS "Public can view product covers" ON storage.objects;
CREATE POLICY "Public can view product covers"
    ON storage.objects FOR SELECT
    USING (bucket_id IN ('product-covers', 'product-previews'));

DROP POLICY IF EXISTS "Admins manage storage" ON storage.objects;
CREATE POLICY "Admins manage storage"
    ON storage.objects FOR ALL
    USING ((SELECT public.is_admin()))
    WITH CHECK ((SELECT public.is_admin()));

-- ==============================================================================
-- 15. INITIAL SEED DATA FOR CATEGORIES & COLLECTIONS (Idempotent)
-- ==============================================================================
INSERT INTO public.product_categories (name, slug, description, display_order) VALUES
    ('Home & Living', 'home-living', 'Order, warmth, and deliberate routines for modern spaces', 1),
    ('SEVOLF Little', 'kids-education', 'Wonder, foundation, and playful discovery for young minds', 2),
    ('Productivity & Planning', 'productivity', 'Intentional systems for focus, reflection, and quiet mastery', 3),
    ('Business & Entrepreneurship', 'business', 'Distilled frameworks and operating assets for independent founders', 4)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

INSERT INTO public.product_collections (name, slug, tagline, description, image_url, is_featured, display_order) VALUES
    ('Home & Living', 'home-living', 'Order, warmth, and deliberate routines for modern spaces.', 'Curated room-by-room guides, decluttering systems, and printable household audits designed to bring calm clarity to your daily sanctuary.', '/images/collections/home-living/cover.jpg', true, 1),
    ('SEVOLF Little', 'kids-education', 'Wonder, foundation, and playful discovery for young minds.', 'Montessori-informed early childhood workbooks, tactile phonics tracing sheets, and earth-toned activity companions free from screen fatigue.', '/images/collections/sevolf-little/cover.jpg', true, 2),
    ('Productivity & Planning', 'productivity', 'Intentional systems for focus, reflection, and quiet mastery.', 'Hyperlinked tablet planners, unhurried 90-day review canvases, and deep-work systems built for deliberate, high-leverage execution.', '/images/collections/productivity/cover.jpg', true, 3),
    ('Business & Entrepreneurship', 'business', 'Distilled frameworks and operating assets for independent founders.', 'Venture-grade financial models, minimal pitch deck templates, and modular founder agreements formatted for clarity and execution.', '/images/collections/business/cover.jpg', true, 4)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    tagline = EXCLUDED.tagline,
    description = EXCLUDED.description,
    image_url = EXCLUDED.image_url,
    is_featured = EXCLUDED.is_featured,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();
