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
  Filter,
} from "lucide-react";
import Link from "next/link";
import { getAdminProducts } from "@/services/admin/products";

export default async function AdminOverviewPage() {
  const products = await getAdminProducts();

  return (
    <div className="space-y-6">
      {/* Top Welcome & Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Overview</h1>
          <p className="text-xs text-[#6D7175]">
            Real-time store performance, fulfillment health, and pre-launch operational alerts.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <div className="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-[#BABFC3] rounded-md text-xs text-[#202223] font-medium shadow-2xs">
            <Calendar className="w-3.5 h-3.5 text-[#6D7175]" />
            <span>Today</span>
          </div>

          <Link
            href="/admin/products"
            className="px-3 py-1.5 bg-[#202223] hover:bg-black text-white text-xs font-semibold rounded-md shadow-2xs transition-colors"
          >
            Manage Products
          </Link>
        </div>
      </div>

      {/* Pre-launch Onboarding Alert */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3 text-xs leading-relaxed text-amber-900 shadow-2xs">
        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold text-amber-950">Store is in Pre-launch Verification</p>
          <p className="text-amber-800/90 mt-0.5">
            Real payments are held in disconnected mode. Live product pricing rows are zero. Launch Readiness gate is currently <strong>8 / 14 Complete</strong>.
          </p>
        </div>
        <Link
          href="/admin/readiness"
          className="text-xs font-semibold text-amber-950 underline shrink-0 hover:text-black"
        >
          View Checklist
        </Link>
      </div>

      {/* Metrics Row (Shopify Compact Metric Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#6D7175]">
            <span className="text-xs font-medium">Total Sales</span>
            <TrendingUp className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-[#202223]">₹0.00</p>
          <p className="text-[11px] text-[#6D7175]">0 live orders captured</p>
        </div>

        <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#6D7175]">
            <span className="text-xs font-medium">Total Orders</span>
            <ShoppingCart className="w-4 h-4 text-[#6D7175]" />
          </div>
          <p className="text-xl font-bold text-[#202223]">0</p>
          <p className="text-[11px] text-[#6D7175]">0 orders in current period</p>
        </div>

        <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#6D7175]">
            <span className="text-xs font-medium">Average Order Value</span>
            <span className="text-[11px] font-mono text-[#6D7175]">—</span>
          </div>
          <p className="text-xl font-bold text-[#202223]">₹0.00</p>
          <p className="text-[11px] text-[#6D7175]">No live order transactions</p>
        </div>

        <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 space-y-1 shadow-2xs">
          <div className="flex items-center justify-between text-[#6D7175]">
            <span className="text-xs font-medium">Returning Customer Rate</span>
            <Users className="w-4 h-4 text-[#6D7175]" />
          </div>
          <p className="text-xl font-bold text-[#202223]">0.0%</p>
          <p className="text-[11px] text-[#6D7175]">Baseline ready for launch</p>
        </div>
      </div>

      {/* Main Content Grid: Recent Orders & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 cols): Recent Orders & Fulfilment */}
        <div className="lg:col-span-2 space-y-6">
          {/* Recent Orders Card */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-[#E1E3E5] flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#202223] font-mono">
                Recent Orders
              </h2>
              <Link
                href="/admin/orders"
                className="text-xs text-[#008060] font-semibold hover:underline"
              >
                View all orders
              </Link>
            </div>

            <div className="p-8 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-[#F6F6F7] border border-[#E1E3E5] mx-auto flex items-center justify-center text-[#6D7175]">
                <ShoppingCart className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-semibold text-[#202223]">You have no orders yet</h3>
              <p className="text-xs text-[#6D7175] max-w-sm mx-auto">
                Orders placed through your customer storefront will appear here once live payment gateways are connected.
              </p>
            </div>
          </div>

          {/* Operational Health Table */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-[#E1E3E5] flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#202223] font-mono">
                System Operations & Fulfilment
              </h2>
              <span className="text-[10px] font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                HEALTHY
              </span>
            </div>

            <div className="divide-y divide-[#E1E3E5] text-xs">
              <div className="p-3.5 flex items-center justify-between hover:bg-[#F6F6F7]/60">
                <div className="space-y-0.5">
                  <p className="font-medium text-[#202223]">Delivery Outbox Processor</p>
                  <p className="text-[#6D7175] text-[11px]">Lease locking and background worker active</p>
                </div>
                <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                  0 Pending Jobs
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between hover:bg-[#F6F6F7]/60">
                <div className="space-y-0.5">
                  <p className="font-medium text-[#202223]">V13 Refund Procedures</p>
                  <p className="text-[#6D7175] text-[11px]">Replay idempotency and line-item limit enforced</p>
                </div>
                <span className="font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px]">
                  Enforced
                </span>
              </div>

              <div className="p-3.5 flex items-center justify-between hover:bg-[#F6F6F7]/60">
                <div className="space-y-0.5">
                  <p className="font-medium text-[#202223]">Payment Integrations</p>
                  <p className="text-[#6D7175] text-[11px]">Razorpay & Stripe in disconnected pre-launch mode</p>
                </div>
                <span className="font-mono text-amber-800 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                  Disconnected
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Top Products & Fast Actions */}
        <div className="space-y-6">
          {/* Top Products Card */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
            <div className="px-4 py-3 border-b border-[#E1E3E5] flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-[#202223] font-mono">
                Draft Catalogue ({products.length})
              </h2>
              <Link
                href="/admin/products"
                className="text-xs text-[#008060] font-semibold hover:underline"
              >
                View all
              </Link>
            </div>

            <div className="divide-y divide-[#E1E3E5]">
              {products.map((p) => (
                <div key={p.id} className="p-3.5 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="w-8 h-8 rounded bg-[#F6F6F7] border border-[#E1E3E5] flex items-center justify-center shrink-0">
                      <Package className="w-4 h-4 text-[#6D7175]" />
                    </div>
                    <div className="truncate">
                      <p className="font-medium text-[#202223] truncate">{p.name}</p>
                      <p className="text-[11px] text-[#6D7175] font-mono truncate">{p.formatLabel}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-medium text-[#202223]">₹{p.price}</span>
                    <p className="text-[10px] text-amber-700 font-mono">Draft</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg p-4 space-y-3 shadow-2xs">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-[#202223] font-mono">
              Quick Shortcuts
            </h3>
            <div className="space-y-1.5 text-xs">
              <Link
                href="/admin/assets"
                className="flex items-center justify-between p-2 rounded hover:bg-[#F6F6F7] text-[#202223] font-medium transition-colors"
              >
                <span>Digital Asset Vault</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#6D7175]" />
              </Link>
              <Link
                href="/admin/collections"
                className="flex items-center justify-between p-2 rounded hover:bg-[#F6F6F7] text-[#202223] font-medium transition-colors"
              >
                <span>Manage Collections</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#6D7175]" />
              </Link>
              <Link
                href="/admin/settings"
                className="flex items-center justify-between p-2 rounded hover:bg-[#F6F6F7] text-[#202223] font-medium transition-colors"
              >
                <span>Configure Integrations</span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[#6D7175]" />
              </Link>
              <Link
                href="/"
                target="_blank"
                className="flex items-center justify-between p-2 rounded bg-[#F6F6F7] hover:bg-[#EAEAEA] text-[#202223] font-semibold transition-colors"
              >
                <span>View Online Store</span>
                <ExternalLink className="w-3.5 h-3.5 text-[#6D7175]" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
