"use client";

import React, { useEffect, useState } from "react";
import {
  ShoppingCart,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Calendar,
  AlertCircle,
  RefreshCw,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

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

  const filteredOrders = orders.filter((o) => {
    const matchesSearch =
      (o.order_number || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_email || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name || "").toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === "all") return true;
    if (statusFilter === "paid") return o.status === "paid" || o.payment_status === "paid";
    if (statusFilter === "unpaid") return o.status === "pending" || o.payment_status === "pending";
    if (statusFilter === "unfulfilled") return (o.download_entitlements || []).length === 0;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Orders</h1>
          <p className="text-xs text-[#6D7175]">
            Real-time customer transactions, payment ledger states, and digital download entitlements.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={fetchOrders}
            className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#BABFC3] bg-white text-[#202223] text-xs font-semibold rounded-md shadow-2xs hover:bg-[#F6F6F7] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6D7175] ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Orders Table Container */}
      <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
        {/* Table Filter Tabs */}
        <div className="border-b border-[#E1E3E5]">
          <div className="flex items-center space-x-4 px-4 pt-2 text-xs font-medium text-[#6D7175]">
            <button
              onClick={() => setStatusFilter("all")}
              className={`pb-2 transition-colors ${
                statusFilter === "all"
                  ? "text-[#202223] font-semibold border-b-2 border-[#202223]"
                  : "hover:text-[#202223]"
              }`}
            >
              All ({orders.length})
            </button>
            <button
              onClick={() => setStatusFilter("paid")}
              className={`pb-2 transition-colors ${
                statusFilter === "paid"
                  ? "text-[#202223] font-semibold border-b-2 border-[#202223]"
                  : "hover:text-[#202223]"
              }`}
            >
              Paid
            </button>
            <button
              onClick={() => setStatusFilter("unpaid")}
              className={`pb-2 transition-colors ${
                statusFilter === "unpaid"
                  ? "text-[#202223] font-semibold border-b-2 border-[#202223]"
                  : "hover:text-[#202223]"
              }`}
            >
              Unpaid
            </button>
            <button
              onClick={() => setStatusFilter("unfulfilled")}
              className={`pb-2 transition-colors ${
                statusFilter === "unfulfilled"
                  ? "text-[#202223] font-semibold border-b-2 border-[#202223]"
                  : "hover:text-[#202223]"
              }`}
            >
              Unfulfilled
            </button>
          </div>

          <div className="p-3 bg-[#FAFBFB] border-t border-[#E1E3E5] flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="w-3.5 h-3.5 text-[#8C9196] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by order #, email, or customer name..."
                className="w-full text-xs bg-white border border-[#BABFC3] rounded pl-8 pr-3 py-1.5 text-[#202223] placeholder-[#8C9196] focus:outline-hidden focus:border-[#202223]"
              />
            </div>
            <div className="text-xs text-[#6D7175] font-mono">
              Showing {filteredOrders.length} of {orders.length} orders
            </div>
          </div>
        </div>

        {/* Content States */}
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-[#8C9196] animate-spin mx-auto" />
            <p className="text-xs text-[#6D7175]">Loading verified orders from database...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="text-sm font-semibold text-[#202223]">Unable to load orders</h3>
            <p className="text-xs text-[#6D7175] max-w-sm mx-auto">{error}</p>
            <button
              onClick={fetchOrders}
              className="px-3 py-1.5 bg-[#202223] text-white text-xs font-semibold rounded-md"
            >
              Retry
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#F6F6F7] border border-[#E1E3E5] mx-auto flex items-center justify-center text-[#6D7175]">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#202223]">No orders found</h3>
              <p className="text-xs text-[#6D7175] max-w-sm mx-auto">
                {search || statusFilter !== "all"
                  ? "No orders match the current filter or search criteria."
                  : "When customers complete checkout via Razorpay, paid orders and download entitlement tokens will automatically appear here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAFBFB] text-[#6D7175] border-b border-[#E1E3E5] font-medium font-mono text-[11px]">
                  <th className="py-2.5 px-4">Order</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Items</th>
                  <th className="py-2.5 px-4">Payment</th>
                  <th className="py-2.5 px-4">Fulfilment</th>
                  <th className="py-2.5 px-4 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E3E5]">
                {filteredOrders.map((order) => {
                  const isPaid = order.status === "paid" || order.payment_status === "paid";
                  const entitlementCount = (order.download_entitlements || []).length;

                  return (
                    <tr key={order.id} className="hover:bg-[#FAFBFB] transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-[#202223]">
                        {order.order_number || order.id.slice(0, 8)}
                        {order.is_sandbox && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] bg-amber-50 text-amber-700 border border-amber-200 uppercase font-mono">
                            Sandbox
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-[#6D7175]">
                        {new Date(order.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-[#202223]">{order.customer_name || "Guest"}</div>
                        <div className="text-[11px] text-[#6D7175] font-mono">{order.customer_email}</div>
                      </td>
                      <td className="py-3 px-4">
                        {(order.order_items || []).length > 0 ? (
                          <span className="text-[#202223]">
                            {order.order_items[0].product_name}
                            {order.order_items.length > 1 && ` (+${order.order_items.length - 1} more)`}
                          </span>
                        ) : (
                          <span className="text-[#8C9196] italic">Digital product</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono ${
                            isPaid
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {isPaid ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Paid</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono ${
                            entitlementCount > 0
                              ? "bg-sky-50 text-sky-800 border border-sky-200"
                              : "bg-[#F6F6F7] text-[#6D7175] border border-[#E1E3E5]"
                          }`}
                        >
                          <Download className="w-3 h-3" />
                          <span>{entitlementCount > 0 ? `${entitlementCount} Assets Ready` : "Unfulfilled"}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#202223]">
                        {order.currency || "INR"} {Number(order.total_amount || 0).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
