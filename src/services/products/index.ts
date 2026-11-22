import { Product, Collection, PublicationStatus } from "@/types/commerce";
import { PRODUCTS, COLLECTIONS } from "./mockData";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";

export interface ProductFilterOptions {
  category?: string;
  collectionSlug?: string;
  format?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  searchQuery?: string;
  sortBy?: "newest" | "price-asc" | "price-desc" | "featured";
  status?: PublicationStatus;
}

/**
 * Transforms a Supabase product record + media + prices into the application Product interface
 */
function mapDatabaseToProduct(row: any): Product {
  const mediaList = row.product_media || [];
  const gallery = mediaList
    .filter((m: any) => m.media_type === "gallery")
    .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
    .map((m: any) => m.url);
  const mockups = mediaList
    .filter((m: any) => m.media_type === "mockup")
    .sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0))
    .map((m: any) => m.url);

  const priceObj = row.product_prices?.find((p: any) => p.is_default) || row.product_prices?.[0] || {};

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline || "",
    shortDescription: row.short_description || "",
    fullDescription: row.full_description || "",
    category: row.product_categories?.slug || "home-living",
    categoryLabel: row.product_categories?.name || "General",
    productType: row.product_type || "Digital Resource",
    format: row.format || "pdf",
    formatLabel: row.format_label || "Digital Download",
    price: priceObj.amount ? Number(priceObj.amount) : 0,
    compareAtPrice: priceObj.compare_at_amount ? Number(priceObj.compare_at_amount) : undefined,
    currency: priceObj.currency || "INR",
    coverImage: row.cover_image_url || "/images/products/covers/home-reset.png",
    galleryImages: gallery,
    mockupImages: mockups,
    features: row.key_benefits || [],
    whatsIncluded: row.specifications?.whatsIncluded || [],
    requirements: row.specifications?.requirements || [],
    licenceType: row.licence_type || "personal",
    licenceDescription: row.licence_description || "Personal household usage licence.",
    status: row.status || "draft",
    isFeatured: !!row.is_featured,
    isNewArrival: !!row.is_new_arrival,
    isBestseller: !!row.is_bestseller,
    isBundle: !!row.is_bundle,
    tags: row.tags || [],
    seoTitle: row.seo_title || row.name,
    seoDescription: row.seo_description || row.short_description,
    educationalMeta: row.educational_meta,
    keyBenefits: row.key_benefits,
    specifications: row.specifications,
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

/**
 * Determines whether mock catalogue fallback is explicitly allowed.
 * SECURITY: Permitted ONLY when NODE_ENV is development AND NEXT_PUBLIC_ENABLE_MOCK_CATALOGUE === 'true'.
 * In production or when the variable is unset/false, mock fallback is strictly disabled.
 */
function isMockFallbackEnabled(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_MOCK_CATALOGUE === "true"
  );
}

/**
 * Fetch published products from Supabase.
 * - When Supabase returns zero published products successfully, returns []
 * - Never substitutes mock data in production or after successful database queries.
 * - Restricts mock fallback strictly to development environments with explicit opt-in.
 */
