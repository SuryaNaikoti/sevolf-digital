"use client";

import React, { useEffect, useState } from "react";
import {
  CreditCard,
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";

interface PaymentRecord {
  id: string;
  order_id: string;
  gateway: string;
  gateway_transaction_id: string;
  gateway_order_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  orders?: {
    id: string;
    order_number: string;
    customer_email: string;
    customer_name: string;
    status: string;
  };
}

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchPayments = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/payments");
      if (!res.ok) {
        throw new Error(`Failed to load payment records: HTTP ${res.status}`);
      }
      const data = await res.json();
      setPayments(data.payments || []);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred loading payment ledger.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, []);

  const filteredPayments = payments.filter((p) => {
    const term = search.toLowerCase();
    return (
      (p.gateway_transaction_id || "").toLowerCase().includes(term) ||
      (p.gateway_order_id || "").toLowerCase().includes(term) ||
      (p.orders?.order_number || "").toLowerCase().includes(term) ||
      (p.orders?.customer_email || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Payments & Ledger</h1>
          <p className="text-xs text-[#6D7175]">
            Cryptographically verified gateway transactions, webhook receipts, and line-item captures.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            HMAC-SHA256 Verification Active
          </span>
          <button
            onClick={fetchPayments}
            className="flex items-center space-x-1 px-3 py-1 bg-white border border-[#BABFC3] rounded-md text-xs font-semibold text-[#202223] hover:bg-[#F6F6F7] shadow-2xs transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6D7175] ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Ledger Card */}
      <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
        <div className="p-3 bg-[#FAFBFB] border-b border-[#E1E3E5] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#8C9196] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by transaction ID, order #, or email..."
              className="w-full text-xs bg-white border border-[#BABFC3] rounded pl-8 pr-3 py-1.5 text-[#202223] placeholder-[#8C9196] focus:outline-hidden focus:border-[#202223]"
            />
          </div>
          <span className="text-xs text-[#6D7175] font-mono">
            {filteredPayments.length} of {payments.length} ledger records
          </span>
        </div>

        {/* Content States */}
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-[#8C9196] animate-spin mx-auto" />
            <p className="text-xs text-[#6D7175]">Loading payment ledger from database...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="text-sm font-semibold text-[#202223]">Unable to load payments</h3>
            <p className="text-xs text-[#6D7175] max-w-sm mx-auto">{error}</p>
            <button
              onClick={fetchPayments}
              className="px-3 py-1.5 bg-[#202223] text-white text-xs font-semibold rounded-md"
            >
              Retry
            </button>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#F6F6F7] border border-[#E1E3E5] mx-auto flex items-center justify-center text-[#6D7175]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#202223]">No payment transactions found</h3>
              <p className="text-xs text-[#6D7175] max-w-sm mx-auto">
                {search
                  ? "No payments match the search criteria."
                  : "Production payments remain safely disabled. When active checkout occurs, verified Razorpay payment receipts will be recorded here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAFBFB] text-[#6D7175] border-b border-[#E1E3E5] font-medium font-mono text-[11px]">
                  <th className="py-2.5 px-4">Transaction ID</th>
                  <th className="py-2.5 px-4">Gateway</th>
                  <th className="py-2.5 px-4">Order #</th>
                  <th className="py-2.5 px-4">Customer</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E3E5]">
                {filteredPayments.map((p) => {
                  const isCaptured = p.status === "captured" || p.status === "paid";
                  return (
                    <tr key={p.id} className="hover:bg-[#FAFBFB] transition-colors">
                      <td className="py-3 px-4 font-mono font-medium text-[#202223]">
                        {p.gateway_transaction_id || p.id.slice(0, 12)}
                      </td>
                      <td className="py-3 px-4 uppercase font-mono text-[11px] text-[#6D7175]">
                        {p.gateway || "Razorpay"}
                      </td>
                      <td className="py-3 px-4 font-mono text-[#202223]">
                        {p.orders?.order_number || (p.order_id ? p.order_id.slice(0, 8) : "—")}
                      </td>
                      <td className="py-3 px-4 text-[#6D7175]">
                        {p.orders?.customer_email || "Anonymous"}
                      </td>
                      <td className="py-3 px-4 text-[#6D7175]">
                        {new Date(p.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium font-mono ${
                            isCaptured
                              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                              : "bg-amber-50 text-amber-800 border border-amber-200"
                          }`}
                        >
                          {isCaptured ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Captured</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>{p.status}</span>
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-[#202223]">
                        {p.currency} {Number(p.amount).toLocaleString()}
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
