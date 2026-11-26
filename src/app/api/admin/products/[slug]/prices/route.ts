import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { upsertPriceSchema } from "@/lib/validation/adminSchemas";
import { handleApiError } from "@/lib/api/errorHandler";

export async function GET(req: Request, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  const { slug } = await context.params;
  try {
    const { adminClient } = auth.context;
    const { data: product, error: prodErr } = await adminClient
      .from("products")
      .select("id")
      .eq("slug", slug)
      .single();

    if (prodErr || !product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    const { data: prices, error } = await adminClient
      .from("product_prices")
      .select("*")
      .eq("product_id", product.id)
      .order("currency", { ascending: true });

    if (error) {
      return handleApiError(error, "Failed to retrieve product prices.");
    }

    return NextResponse.json({ prices: prices || [] });
  } catch (err: any) {
    return handleApiError(err, "Failed to retrieve product prices.");
  }
}

export async function POST(req: Request, context: { params: Promise<{ slug: string }> }) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  const { slug } = await context.params;
  try {
    const body = await req.json();
    const validated = upsertPriceSchema.parse(body);

    const { adminClient } = auth.context;
    const { data: product, error: prodErr } = await adminClient
      .from("products")
      .select("id")
      .eq("slug", slug)
      .single();

    if (prodErr || !product) {
      return NextResponse.json({ error: "Product not found." }, { status: 404 });
    }

    if (validated.is_active) {
      await adminClient
        .from("product_prices")
        .update({ is_default: false })
        .eq("product_id", product.id)
        .neq("currency", validated.currency);
    }

    const { data: upserted, error: upsertErr } = await adminClient
      .from("product_prices")
      .upsert(
        {
          product_id: product.id,
          currency: validated.currency,
          amount: validated.amount,
          compare_at_amount: validated.compare_at_amount ?? null,
          is_default: validated.is_active,
        },
        { onConflict: "product_id,currency" }
      )
      .select()
      .single();

    if (upsertErr) return handleApiError(upsertErr, "Failed to save product price.");
    return NextResponse.json({ success: true, price: upserted });
  } catch (err: any) {
    return handleApiError(err, "Failed to save product price.");
  }
}
