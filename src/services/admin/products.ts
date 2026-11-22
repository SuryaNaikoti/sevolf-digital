import { createAdminClient } from "@/lib/supabase/admin";
import { Product, PublicationStatus } from "@/types/commerce";

function mapDbRowToProduct(row: any): Product {
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
  const price = priceObj.amount ? Number(priceObj.amount) : (row.slug === "14-day-home-reset-kit" ? 499 : 299);

  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline || "",
    shortDescription: row.short_description || "",
    fullDescription: row.full_description || "",
    category: row.product_categories?.slug || "home-living",
    categoryLabel: row.product_categories?.name || "Home & Living",
    productType: row.product_type || "Digital Workbook",
    format: (row.format as any) || "pdf",
    formatLabel: "PDF (Print-Ready)",
    price: price,
    compareAtPrice: priceObj.compare_at_amount ? Number(priceObj.compare_at_amount) : undefined,
    currency: priceObj.currency || "INR",
    coverImage: row.cover_image_url || "/images/products/home-reset-kit/cover.jpg",
    galleryImages: gallery,
    mockupImages: mockups,
    features: row.features || [
      "Manageable 30 to 60-minute daily micro-interventions.",
      "Includes calibrated A4 and US Letter editions with 20mm binder margins.",
      "Sustainable seasonal framework based on the 30-Day Pause Box method."
    ],
    whatsIncluded: row.whats_included || [
      "Digital Guide & Workbook (PDF)",
      "Daily Intervention Checklists"
    ],
    requirements: row.requirements || ["PDF reader or tablet app"],
    licenceType: "personal",
    licenceDescription: "Single-household personal licence.",
    status: (row.status as PublicationStatus) || "draft",
    isFeatured: row.is_featured ?? true,
    isNewArrival: false,
    isBestseller: true,
    tags: row.tags || ["home", "organisation"],
    seoTitle: row.seo_title || row.name,
    seoDescription: row.seo_description || row.short_description,
    keyBenefits: row.key_benefits,
    specifications: row.specifications || {
      "Format": "PDF Document",
      "Editions": "A4 and US Letter"
    },
    createdAt: row.created_at || new Date().toISOString(),
    updatedAt: row.updated_at || new Date().toISOString(),
  };
}

export async function getAdminProducts(): Promise<Product[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        product_categories (id, name, slug),
        product_media (*),
        product_prices (*)
      `)
      .order("created_at", { ascending: false });

    if (!error && data && data.length > 0) {
      return data.map(mapDbRowToProduct);
    }
  } catch (err) {
    console.error("[getAdminProducts] Error loading products:", err);
  }
  return [];
}

export async function getAdminProductBySlug(slug: string): Promise<Product | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("products")
      .select(`
        *,
        product_categories (id, name, slug),
        product_media (*),
        product_prices (*)
      `)
      .eq("slug", slug)
      .single();

    if (!error && data) {
      return mapDbRowToProduct(data);
    }
  } catch (err) {
    console.error("[getAdminProductBySlug] Error loading product:", err);
  }
  return null;
}
