"use client";

import React, { useEffect, useState } from "react";
import {
  ShoppingCart,
  Search,
  Filter,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  FlaskConical,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui/AdminComponents";
import { isTestTransaction, isLiveTransaction } from "@/lib/commerce/transactionClassifier";

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface OrderRecord {
  id: string;
  order_number: string;
  customer_email: string;
  customer_name: string;
  currency: string;
  total_amount: number;
  status: string;
  payment_method: string;
  payment_status: string;
  is_sandbox: boolean;
  created_at: string;
  order_items: OrderItem[];
  payments: any[];
  download_entitlements: any[];
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) {
        throw new Error(`Failed to load orders: HTTP ${res.status}`);
      }
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred loading orders.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const isTestOrder = (o: OrderRecord) => {
    return isTestTransaction(o);
  };

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      (o.order_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_email || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name || "").toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "live") return isLiveTransaction(o);
    if (statusFilter === "test") return isTestTransaction(o);
    if (statusFilter === "paid") return o.status === "paid" || o.payment_status === "paid";
    if (statusFilter === "unpaid") return o.status === "pending" || o.payment_status === "pending";
    if (statusFilter === "unfulfilled") return (o.download_entitlements || []).length === 0;
    return true;
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Orders & Transactions"
        subtitle="Real customer transactions, payment ledger states, and digital download entitlements."
        badge={{ text: `${orders.length} Total`, variant: "neutral" }}
        actions={
          <AdminButton
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchOrders}
            disabled={loading}
          >
            Refresh Ledger
          </AdminButton>
        }
      />

      {/* Main Table Card */}
      <AdminCard padding={false}>
        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-[#E8E5DD] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#FDFCFA]">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#85847D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by order #, email, patron..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs font-sans bg-white border border-[#E8E5DD] rounded-md pl-8 pr-3 py-1.5 text-[#22231F] placeholder-[#85847D] focus:outline-hidden focus:border-[#85866A]"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <span className="text-[11px] font-mono text-[#85847D] uppercase tracking-wider hidden sm:inline">
              Filter:
            </span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-sans bg-white border border-[#E8E5DD] rounded-md px-3 py-1.5 text-[#22231F] focus:outline-hidden focus:border-[#85866A]"
            >
              <option value="all">All Transactions</option>
              <option value="live">Live Orders Only</option>
              <option value="test">Test Mode Only</option>
              <option value="paid">Paid & Captured</option>
              <option value="unpaid">Pending</option>
              <option value="unfulfilled">Unfulfilled</option>
            </select>
          </div>
        </div>

        {/* Content Table or Empty State */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#85847D] font-mono">
            Loading order records from database...
          </div>
        ) : filteredOrders.length === 0 ? (
          <AdminEmptyState
            icon={ShoppingCart}
            title="No Orders Found"
            description="No customer transactions match the selected filter. Real orders will populate once live customer purchases occur."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Order #</th>
                  <th className="py-3 px-5">Patron</th>
                  <th className="py-3 px-5">Origin</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Fulfilment</th>
                  <th className="py-3 px-5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DD]">
                {filteredOrders.map((o) => {
                  const isTest = isTestOrder(o);
                  const validEntitlements = (o.download_entitlements || []).filter(
                    (e: any) => e.is_active && !e.is_revoked
                  );
                  const isFulfilled = o.status === "paid" && validEntitlements.length > 0;

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
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase tracking-wider bg-[#FBF7F0] text-[#8C6D34] border border-[#EADFCB]">
                            <FlaskConical className="w-3 h-3 text-[#8C6D34]" />
                            <span>Test Mode</span>
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
                        {isFulfilled ? (
                          <span className="text-[11px] font-mono text-[#55694B] bg-[#F2F5F0] border border-[#D4DCCF] px-2 py-0.5 rounded">
                            {validEntitlements.length} Delivered (Complete)
                          </span>
                        ) : validEntitlements.length > 0 ? (
                          <span className="text-[11px] font-mono text-[#8C6D34] bg-[#FBF7F0] border border-[#EADFCB] px-2 py-0.5 rounded">
                            {validEntitlements.length} Delivered (Partial)
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono text-[#85847D] bg-[#F7F5F0] border border-[#E8E5DD] px-2 py-0.5 rounded">
                            0 Delivered (Pending)
                          </span>
                        )}
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
    </div>
  );
}
