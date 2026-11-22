import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");

  if (!orderId) {
    return NextResponse.json({ error: "Order ID is required." }, { status: 400 });
  }

  try {
    const adminClient = createAdminClient();

    // Query order by id or order_number
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    let query = adminClient
      .from("orders")
      .select(`
        id,
        order_number,
        customer_email,
        customer_name,
        currency,
        total_amount,
        status,
        payment_status,
        created_at,
        order_items (
          id,
          product_name,
          quantity,
          unit_price,
          total_price
        ),
        download_entitlements (
          id,
          token,
          token_hash,
          download_count,
          download_limit,
          expires_at,
          is_active,
          is_revoked,
          digital_assets (
            id,
            file_name,
            mime_type,
            file_size_bytes
          )
        )
      `);

    if (isUUID) {
      query = query.eq("id", orderId);
    } else {
      query = query.eq("order_number", orderId);
    }

    const { data: order, error } = await query.maybeSingle();

    if (error || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json({
      order: {
        id: order.id,
        orderNumber: order.order_number,
        customerEmail: order.customer_email,
        customerName: order.customer_name,
        currency: order.currency,
        totalAmount: order.total_amount,
        status: order.status,
        paymentStatus: order.payment_status,
        createdAt: order.created_at,
        items: order.order_items || [],
        entitlements: (order.download_entitlements || []).map((e: any) => ({
          id: e.id,
          downloadCount: e.download_count,
          downloadLimit: e.download_limit,
          isActive: e.is_active && !e.is_revoked,
          fileName: e.digital_assets?.file_name || "Digital Product Asset",
          fileSizeBytes: e.digital_assets?.file_size_bytes || 0,
          mimeType: e.digital_assets?.mime_type || "application/octet-stream",
          // Return token for instant confirmation access if stored
          token: e.token || null,
        })),
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Internal server error fetching order status." },
      { status: 500 }
    );
  }
}
