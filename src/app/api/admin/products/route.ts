import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { createProductSchema } from "@/lib/validation/adminSchemas";
import { handleApiError } from "@/lib/api/errorHandler";

export async function GET(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const { adminClient } = auth.context;
    const { data, error } = await adminClient
      .from("products")
      .select(`
        *,
        product_categories (id, name, slug),
        product_media (*),
        product_prices (*)
      `)
      .order("created_at", { ascending: false });

    if (error) {
      return handleApiError(error, "Failed to retrieve products catalogue.");
    }
    return NextResponse.json({ products: data });
  } catch (err: any) {
    return handleApiError(err, "Failed to retrieve products catalogue.");
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json();
    const validated = createProductSchema.parse(body);

    if (validated.status === "published" && (!validated.price || validated.price <= 0)) {
      return NextResponse.json(
        {
          error: "Cannot publish a product directly without an active price and digital asset. Save as Draft first, attach a digital asset, and then publish.",
          code: "PUBLISH_CONDITIONS_UNMET",
        },
        { status: 400 }
      );
    }

    const { adminClient } = auth.context;

    // Verify category exists if provided
    let catId = validated.category_id;
    if (catId) {
      const { data: catExists } = await adminClient
        .from("product_categories")
        .select("id")
        .eq("id", catId)
        .single();

      if (!catExists) {
        return NextResponse.json(
          { error: "Selected category does not exist.", code: "INVALID_CATEGORY" },
          { status: 400 }
        );
      }
    } else {
      const { data: defaultCat } = await adminClient
        .from("product_categories")
        .select("id")
        .limit(1)
        .single();
      catId = defaultCat?.id;
    }

    const newProduct = {
      name: validated.name,
      slug: validated.slug,
      tagline: validated.tagline,
      short_description: validated.short_description || `${validated.name} - Digital Product`,
      full_description: validated.full_description || `${validated.name} - Complete digital edition.`,
      category_id: catId,
      product_type: validated.product_type,
      format: validated.format,
      format_label: validated.format_label,
      cover_image_url: validated.cover_image_url,
      licence_type: validated.licence_type,
      licence_description: "Single-household personal licence.",
      status: validated.status === "published" ? "draft" : validated.status,
      tags: validated.tags,
      seo_title: validated.seo_title || validated.name,
      seo_description: validated.seo_description || validated.short_description || `${validated.name} - Digital Product`,
      is_featured: false,
      is_new_arrival: false,
      is_bestseller: false,
      is_bundle: false,
    };

    const { data, error } = await adminClient
      .from("products")
      .insert(newProduct)
      .select()
      .single();

    if (error || !data) {
      return handleApiError(error, "Failed to create product.");
    }

    // Insert initial price if provided
    if (validated.price && validated.price > 0) {
      await adminClient.from("product_prices").insert({
        product_id: data.id,
        currency: validated.currency || "INR",
        amount: validated.price,
        compare_at_amount: validated.compare_at_amount ?? null,
        is_default: validated.is_price_active ?? (validated.currency || "INR") === "INR",
      });
    }

    // Insert gallery & preview media if provided
    const mediaRows: any[] = [];
    (validated.gallery_images || []).forEach((url, idx) => {
      mediaRows.push({ product_id: data.id, media_type: "gallery", url, display_order: idx + 1 });
    });
    (validated.preview_images || []).forEach((url, idx) => {
      mediaRows.push({ product_id: data.id, media_type: "preview", url, display_order: idx + 1 });
    });
    if (mediaRows.length > 0) {
      await adminClient.from("product_media").insert(mediaRows);
    }

    return NextResponse.json({ success: true, product: data }, { status: 201 });
  } catch (err: any) {
    return handleApiError(err, "Failed to create draft product.");
  }
}
