import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { createCouponSchema, updateCouponSchema } from "@/lib/validation/adminSchemas";
import { handleApiError } from "@/lib/api/errorHandler";

export async function GET(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const { adminClient } = auth.context;
    const { data, error } = await adminClient
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return handleApiError(error, "Failed to retrieve promotional coupons.");
    }
    return NextResponse.json({ coupons: data });
  } catch (err: any) {
    return handleApiError(err, "Failed to retrieve promotional coupons.");
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json();
    const validated = createCouponSchema.parse(body);

    const { adminClient } = auth.context;
    const newCoupon = {
      code: validated.code,
      discount_percent: validated.discount_percent ?? null,
      discount_amount: validated.discount_amount ?? null,
      valid_until: validated.valid_until ?? null,
      max_uses: validated.max_uses ?? null,
      times_used: 0,
      is_active: validated.is_active,
    };

    const { data, error } = await adminClient
      .from("coupons")
      .insert(newCoupon)
      .select()
      .single();

    if (error) {
      return handleApiError(error, "Failed to create coupon code.");
    }

    return NextResponse.json({ success: true, coupon: data }, { status: 201 });
  } catch (err: any) {
    return handleApiError(err, "Failed to create coupon code.");
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdminSession(req);
  if (!auth.success) return auth.response;

  try {
    const body = await req.json();
    const validated = updateCouponSchema.parse(body);

    const { adminClient } = auth.context;
    const updates: Record<string, any> = {};
    if (validated.is_active !== undefined) updates.is_active = validated.is_active;
    if (validated.max_uses !== undefined) updates.max_uses = validated.max_uses;
    if (validated.valid_until !== undefined) updates.valid_until = validated.valid_until;

    const { data, error } = await adminClient
      .from("coupons")
      .update(updates)
      .eq("id", validated.id)
      .select()
      .single();

    if (error) {
      return handleApiError(error, "Failed to update coupon.");
    }

    return NextResponse.json({ success: true, coupon: data });
  } catch (err: any) {
    return handleApiError(err, "Failed to update coupon.");
  }
}
