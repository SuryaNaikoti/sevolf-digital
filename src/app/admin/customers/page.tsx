"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  RefreshCw,
  Mail,
  Shield,
  ShoppingBag,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui/AdminComponents";

interface CustomerRecord {
  id: string;
  email: string;
  fullName: string;
  country: string;
  role: string;
  ordersCount: number;
  paidOrdersCount: number;
  totalSpent: number;
  currency: string;
  createdAt: string;
  lastActiveAt: string;
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchCustomers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/customers");
      if (!res.ok) {
        throw new Error(`Failed to load patrons: HTTP ${res.status}`);
      }
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred loading patron directory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = customers.filter((c) => {
    const term = search.toLowerCase();
    return (
      (c.fullName || "").toLowerCase().includes(term) ||
      (c.email || "").toLowerCase().includes(term) ||
      (c.country || "").toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Patrons & Accounts"
        subtitle="Registered customer accounts, verified orders, and customer lifetime value."
        badge={{ text: `${customers.length} Patrons`, variant: "neutral" }}
        actions={
          <AdminButton
            variant="secondary"
            icon={RefreshCw}
            onClick={fetchCustomers}
            disabled={loading}
          >
            Refresh Directory
          </AdminButton>
        }
      />

      {/* Main Table Card */}
      <AdminCard padding={false}>
        {/* Search Bar */}
        <div className="p-4 sm:p-5 border-b border-[#E8E5DD] flex items-center justify-between bg-[#FDFCFA]">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#85847D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search patrons by name, email, country..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs font-sans bg-white border border-[#E8E5DD] rounded-md pl-8 pr-3 py-1.5 text-[#22231F] placeholder-[#85847D] focus:outline-hidden focus:border-[#85866A]"
            />
          </div>
          <span className="text-[11px] font-mono text-[#85847D] uppercase tracking-wider hidden sm:inline">
            Active Directory
          </span>
        </div>

        {/* Content Table or Empty State */}
        {loading ? (
          <div className="py-16 text-center text-xs text-[#85847D] font-mono">
            Loading patron directory from database...
          </div>
        ) : filteredCustomers.length === 0 ? (
          <AdminEmptyState
            icon={Users}
            title="No Patrons Found"
            description="No customer accounts match your search query. Registered customers will appear here."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Patron</th>
                  <th className="py-3 px-5">Account Role</th>
                  <th className="py-3 px-5">Orders</th>
                  <th className="py-3 px-5">Country</th>
                  <th className="py-3 px-5 text-right">Lifetime Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DD]">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-medium text-[#22231F]">{c.fullName || "Patron"}</p>
                      <p className="text-[11px] text-[#85847D] font-mono">{c.email}</p>
                    </td>
                    <td className="py-3.5 px-5">
                      <AdminStatusBadge variant={c.role === "admin" ? "accent" : "neutral"}>
                        {c.role || "Customer"}
                      </AdminStatusBadge>
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#22231F]">
                      {c.paidOrdersCount} Paid ({c.ordersCount} Total)
                    </td>
                    <td className="py-3.5 px-5 font-sans text-[#85847D]">
                      {c.country || "India (IN)"}
                    </td>
                    <td className="py-3.5 px-5 text-right font-serif text-sm font-medium text-[#22231F]">
                      ₹{c.totalSpent.toFixed(2)}
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
