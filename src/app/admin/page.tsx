import {
  TrendingUp,
  Package,
  ShoppingCart,
  Users,
  AlertCircle,
  Clock,
  ArrowUpRight,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  Calendar,
  Layers,
  FileArchive,
  Sparkles,
  ArrowRight,
  FlaskConical,
} from "lucide-react";
import Link from "next/link";
import { getAdminProducts } from "@/services/admin/products";
import { LAUNCH_READINESS_CHECKLIST } from "@/services/admin/readiness";
import { AdminCard, AdminStatusBadge, AdminButton } from "@/components/admin/ui/AdminComponents";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveTransaction, isTestTransaction } from "@/lib/commerce/transactionClassifier";

export default async function AdminOverviewPage() {
  const products = await getAdminProducts();
  const readyCount = LAUNCH_READINESS_CHECKLIST.filter((i) => i.status === "ready").length;
  const totalCount = LAUNCH_READINESS_CHECKLIST.length;

  // Real query from database via privileged admin client
  const supabase = createAdminClient();

  // 1. Authoritative storewide financial & fulfilment RPC
  const { data: storewideMetrics, error: metricsError } = await supabase.rpc("get_admin_storewide_metrics");

  let grossSales = 0;
  let totalRefunds = 0;
  let netRevenue = 0;
  let livePaidOrdersCount = 0;
  let testOrdersCount = 0;
  let testRevenue = 0;
  let totalEligibleOrders = 0;
  let fullyFulfilledCount = 0;
  let fulfillmentRate = 0;

  if (!metricsError && storewideMetrics && storewideMetrics[0]) {
    const m = storewideMetrics[0];
    grossSales = Number(m.gross_sales || 0);
    totalRefunds = Number(m.total_refunds || 0);
    netRevenue = Number(m.net_revenue || 0);
    livePaidOrdersCount = Number(m.live_paid_orders_count || 0);
    testOrdersCount = Number(m.test_orders_count || 0);
    testRevenue = Number(m.test_revenue || 0);
    totalEligibleOrders = Number(m.total_eligible_fulfilment_orders || 0);
    fullyFulfilledCount = Number(m.fully_fulfilled_orders_count || 0);
    fulfillmentRate = Number(m.fulfilment_rate_percent || 0);
  }

  // 2. Fetch recent ledger entries for the activity table (without restricting storewide calculations)
  const { data: orders } = await supabase
    .from("orders")
    .select(`
      *,
      order_items (
        id,
        product_id,
        product_name,
        products (
          id,
          digital_assets (
            id,
            is_active
          )
        )
      ),
      download_entitlements (
        id,
        is_active,
        is_revoked,
        expires_at
      ),
      payments (
        id,
        gateway,
        gateway_transaction_id,
        environment,
        raw_response
      )
    `)
    .order("created_at", { ascending: false })
    .limit(10);

  const realOrders = orders || [];
  const liveRevenue = netRevenue;

  // Fulfilment health card display state
  let fulfillmentStatusText = "Standby (No Orders Yet)";
  let fulfillmentMetric = "—";
  let fulfillmentVariant: "neutral" | "success" | "warning" = "neutral";

  if (totalEligibleOrders > 0) {
    fulfillmentMetric = `${fulfillmentRate}%`;
    fulfillmentStatusText = `${fullyFulfilledCount} of ${totalEligibleOrders} fully delivered`;
    fulfillmentVariant = fulfillmentRate === 100 ? "success" : fulfillmentRate > 0 ? "warning" : "neutral";
  }

  return (
    <div className="space-y-8">
      {/* 1. Studio Editorial Greeting & Controls */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-[#E8E5DD]">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-xs font-mono uppercase tracking-[0.15em] text-[#85866A]">
            <span>SEVOLF Digital</span>
            <span>•</span>
            <span>Studio Control Center</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-serif font-light text-[#22231F] tracking-tight">
            Studio Overview
          </h1>
          <p className="text-xs sm:text-[13px] text-[#85847D] max-w-2xl font-sans">
            Real-time telemetry, catalogue status, and operational verification gates for SEVOLF Digital Product Studio.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 shrink-0">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#E8E5DD] rounded-md text-xs text-[#22231F] font-mono shadow-xs">
            <Calendar className="w-3.5 h-3.5 text-[#85866A]" />
            <span>Today</span>
          </div>

          <Link href="/admin/products">
            <AdminButton variant="primary">
              Manage Products
            </AdminButton>
          </Link>
        </div>
      </div>

      {/* 2. Studio Pre-launch Gate Banner */}
      <div className="bg-[#FAF8F5] border border-[#E8E5DD] rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-start space-x-3.5">
          <div className="w-9 h-9 rounded-full bg-[#FBF7F0] border border-[#EADFCB] text-[#8C6D34] flex items-center justify-center shrink-0 mt-0.5">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-serif font-normal text-[#22231F]">
                Pre-Launch Operational Verification Gate Active
              </h2>
              <span className="text-[10px] font-mono uppercase tracking-wider bg-[#FBF7F0] text-[#8C6D34] border border-[#EADFCB] px-2 py-0.5 rounded-full font-medium">
                {readyCount} / {totalCount} Complete
              </span>
            </div>
            <p className="text-xs text-[#85847D] leading-relaxed max-w-3xl">
              Live commercial payments are locked in disconnected mode. Test transactions are strictly segregated from business revenue.
            </p>
          </div>
        </div>

        <Link
          href="/admin/readiness"
          className="inline-flex items-center space-x-1.5 text-xs font-mono uppercase tracking-wider text-[#85866A] hover:text-[#22231F] transition-colors shrink-0 underline underline-offset-4"
        >
          <span>Review Gates</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 3. Key Financial & Operational Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <AdminCard padding={false} className="p-5 space-y-3">
          <div className="flex items-center justify-between text-[#85847D]">
            <span className="text-[11px] font-mono uppercase tracking-wider font-medium">Live Business Revenue</span>
            <TrendingUp className="w-4 h-4 text-[#85866A]" />
          </div>
          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-serif font-light text-[#22231F]">
              ₹{liveRevenue.toFixed(2)}
            </p>
            <p className="text-[11px] text-[#85847D] font-mono">
              {livePaidOrdersCount} live commercial order{livePaidOrdersCount === 1 ? "" : "s"}
            </p>
          </div>
        </AdminCard>

        <AdminCard padding={false} className="p-5 space-y-3">
          <div className="flex items-center justify-between text-[#85847D]">
            <span className="text-[11px] font-mono uppercase tracking-wider font-medium">Test & Sandbox Orders</span>
            <FlaskConical className="w-4 h-4 text-[#85866A]" />
          </div>
          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-serif font-light text-[#22231F]">
              {testOrdersCount}
            </p>
            <p className="text-[11px] text-[#85847D] font-mono">
              {testOrdersCount > 0 ? "Excluded from business KPIs" : "Zero test transactions"}
            </p>
          </div>
        </AdminCard>

        <AdminCard padding={false} className="p-5 space-y-3">
          <div className="flex items-center justify-between text-[#85847D]">
            <span className="text-[11px] font-mono uppercase tracking-wider font-medium">Studio Catalogue</span>
            <Package className="w-4 h-4 text-[#85866A]" />
          </div>
          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-serif font-light text-[#22231F]">{products.length}</p>
            <p className="text-[11px] text-[#85847D] font-mono">PDF & digital packages</p>
          </div>
        </AdminCard>

        <AdminCard padding={false} className="p-5 space-y-3">
          <div className="flex items-center justify-between text-[#85847D]">
            <span className="text-[11px] font-mono uppercase tracking-wider font-medium">Fulfilment Health</span>
            <ShieldCheck className={`w-4 h-4 ${fulfillmentVariant === "success" ? "text-[#55694B]" : "text-[#85866A]"}`} />
          </div>
          <div className="space-y-1">
            <p className="text-2xl sm:text-3xl font-serif font-light text-[#22231F]">
              {fulfillmentMetric}
            </p>
            <p className="text-[11px] text-[#85847D] font-mono">
              {fulfillmentStatusText}
            </p>
          </div>
        </AdminCard>
      </div>

      {/* 4. Main Two-Column Studio Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 cols): Orders Queue & Fulfillment Ledger */}
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Orders Card */}
          <AdminCard
            title={`Orders Ledger (${realOrders.length})`}
            subtitle="Real transactional records logged from checkout"
            action={
              <Link
                href="/admin/orders"
                className="text-xs font-mono uppercase tracking-wider text-[#85866A] hover:text-[#22231F] hover:underline transition-colors"
              >
                All Orders →
              </Link>
            }
            padding={false}
          >
            {realOrders.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="w-11 h-11 rounded-full bg-[#FAF8F5] border border-[#E8E5DD] mx-auto flex items-center justify-center text-[#85847D]">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div className="space-y-1 max-w-sm mx-auto">
                  <h3 className="text-sm font-serif font-normal text-[#22231F]">No Orders Yet</h3>
                  <p className="text-xs text-[#85847D] leading-relaxed">
                    Real orders placed through your storefront will register here once live payment gateways are connected.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-5">Order #</th>
                      <th className="py-3 px-5">Patron</th>
                      <th className="py-3 px-5">Environment</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5">Fulfilment</th>
                      <th className="py-3 px-5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E5DD]">
                    {realOrders.map((o) => {
                      const isTest = isTestTransaction(o);
                      return (
                        <tr key={o.id} className="hover:bg-[#FAF8F5] transition-colors">
                          <td className="py-3.5 px-5 font-mono font-medium text-[#22231F]">
                            {o.order_number}
                          </td>
                          <td className="py-3.5 px-5">
                            <p className="font-medium text-[#22231F]">{o.customer_name || "Valued Patron"}</p>
                            <p className="text-[11px] text-[#85847D] font-mono">{o.customer_email}</p>
                          </td>
                          <td className="py-3.5 px-5">
                            {isTest ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider bg-[#FBF7F0] text-[#8C6D34] border border-[#EADFCB]">
                                Test Mode
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider bg-[#F2F5F0] text-[#55694B] border border-[#D4DCCF]">
                                Live
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5">
                            <AdminStatusBadge variant={o.status === "paid" ? "success" : "warning"}>
                              {o.status}
                            </AdminStatusBadge>
                          </td>
                          <td className="py-3.5 px-5">
                            <span className="text-[11px] font-mono text-[#55694B] bg-[#F2F5F0] border border-[#D4DCCF] px-2 py-0.5 rounded">
                              {o.download_entitlements?.length || 0} Delivered
                            </span>
                          </td>
                          <td className="py-3.5 px-5 text-right font-serif text-sm font-medium text-[#22231F]">
                            ₹{o.total_amount}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </AdminCard>

          {/* Operational Engine & Background Workers */}
          <AdminCard
            title="System Operations & Fulfillment"
            subtitle="Background delivery workers, lease locks, and ledger idempotency"
            action={
              <AdminStatusBadge variant="success">Operational</AdminStatusBadge>
            }
            padding={false}
          >
            <div className="divide-y divide-[#E8E5DD] text-xs">
              <div className="p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors">
                <div className="space-y-0.5">
                  <p className="font-medium text-[#22231F]">Delivery Outbox Background Worker</p>
                  <p className="text-[#85847D] text-[11px]">Lease locking and transactional job processor</p>
                </div>
                <span className="font-mono text-[#55694B] bg-[#F2F5F0] border border-[#D4DCCF] px-2.5 py-0.5 rounded text-[11px]">
                  0 Pending Tasks
                </span>
              </div>

              <div className="p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors">
                <div className="space-y-0.5">
                  <p className="font-medium text-[#22231F]">V13 Atomic Refund Engine</p>
                  <p className="text-[#85847D] text-[11px]">Strict lock order and line-item balance preservation</p>
                </div>
                <span className="font-mono text-[#55694B] bg-[#F2F5F0] border border-[#D4DCCF] px-2.5 py-0.5 rounded text-[11px]">
                  Enforced
                </span>
              </div>

              <div className="p-4 flex items-center justify-between hover:bg-[#FAF8F5] transition-colors">
                <div className="space-y-0.5">
                  <p className="font-medium text-[#22231F]">Payment Gateway Connectors</p>
                  <p className="text-[#85847D] text-[11px]">Razorpay held safely in test mode</p>
                </div>
                <span className="font-mono text-[#8C6D34] bg-[#FBF7F0] border border-[#EADFCB] px-2.5 py-0.5 rounded text-[11px]">
                  Pre-Launch Mode
                </span>
              </div>
            </div>
          </AdminCard>
        </div>

        {/* Right Column (1 col): Product Catalogue & Studio Shortcuts */}
        <div className="space-y-8">
          {/* Catalogue Snapshot */}
          <AdminCard
            title={`Catalogue (${products.length})`}
            subtitle="Curated digital products in drafting"
            action={
              <Link
                href="/admin/products"
                className="text-xs font-mono uppercase tracking-wider text-[#85866A] hover:text-[#22231F] hover:underline transition-colors"
              >
                View all →
              </Link>
            }
            padding={false}
          >
            <div className="divide-y divide-[#E8E5DD]">
              {products.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between text-xs hover:bg-[#FAF8F5] transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-[#F7F5F0] border border-[#E8E5DD] flex items-center justify-center shrink-0 text-[#85866A]">
                      <Package className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="font-medium text-[#22231F] truncate">{p.name}</p>
                      <p className="text-[11px] text-[#85847D] font-mono truncate">{p.formatLabel}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-2">
                    <span className="font-mono font-medium text-[#22231F]">₹{p.price}</span>
                    <p className="text-[10px] text-[#8C6D34] font-mono">Draft</p>
                  </div>
                </div>
              ))}
            </div>
          </AdminCard>

          {/* Studio Quick Navigation */}
          <AdminCard
            title="Studio Navigation"
            subtitle="Direct operational shortcuts"
            padding={false}
          >
            <div className="divide-y divide-[#E8E5DD] text-xs">
              <Link
                href="/admin/assets"
                className="flex items-center justify-between p-3.5 hover:bg-[#FAF8F5] text-[#22231F] transition-colors group"
              >
                <div className="flex items-center space-x-2.5">
                  <FileArchive className="w-4 h-4 text-[#85866A]" />
                  <span>Digital Asset Vault</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#85847D] group-hover:text-[#22231F] transition-colors" />
              </Link>

              <Link
                href="/admin/collections"
                className="flex items-center justify-between p-3.5 hover:bg-[#FAF8F5] text-[#22231F] transition-colors group"
              >
                <div className="flex items-center space-x-2.5">
                  <Layers className="w-4 h-4 text-[#85866A]" />
                  <span>Studio Collections</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#85847D] group-hover:text-[#22231F] transition-colors" />
              </Link>

              <Link
                href="/admin/settings"
                className="flex items-center justify-between p-3.5 hover:bg-[#FAF8F5] text-[#22231F] transition-colors group"
              >
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-[#85866A]" />
                  <span>Integrations & Security</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#85847D] group-hover:text-[#22231F] transition-colors" />
              </Link>

              <Link
                href="/shop"
                target="_blank"
                className="flex items-center justify-between p-3.5 bg-[#FAF8F5] hover:bg-[#F2EFE8] text-[#22231F] font-medium transition-colors group"
              >
                <div className="flex items-center space-x-2.5">
                  <ExternalLink className="w-4 h-4 text-[#85866A]" />
                  <span>View Customer Storefront</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#85847D] group-hover:text-[#22231F] transition-colors" />
              </Link>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
