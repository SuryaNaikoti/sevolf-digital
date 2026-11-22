import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const { adminClient } = auth.context;

    // Fetch live payments joined with order details
    const { data: payments, error: paymentsError } = await adminClient
      .from("payments")
      .select(`
        id,
        order_id,
        gateway,
        gateway_transaction_id,
        gateway_order_id,
        amount,
        currency,
        status,
        created_at,
        updated_at,
        orders (
          id,
          order_number,
          customer_email,
          customer_name,
          status
        )
      `)
      .order("created_at", { ascending: false });

    if (paymentsError) {
      console.error("[Admin Payments API] Query Error:", paymentsError);
      return NextResponse.json(
        { error: "Failed to retrieve payment records from database." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      payments: payments || [],
      totalCount: payments?.length || 0,
    });
  } catch (err: any) {
    console.error("[Admin Payments API] Unexpected Error:", err);
    return NextResponse.json(
      { error: "Internal server error fetching payments." },
      { status: 500 }
    );
  }
}
