import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const { adminClient } = auth.context;

    // Fetch all orders for authoritative mathematical metric calculation
    const { data: orders, error: ordersError } = await adminClient
      .from("orders")
      .select(`
        id,
        total_amount,
        status,
        currency,
        created_at,
        order_items (
          product_id,
          product_name,
          quantity,
          unit_price,
          total_price
        )
      `);

    if (ordersError) {
      console.error("[Admin Analytics API] Orders Error:", ordersError);
      return NextResponse.json(
        { error: "Failed to compute metrics from orders." },
        { status: 500 }
      );
    }

    const allOrders = orders || [];
    const paidOrders = allOrders.filter(
      (o: any) => o.status === "paid" || o.status === "completed" || o.status === "fulfilled"
    );

    // Calculate gross revenue
    const totalRevenue = paidOrders.reduce((sum: number, o: any) => sum + Number(o.total_amount || 0), 0);
    const totalPaidOrdersCount = paidOrders.length;
    const allOrdersCount = allOrders.length;
    const averageOrderValue = totalPaidOrdersCount > 0 ? totalRevenue / totalPaidOrdersCount : 0;

    // Calculate product sales distribution
    const productStatsMap: Record<string, { id: string; name: string; unitsSold: number; totalRevenue: number }> = {};

    for (const order of paidOrders) {
      const items = order.order_items || [];
      for (const item of items) {
        if (!productStatsMap[item.product_id]) {
          productStatsMap[item.product_id] = {
            id: item.product_id,
            name: item.product_name || "Unknown Product",
            unitsSold: 0,
            totalRevenue: 0,
          };
        }
        productStatsMap[item.product_id].unitsSold += Number(item.quantity || 1);
        productStatsMap[item.product_id].totalRevenue += Number(item.total_price || (item.unit_price * (item.quantity || 1)));
      }
    }

    const topProducts = Object.values(productStatsMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Count registered customers
    const { count: customerCount, error: customerCountError } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      summary: {
        totalRevenue,
        totalOrders: allOrdersCount,
        paidOrders: totalPaidOrdersCount,
        averageOrderValue,
        registeredCustomers: customerCount || 0,
        currency: "INR",
      },
      topProducts,
    });
  } catch (err: any) {
    console.error("[Admin Analytics API] Unexpected Error:", err);
    return NextResponse.json(
      { error: "Internal server error calculating analytics." },
      { status: 500 }
    );
  }
}
