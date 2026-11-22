"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  AlertCircle,
  TrendingUp,
  Users,
  ShoppingCart,
  Calendar,
  RefreshCw,
  Package,
  ArrowUpRight,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
} from "@/components/admin/ui/AdminComponents";

interface AnalyticsSummary {
  totalRevenue: number;
  totalOrders: number;
  paidOrders: number;
  averageOrderValue: number;
  registeredCustomers: number;
  currency: string;
}

interface TopProductStat {
  id: string;
  name: string;
  unitsSold: number;
  totalRevenue: number;
}

export default function AdminAnalyticsPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [topProducts, setTopProducts] = useState<TopProductStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics");
      if (!res.ok) {
        throw new Error(`Failed to load analytics: HTTP ${res.status}`);
      }
      const data = await res.json();
      setSummary(data.summary);
      setTopProducts(data.topProducts || []);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred loading analytics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Unified Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <AdminPageHeader
          title="Analytics & Telemetry"
          subtitle="Real transactional analytics calculated strictly from verified database records."
          badge={{ text: "Real Database Calculations", variant: "neutral" }}
        />

        <button
          onClick={fetchAnalytics}
          className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#BABFC3] bg-white text-[#202223] text-xs font-semibold rounded-md shadow-2xs hover:bg-[#F6F6F7] transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#6D7175] ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Metrics</span>
        </button>
      </div>

      {/* Zero Synthetic Data Notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start space-x-3 text-xs leading-relaxed text-amber-900 shadow-2xs">
        <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-950">Zero-Synthetic-Data Policy Enforced</p>
          <p className="text-amber-800/90 leading-normal">
            Every metric displayed below is derived directly from settled orders and active customer records. Synthetic visitors, mock conversion multipliers, and simulated sales are strictly prohibited.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="p-16 text-center space-y-3 bg-white border border-[#E1E3E5] rounded-lg shadow-2xs">
          <RefreshCw className="w-6 h-6 text-[#8C9196] animate-spin mx-auto" />
          <p className="text-xs text-[#6D7175]">Calculating store performance metrics...</p>
        </div>
      ) : error ? (
        <div className="p-12 text-center space-y-3 bg-white border border-[#E1E3E5] rounded-lg shadow-2xs">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <h3 className="text-sm font-semibold text-[#202223]">Unable to calculate analytics</h3>
          <p className="text-xs text-[#6D7175] max-w-sm mx-auto">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="px-3 py-1.5 bg-[#202223] text-white text-xs font-semibold rounded-md"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          {/* Key Performance Indicators Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <AdminCard title="Gross Settled Revenue">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#6D7175]">
                  <span className="text-xs">Settled paid orders</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-2xl font-bold text-[#202223] font-mono">
                  {summary?.currency || "INR"} {Number(summary?.totalRevenue || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-[#6D7175]">
                  From {summary?.paidOrders || 0} captured transactions
                </p>
              </div>
            </AdminCard>

            <AdminCard title="Orders Captured">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#6D7175]">
                  <span className="text-xs">Paid / Total placed</span>
                  <ShoppingCart className="w-4 h-4 text-[#8C9196]" />
                </div>
                <p className="text-2xl font-bold text-[#202223] font-mono">
                  {summary?.paidOrders || 0}
                  <span className="text-sm font-normal text-[#6D7175]"> / {summary?.totalOrders || 0}</span>
                </p>
                <p className="text-[11px] text-[#6D7175]">
                  {summary?.totalOrders ? Math.round(((summary.paidOrders || 0) / summary.totalOrders) * 100) : 0}% settlement rate
                </p>
              </div>
            </AdminCard>

            <AdminCard title="Average Order Value">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#6D7175]">
                  <span className="text-xs">AOV across captures</span>
                  <BarChart3 className="w-4 h-4 text-[#8C9196]" />
                </div>
                <p className="text-2xl font-bold text-[#202223] font-mono">
                  {summary?.currency || "INR"} {Math.round(summary?.averageOrderValue || 0).toLocaleString()}
                </p>
                <p className="text-[11px] text-[#6D7175]">Per successful checkout</p>
              </div>
            </AdminCard>

            <AdminCard title="Registered Patrons">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[#6D7175]">
                  <span className="text-xs">Account profiles</span>
                  <Users className="w-4 h-4 text-[#8C9196]" />
                </div>
                <p className="text-2xl font-bold text-[#202223] font-mono">
                  {summary?.registeredCustomers || 0}
                </p>
                <p className="text-[11px] text-[#6D7175]">Verified Supabase Auth accounts</p>
              </div>
            </AdminCard>
          </div>

          {/* Product Performance Section */}
          <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
            <div className="p-4 border-b border-[#E1E3E5] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#202223]">Product Performance</h3>
                <p className="text-xs text-[#6D7175]">Settled sales breakdown per digital title</p>
              </div>
              <span className="text-xs font-mono text-[#6D7175]">
                {topProducts.length} active digital titles sold
              </span>
            </div>

            {topProducts.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Package className="w-8 h-8 text-[#8C9196] mx-auto" />
                <h4 className="text-xs font-semibold text-[#202223]">No product sales recorded yet</h4>
                <p className="text-[11px] text-[#6D7175] max-w-sm mx-auto">
                  As purchases are completed and digital assets delivered, unit volumes and revenue per title will appear here.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#FAFBFB] text-[#6D7175] border-b border-[#E1E3E5] font-medium font-mono text-[11px]">
                    <th className="py-2.5 px-4">Product Name</th>
                    <th className="py-2.5 px-4">Units Sold</th>
                    <th className="py-2.5 px-4 text-right">Gross Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E3E5]">
                  {topProducts.map((prod) => (
                    <tr key={prod.id} className="hover:bg-[#FAFBFB] transition-colors">
                      <td className="py-3 px-4 font-medium text-[#202223]">{prod.name}</td>
                      <td className="py-3 px-4 font-mono text-[#6D7175]">{prod.unitsSold} units</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#202223]">
                        {summary?.currency || "INR"} {Number(prod.totalRevenue).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
