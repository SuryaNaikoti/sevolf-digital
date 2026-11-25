"use client";

import React, { useEffect, useState } from "react";
import {
  CreditCard,
  ShieldCheck,
  Search,
  RefreshCw,
  ExternalLink,
  FlaskConical,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui/AdminComponents";
import { isTestTransaction, classifyTransactionEnvironment } from "@/lib/commerce/transactionClassifier";

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

  const isTestPayment = (p: PaymentRecord) => {
    return isTestTransaction(p);
  };

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
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Payments & Ledger"
        subtitle="Cryptographically verified gateway transactions, webhook receipts, and line-item captures."
        badge={{ text: `${payments.length} Transactions`, variant: "neutral" }}
        actions={
          <AdminButton
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchPayments}
            disabled={loading}
          >
            Refresh Ledger
          </AdminButton>
        }
      />

      {/* Main Table Card */}
      <AdminCard padding={false}>
        {/* Controls Bar */}
        <div className="p-4 sm:p-5 border-b border-[#E8E5DD] flex items-center justify-between bg-[#FDFCFA]">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#85847D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by gateway ID, transaction ID, email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs font-sans bg-white border border-[#E8E5DD] rounded-md pl-8 pr-3 py-1.5 text-[#22231F] placeholder-[#85847D] focus:outline-hidden focus:border-[#85866A]"
            />
          </div>
          <span className="text-[11px] font-mono text-[#85847D] uppercase tracking-wider hidden sm:inline">
            HMAC Verified Webhooks
          </span>
        </div>

        {/* Content Table or Empty State */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#85847D] font-mono">
            Loading payment records from database...
          </div>
        ) : filteredPayments.length === 0 ? (
          <AdminEmptyState
            icon={CreditCard}
            title="No Payment Records"
            description="Verified gateway captures and customer transactions will populate here once live payments are processed."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Transaction ID</th>
                  <th className="py-3 px-5">Order #</th>
                  <th className="py-3 px-5">Gateway</th>
                  <th className="py-3 px-5">Environment</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Amount Captured</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DD]">
                {filteredPayments.map((p) => {
                  const isTest = isTestPayment(p);
                  return (
                    <tr key={p.id} className="hover:bg-[#FAF8F5] transition-colors">
                      <td className="py-3.5 px-5 font-mono text-[11px] text-[#22231F]">
                        {p.gateway_transaction_id || p.id}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-[#22231F]">
                        {p.orders?.order_number || "—"}
                      </td>
                      <td className="py-3.5 px-5 uppercase font-mono text-[11px] text-[#85847D]">
                        {p.gateway}
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
                        <AdminStatusBadge variant={p.status === "captured" ? "success" : "warning"}>
                          {p.status}
                        </AdminStatusBadge>
                      </td>
                      <td className="py-3.5 px-5 text-right font-serif text-sm font-medium text-[#22231F]">
                        ₹{p.amount}
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
