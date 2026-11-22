"use client";

import React, { useEffect, useState } from "react";
import {
  Users,
  Search,
  Filter,
  Mail,
  Shield,
  RefreshCw,
  AlertCircle,
  Calendar,
  ShoppingBag,
} from "lucide-react";

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
        throw new Error(`Failed to load customers: HTTP ${res.status}`);
      }
      const data = await res.json();
      setCustomers(data.customers || []);
    } catch (err: any) {
      setError(err?.message || "An unexpected error occurred loading customer directory.");
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Customers</h1>
          <p className="text-xs text-[#6D7175]">
            Registered customer accounts, lifetime purchase totals, and patron directory.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <button
            onClick={fetchCustomers}
            className="flex items-center space-x-1.5 px-3 py-1.5 border border-[#BABFC3] bg-white text-[#202223] text-xs font-semibold rounded-md shadow-2xs hover:bg-[#F6F6F7] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#6D7175] ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Customer Registry Card */}
      <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
        <div className="p-3 bg-[#FAFBFB] border-b border-[#E1E3E5] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#8C9196] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customers by name, email, or region..."
              className="w-full text-xs bg-white border border-[#BABFC3] rounded pl-8 pr-3 py-1.5 text-[#202223] placeholder-[#8C9196] focus:outline-hidden focus:border-[#202223]"
            />
          </div>
          <span className="text-xs text-[#6D7175] font-mono">
            {filteredCustomers.length} registered profiles
          </span>
        </div>

        {/* Content States */}
        {loading ? (
          <div className="p-16 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-[#8C9196] animate-spin mx-auto" />
            <p className="text-xs text-[#6D7175]">Loading registered customers from database...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
            <h3 className="text-sm font-semibold text-[#202223]">Unable to load customers</h3>
            <p className="text-xs text-[#6D7175] max-w-sm mx-auto">{error}</p>
            <button
              onClick={fetchCustomers}
              className="px-3 py-1.5 bg-[#202223] text-white text-xs font-semibold rounded-md"
            >
              Retry
            </button>
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#F6F6F7] border border-[#E1E3E5] mx-auto flex items-center justify-center text-[#6D7175]">
              <Users className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#202223]">No customers registered</h3>
              <p className="text-xs text-[#6D7175] max-w-sm mx-auto">
                Customer profiles and purchase records will automatically populate here upon customer registration or checkout.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-[#FAFBFB] text-[#6D7175] border-b border-[#E1E3E5] font-medium font-mono text-[11px]">
                  <th className="py-2.5 px-4">Customer Name</th>
                  <th className="py-2.5 px-4">Email</th>
                  <th className="py-2.5 px-4">Role</th>
                  <th className="py-2.5 px-4">Orders</th>
                  <th className="py-2.5 px-4">Total Spent</th>
                  <th className="py-2.5 px-4">Country</th>
                  <th className="py-2.5 px-4 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E3E5]">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAFBFB] transition-colors">
                    <td className="py-3 px-4 font-medium text-[#202223]">
                      {c.fullName}
                    </td>
                    <td className="py-3 px-4 font-mono text-[#6D7175]">
                      {c.email}
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#F6F6F7] text-[#6D7175] border border-[#E1E3E5]">
                        {c.role}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-[#202223] font-medium">
                        {c.paidOrdersCount} paid ({c.ordersCount} total)
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-semibold text-[#202223]">
                      {c.currency} {Number(c.totalSpent).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-[#6D7175]">
                      {c.country}
                    </td>
                    <td className="py-3 px-4 text-right text-[#6D7175]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
