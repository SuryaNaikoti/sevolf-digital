import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { updateProductSchema } from "@/lib/validation/adminSchemas";
import { handleApiError } from "@/lib/api/errorHandler";

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  const { slug } = await context.params;
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
      .eq("slug", slug)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Product not found.", code: "NOT_FOUND" }, { status: 404 });
    }
    return NextResponse.json({ product: data });
  } catch (err: any) {
    return handleApiError(err, "Failed to retrieve product details.");
  }
}

export async function PATCH(req: Request, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  const { slug } = await context.params;
  try {
    const body = await req.json();
    const validated = updateProductSchema.parse(body);

    // STRICT INVARIANT ENFORCEMENT:
    // 1. Gated: Cannot change status to 'published' in staging
    if (validated.status === "published") {
      return NextResponse.json(
        {
          error: "RESTRICTED: Product publication is strictly locked in staging. Products must remain in 'draft' or 'archived' status pending Phase 2 commercial authorization.",
          code: "PRODUCTION_PUBLISH_GATED",
        },
        { status: 403 }
      );
    }

    // 2. Gated: Cannot activate production pricing directly via admin draft save
    if (validated.activate_pricing || validated.is_price_active) {
      return NextResponse.json(
        {
          error: "RESTRICTED: Production price activation is locked. Price activation requires authorized pricing migration schedules.",
          code: "PRODUCTION_PRICING_GATED",
        },
        { status: 403 }
      );
    }

    const { adminClient } = auth.context;

    const allowedUpdates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (validated.name !== undefined) allowedUpdates.name = validated.name;
    if (validated.tagline !== undefined) allowedUpdates.tagline = validated.tagline;
    if (validated.short_description !== undefined) allowedUpdates.short_description = validated.short_description;
    if (validated.full_description !== undefined) allowedUpdates.full_description = validated.full_description;
    if (validated.product_type !== undefined) allowedUpdates.product_type = validated.product_type;
    if (validated.format !== undefined) allowedUpdates.format = validated.format;
    if (validated.format_label !== undefined) allowedUpdates.format_label = validated.format_label;
    if (validated.tags !== undefined) allowedUpdates.tags = validated.tags;
    if (validated.seo_title !== undefined) allowedUpdates.seo_title = validated.seo_title;
    if (validated.seo_description !== undefined) allowedUpdates.seo_description = validated.seo_description;
    if (validated.status !== undefined) allowedUpdates.status = validated.status;

    const { data, error } = await adminClient
      .from("products")
      .update(allowedUpdates)
      .eq("slug", slug)
      .select()
      .single();

    if (error) {
      return handleApiError(error, "Failed to update product details.");
    }

    return NextResponse.json({ success: true, product: data });
  } catch (err: any) {
    return handleApiError(err, "Failed to update product details.");
  }
}

export async function DELETE(req: Request, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  const { slug } = await context.params;
  try {
    const { adminClient } = auth.context;

    // Verify product exists and check status
    const { data: existing, error: fetchErr } = await adminClient
      .from("products")
      .select("id, slug, status")
      .eq("slug", slug)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Product not found.", code: "NOT_FOUND" }, { status: 404 });
    }

    // Safety guard: Protect baseline flagship products from permanent deletion
    if (slug === "14-day-home-reset-kit" || slug === "mitthus-fun-learning-book") {
      const { data: archived, error: archErr } = await adminClient
        .from("products")
        .update({ status: "archived", updated_at: new Date().toISOString() })
        .eq("slug", slug)
        .select()
        .single();

      if (archErr) return handleApiError(archErr, "Failed to archive flagship product.");
      return NextResponse.json({
        success: true,
        message: "Flagship product archived successfully.",
        product: archived,
      });
    }

    // Delete user-created draft products
    const { error: delErr } = await adminClient
      .from("products")
      .delete()
      .eq("slug", slug);

    if (delErr) {
      return handleApiError(delErr, "Failed to delete draft product.");
    }

    return NextResponse.json({ success: true, message: `Product ${slug} deleted successfully.` });
  } catch (err: any) {
    return handleApiError(err, "Failed to delete product.");
  }
}
