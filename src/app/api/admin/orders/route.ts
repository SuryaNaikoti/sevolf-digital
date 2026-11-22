import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const { adminClient } = auth.context;

    // Fetch live orders with item summaries and payment records
    const { data: orders, error: ordersError } = await adminClient
      .from("orders")
      .select(`
        id,
        order_number,
        user_id,
        customer_email,
        customer_name,
        currency,
        subtotal,
        discount,
        total_amount,
        status,
        payment_method,
        payment_status,
        is_sandbox,
        created_at,
        updated_at,
        order_items (
          id,
          product_id,
          product_name,
          unit_price,
          quantity,
          total_price
        ),
        payments (
          id,
          gateway,
          gateway_transaction_id,
          amount,
          currency,
          status,
          created_at
        ),
        download_entitlements (
          id,
          download_count,
          download_limit,
          is_active,
          is_revoked,
          expires_at
        )
      `)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("[Admin Orders API] Query Error:", ordersError);
      return NextResponse.json(
        { error: "Failed to retrieve orders from database." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      orders: orders || [],
      totalCount: orders?.length || 0,
    });
  } catch (err: any) {
    console.error("[Admin Orders API] Unexpected Error:", err);
    return NextResponse.json(
      { error: "Internal server error fetching orders." },
      { status: 500 }
    );
  }
}
