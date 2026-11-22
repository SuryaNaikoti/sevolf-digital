"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Download, ShoppingBag, ArrowRight, RefreshCw } from "lucide-react";

export default function OrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/account/library")
      .then((r) => r.json())
      .then((data) => {
        setOrders(data.orders || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-normal text-[#292B27]">
          Order History
        </h2>
        <p className="text-xs text-[#77766E] mt-1">
          Review previous digital purchases, receipts, and order statuses.
        </p>
      </div>

      {loading ? (
        <div className="p-12 text-center space-y-2 bg-[#F5F2EB]/50 border border-[#DDD8CD] rounded-sm">
          <RefreshCw className="w-6 h-6 text-[#657052] animate-spin mx-auto" />
          <p className="text-xs text-[#77766E]">Loading order history...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="p-12 text-center space-y-4 bg-white border border-[#DDD8CD] rounded-sm">
          <ShoppingBag className="w-8 h-8 text-[#8C9196] mx-auto" />
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#292B27]">No orders placed yet</h3>
            <p className="text-xs text-[#77766E] max-w-sm mx-auto">
              Your historical purchases and digital download entitlements will be listed here.
            </p>
          </div>
          <Link
            href="/shop"
            className="inline-block bg-[#292B27] hover:bg-[#657052] text-white px-6 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="border border-[#DDD8CD] rounded-sm divide-y divide-[#DDD8CD]">
          {orders.map((order) => {
            const isPaid = order.status === "paid" || order.payment_status === "paid";
            return (
              <div key={order.id} className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <span className="font-serif text-lg font-medium text-[#292B27]">{order.order_number}</span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        isPaid
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-amber-50 text-amber-800 border border-amber-200"
                      }`}
                    >
                      {isPaid ? "Paid & Fulfilled" : "Pending Payment"}
                    </span>
                  </div>
                  <p className="text-xs text-[#77766E]">
                    Ordered on {new Date(order.created_at).toLocaleDateString()} • Total:{" "}
                    <strong className="text-[#292B27]">
                      {order.currency || "INR"} {Number(order.total_amount).toLocaleString()}
                    </strong>
                  </p>
                  <div className="text-xs text-[#292B27] pt-1">
                    {(order.order_items || []).map((i: any) => i.product_name).join(", ")}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/order/success?orderId=${order.id}`}
                    className="bg-[#292B27] hover:bg-[#657052] text-white px-4 py-2 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>View Downloads</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