export async function getProducts(options: ProductFilterOptions = {}): Promise<Product[]> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("products")
      .select(`
        *,
        product_categories (id, name, slug),
        product_media (*),
        product_prices (*)
      `)
      .eq("status", options.status || "published");

    if (options.category) {
      query = query.eq("product_categories.slug", options.category);
    }

    if (options.format) {
      query = query.eq("format", options.format);
    }

    const { data, error } = await query;

    // If query succeeded (even with 0 rows), return the genuine database result
    if (!error && data) {
      let items = data.map(mapDatabaseToProduct);

      if (options.searchQuery && options.searchQuery.trim().length > 0) {
        const q = options.searchQuery.toLowerCase().trim();
        items = items.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            p.shortDescription.toLowerCase().includes(q) ||
            p.tags.some((t) => t.toLowerCase().includes(q))
        );
      }

      if (options.sortBy) {
        switch (options.sortBy) {
          case "price-asc":
            items.sort((a, b) => a.price - b.price);
            break;
          case "price-desc":
            items.sort((a, b) => b.price - a.price);
            break;
          case "newest":
            items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            break;
          case "featured":
          default:
            items.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
            break;
        }
      }

      return items;
    }
  } catch (err) {
    // Supabase client failure or network error
  }

  // Fallback is ONLY permitted in development with explicit configuration
  if (!isMockFallbackEnabled()) {
    return [];
  }

  // Development-only fallback to verified mock catalogue
  let items = [...PRODUCTS];
  const requiredStatus = options.status || "published";
  items = items.filter((p) => p.status === requiredStatus);

  if (options.category) {
    items = items.filter((p) => p.category === options.category);
  }

  if (options.collectionSlug) {
    if (options.collectionSlug === "home-living") items = items.filter((p) => p.category === "home-living");
    if (options.collectionSlug === "kids-education") items = items.filter((p) => p.category === "kids-education");
    if (options.collectionSlug === "productivity") items = items.filter((p) => p.category === "productivity");
    if (options.collectionSlug === "business") items = items.filter((p) => p.category === "business");
  }

  if (options.format) {
    items = items.filter((p) => p.format === options.format);
  }

  if (options.searchQuery && options.searchQuery.trim().length > 0) {
    const query = options.searchQuery.toLowerCase().trim();
    items = items.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.shortDescription.toLowerCase().includes(query) ||
        p.tags.some((t) => t.toLowerCase().includes(query)) ||
        p.categoryLabel.toLowerCase().includes(query)
    );
  }

  if (options.sortBy) {
    switch (options.sortBy) {
      case "price-asc":
        items.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        items.sort((a, b) => b.price - a.price);
        break;
      case "newest":
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
      case "featured":
      default:
        items.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
        break;
    }
  }

  return items;
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        product_categories (id, name, slug),
        product_media (*),
        product_prices (*)
      `)
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (!error && data) {
      return mapDatabaseToProduct(data);
    }

    // If query executed and row was not found (or not published), return null
    if (error && error.code === "PGRST116") {
      return null;
    }
  } catch {
    // Client initialization failure
  }

  // Fallback is ONLY permitted in development with explicit configuration
  if (!isMockFallbackEnabled()) {
    return null;
  }

  const product = PRODUCTS.find((p) => p.slug === slug && p.status === "published");
  return product || null;
}

export async function getFeaturedProducts(limit = 4): Promise<Product[]> {
  const products = await getProducts({ status: "published" });
  return products.filter((p) => p.isFeatured).slice(0, limit);
}

export async function getNewArrivals(limit = 4): Promise<Product[]> {
  const products = await getProducts({ status: "published" });
  return products.filter((p) => p.isNewArrival || p.isFeatured).slice(0, limit);
}

export async function getBestsellers(limit = 4): Promise<Product[]> {
  const products = await getProducts({ status: "published" });
  return products.filter((p) => p.isBestseller).slice(0, limit);
}

export async function getBundles(): Promise<Product[]> {
  const products = await getProducts({ status: "published" });
  return products.filter((p) => p.isBundle);
}

export async function getRelatedProducts(productId: string, limit = 3): Promise<Product[]> {
  const all = await getProducts({ status: "published" });
  const current = all.find((p) => p.id === productId);
  if (!current) return all.slice(0, limit);

  return all
    .filter((p) => p.id !== productId && (p.category === current.category || p.isFeatured))
    .slice(0, limit);
}

export async function getCollections(): Promise<Collection[]> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("product_collections")
      .select("*")
      .order("display_order", { ascending: true });

    if (!error && data && data.length > 0) {
      return data.map((c: any) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        tagline: c.tagline || "",
        description: c.description || "",
        image: c.image_url || "/images/collections/home-living/cover.jpg",
        featuredProductCount: 4,
      }));
    }
  } catch {
    // Fall back
  }

  return COLLECTIONS;
}

export async function getCollectionBySlug(slug: string): Promise<Collection | null> {
  const collections = await getCollections();
  const col = collections.find((c) => c.slug === slug);
  return col || null;
}
