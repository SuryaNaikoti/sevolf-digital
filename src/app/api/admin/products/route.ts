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

    // STRICT INVARIANT ENFORCEMENT:
    // Staging and admin creation MUST ALWAYS remain 'draft'.
    // Direct publishing or setting status='published' is strictly gated.
    if (validated.status === "published") {
      return NextResponse.json(
        {
          error: "RESTRICTED: Products cannot be created directly in 'published' status. Production publication requires authorized Phase 2 launch verification.",
          code: "PRODUCTION_PUBLISH_GATED",
        },
        { status: 403 }
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
      status: "draft", // Strictly forced to draft
      tags: validated.tags,
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

    if (error) {
      return handleApiError(error, "Failed to create draft product.");
    }

    return NextResponse.json({ success: true, product: data }, { status: 201 });
  } catch (err: any) {
    return handleApiError(err, "Failed to create draft product.");
  }
}
