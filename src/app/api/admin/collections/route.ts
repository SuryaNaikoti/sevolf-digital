import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { createCollectionSchema, updateCollectionSchema } from "@/lib/validation/adminSchemas";
import { handleApiError } from "@/lib/api/errorHandler";

export async function GET(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const { adminClient } = auth.context;
    const { data, error } = await adminClient
      .from("product_collections")
      .select(`
        *,
        collection_products (
          product_id,
          display_order,
          products (id, name, slug, status, cover_image_url)
        )
      `)
      .order("display_order", { ascending: true });

    if (error) {
      return handleApiError(error, "Failed to retrieve collections.");
    }
    return NextResponse.json({ collections: data });
  } catch (err: any) {
    return handleApiError(err, "Failed to retrieve collections.");
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json();
    const validated = createCollectionSchema.parse(body);

    const { adminClient } = auth.context;
    const newCollection = {
      name: validated.name,
      slug: validated.slug,
      tagline: validated.tagline,
      description: validated.description,
      image_url: validated.image_url,
      is_featured: validated.is_featured,
      display_order: validated.display_order,
    };

    const { data, error } = await adminClient
      .from("product_collections")
      .insert(newCollection)
      .select()
      .single();

    if (error) {
      return handleApiError(error, "Failed to create collection.");
    }

    return NextResponse.json({ success: true, collection: data }, { status: 201 });
  } catch (err: any) {
    return handleApiError(err, "Failed to create collection.");
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json();
    const validated = updateCollectionSchema.parse(body);

    const { adminClient } = auth.context;
    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (validated.name !== undefined) updates.name = validated.name;
    if (validated.tagline !== undefined) updates.tagline = validated.tagline;
    if (validated.description !== undefined) updates.description = validated.description;
    if (validated.image_url !== undefined) updates.image_url = validated.image_url;
    if (validated.is_featured !== undefined) updates.is_featured = validated.is_featured;
    if (validated.display_order !== undefined) updates.display_order = validated.display_order;

    const { data, error } = await adminClient
      .from("product_collections")
      .update(updates)
      .eq("id", validated.id)
      .select()
      .single();

    if (error) {
      return handleApiError(error, "Failed to update collection.");
    }

    return NextResponse.json({ success: true, collection: data });
  } catch (err: any) {
    return handleApiError(err, "Failed to update collection.");
  }
}
