import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { isLiveTransaction, isTestTransaction } from "@/lib/commerce/transactionClassifier";

export async function GET(request: Request) {
  const auth = await requireAdminSession(request);
  if (!auth.success) {
    return auth.response;
  }

  try {
    const { adminClient } = auth.context;

    // 1. Query Authoritative Storewide Financial & Fulfilment Metrics via RPC
    const { data: storewideMetrics, error: rpcError } = await adminClient.rpc("get_admin_storewide_metrics");

    let grossSales = 0;
    let totalRefunds = 0;
    let netRevenue = 0;
    let liveOrdersCount = 0;
    let livePaidOrdersCount = 0;
    let testOrdersCount = 0;
    let testRevenue = 0;
    let pendingPaymentsCount = 0;
    let failedPaymentsCount = 0;
    let totalEligibleFulfilment = 0;
    let fullyFulfilledCount = 0;
    let fulfilmentRate = 0;

    if (!rpcError && storewideMetrics && storewideMetrics[0]) {
      const m = storewideMetrics[0];
      grossSales = Number(m.gross_sales || 0);
      totalRefunds = Number(m.total_refunds || 0);
      netRevenue = Number(m.net_revenue || 0);
      liveOrdersCount = Number(m.live_orders_count || 0);
      livePaidOrdersCount = Number(m.live_paid_orders_count || 0);
      testOrdersCount = Number(m.test_orders_count || 0);
      testRevenue = Number(m.test_revenue || 0);
      pendingPaymentsCount = Number(m.pending_payments_count || 0);
      failedPaymentsCount = Number(m.failed_payments_count || 0);
      totalEligibleFulfilment = Number(m.total_eligible_fulfilment_orders || 0);
      fullyFulfilledCount = Number(m.fully_fulfilled_orders_count || 0);
      fulfilmentRate = Number(m.fulfilment_rate_percent || 0);
    } else {
      console.warn("[Admin Analytics API] RPC get_admin_storewide_metrics not available or returned error, computing via fallback:", rpcError);
      
      // Fallback: Query all orders for complete database-wide aggregation
      const { data: allOrders } = await adminClient
        .from("orders")
        .select(`
          id,
          order_number,
          total_amount,
          status,
          payment_status,
          currency,
          is_sandbox,
          environment,
          created_at,
          payments (
            id,
            gateway,
            gateway_transaction_id,
            environment,
            raw_response
          )
        `);

      const orders = allOrders || [];
      for (const o of orders) {
        const isLive = isLiveTransaction(o);
        const isTest = isTestTransaction(o);
        const isPaid = o.status === "paid" || o.status === "fulfilled" || o.status === "completed";

        if (isLive) {
          liveOrdersCount++;
          if (isPaid) {
            livePaidOrdersCount++;
            grossSales += Number(o.total_amount || 0);
          }
        } else if (isTest) {
          testOrdersCount++;
          if (isPaid) {
            testRevenue += Number(o.total_amount || 0);
          }
        }
      }

      // Query refunds for live orders
      const { data: refunds } = await adminClient
        .from("refunds")
        .select("amount, status, order_id, orders (environment, is_sandbox)")
        .eq("status", "processed");

      if (refunds) {
        for (const r of refunds as any[]) {
          if (r.orders?.environment === "live" && !r.orders?.is_sandbox) {
            totalRefunds += Number(r.amount || 0);
          }
        }
      }

      netRevenue = Math.max(0, grossSales - totalRefunds);
    }

    // Average Order Value based on net revenue and paid live orders
    const averageOrderValue = livePaidOrdersCount > 0 ? netRevenue / livePaidOrdersCount : 0;

    // 2. Calculate product sales distribution strictly from live commercial transactions
    const { data: livePaidItems } = await adminClient
      .from("order_items")
      .select(`
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price,
        orders!inner (
          id,
          status,
          environment,
          is_sandbox
        )
      `)
      .eq("orders.environment", "live")
      .eq("orders.is_sandbox", false)
      .in("orders.status", ["paid", "fulfilled", "completed"]);

    const productStatsMap: Record<string, { id: string; name: string; unitsSold: number; totalRevenue: number }> = {};

    if (livePaidItems) {
      for (const item of livePaidItems) {
        if (!productStatsMap[item.product_id]) {
          productStatsMap[item.product_id] = {
            id: item.product_id,
            name: item.product_name || "Unknown Product",
            unitsSold: 0,
            totalRevenue: 0,
          };
        }
        productStatsMap[item.product_id].unitsSold += Number(item.quantity || 1);
        productStatsMap[item.product_id].totalRevenue += Number(
          item.total_price || (item.unit_price * (item.quantity || 1))
        );
      }
    }

    const topProducts = Object.values(productStatsMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

    // Count registered patrons
    const { count: customerCount } = await adminClient
      .from("profiles")
      .select("*", { count: "exact", head: true });

    return NextResponse.json({
      summary: {
        grossSales,
        totalRefunds,
        netRevenue,
        totalRevenue: netRevenue, // Backward compatibility
        totalOrders: liveOrdersCount,
        paidOrders: livePaidOrdersCount,
        averageOrderValue,
        testOrdersCount,
        testRevenue,
        pendingPaymentsCount,
        failedPaymentsCount,
        totalEligibleFulfilment,
        fullyFulfilledCount,
        fulfilmentRate,
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
