"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  ShoppingCart,
  Calendar,
  RefreshCw,
  Package,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminButton,
  AdminStatusBadge,
  AdminEmptyState,
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
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Analytics & Telemetry"
        subtitle="Real transactional analytics calculated strictly from verified database records."
        badge={{ text: "Real Database Calculations", variant: "neutral" }}
        actions={
          <AdminButton
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchAnalytics}
            disabled={loading}
          >
            Refresh Metrics
          </AdminButton>
        }
      />

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <AdminCard padding={false} className="p-5 space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#85847D]">
            Total Gross Revenue
          </span>
          <p className="text-2xl sm:text-3xl font-serif text-[#22231F]">
            ₹{(summary?.totalRevenue || 0).toFixed(2)}
          </p>
          <p className="text-[11px] text-[#85847D] font-mono">From captured transactions</p>
        </AdminCard>

        <AdminCard padding={false} className="p-5 space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#85847D]">
            Total Orders
          </span>
          <p className="text-2xl sm:text-3xl font-serif text-[#22231F]">
            {summary?.totalOrders || 0}
          </p>
          <p className="text-[11px] text-[#85847D] font-mono">
            {summary?.paidOrders || 0} paid & fulfilled
          </p>
        </AdminCard>

        <AdminCard padding={false} className="p-5 space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#85847D]">
            Average Order Value
          </span>
          <p className="text-2xl sm:text-3xl font-serif text-[#22231F]">
            ₹{(summary?.averageOrderValue || 0).toFixed(2)}
          </p>
          <p className="text-[11px] text-[#85847D] font-mono">Per completed checkout</p>
        </AdminCard>

        <AdminCard padding={false} className="p-5 space-y-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#85847D]">
            Registered Patrons
          </span>
          <p className="text-2xl sm:text-3xl font-serif text-[#22231F]">
            {summary?.registeredCustomers || 0}
          </p>
          <p className="text-[11px] text-[#85847D] font-mono">Verified customer profiles</p>
        </AdminCard>
      </div>

      {/* Top Products Table */}
      <AdminCard
        title="Top Selling Digital Products"
        subtitle="Ranked strictly by verified line-item sales"
        padding={false}
      >
        {topProducts.length === 0 ? (
          <AdminEmptyState
            icon={Package}
            title="No Sales Telemetry Yet"
            description="Product sales volume and performance will render dynamically once customer orders are placed."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Product</th>
                  <th className="py-3 px-5">Units Sold</th>
                  <th className="py-3 px-5 text-right">Revenue Generated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DD]">
                {topProducts.map((tp) => (
                  <tr key={tp.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3.5 px-5 font-medium text-[#22231F]">{tp.name}</td>
                    <td className="py-3.5 px-5 font-mono text-[#85847D]">{tp.unitsSold} units</td>
                    <td className="py-3.5 px-5 text-right font-serif text-sm font-medium text-[#22231F]">
                      ₹{tp.totalRevenue.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </div>
  );
}
