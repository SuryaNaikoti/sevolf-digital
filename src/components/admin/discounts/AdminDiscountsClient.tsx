"use client";

import { useState } from "react";
import { Tag, Plus, CheckCircle2, AlertCircle, X, Percent, IndianRupee } from "lucide-react";
import { useRouter } from "next/navigation";

interface CouponItem {
  id: string;
  code: string;
  discount_percent: number | null;
  discount_amount: number | null;
  valid_until: string | null;
  max_uses: number | null;
  times_used: number;
  is_active: boolean;
  created_at: string;
}

interface AdminDiscountsClientProps {
  initialCoupons: CouponItem[];
}

export default function AdminDiscountsClient({ initialCoupons }: AdminDiscountsClientProps) {
  const router = useRouter();
  const [coupons, setCoupons] = useState<CouponItem[]>(initialCoupons);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [formData, setFormData] = useState({
    code: "",
    discountType: "percent" as "percent" | "fixed",
    discount_percent: "15",
    discount_amount: "",
    max_uses: "100",
  });

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: formData.code,
          discount_percent: formData.discountType === "percent" ? Number(formData.discount_percent) : null,
          discount_amount: formData.discountType === "fixed" ? Number(formData.discount_amount) : null,
          max_uses: formData.max_uses ? Number(formData.max_uses) : null,
          is_active: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create coupon");

      setFeedback({ type: "success", message: `Coupon code "${data.coupon.code}" created successfully!` });
      setCoupons((prev) => [data.coupon, ...prev]);
      setIsModalOpen(false);
      setFormData({
        code: "",
        discountType: "percent",
        discount_percent: "15",
        discount_amount: "",
        max_uses: "100",
      });
      router.refresh();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (coupon: CouponItem) => {
    try {
      const res = await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: coupon.id, is_active: !coupon.is_active }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update coupon");

      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
      );
      setFeedback({
        type: "success",
        message: `Coupon ${coupon.code} is now ${!coupon.is_active ? "Active" : "Inactive"}.`,
      });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  return (
    <div className="space-y-4">
      {/* Alert feedback */}
      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs flex items-center justify-between ${
            feedback.type === "success"
              ? "bg-[#E3F1DF] border-[#C3E6BD] text-[#008060]"
              : "bg-[#FFF4F4] border-[#FED2D2] text-[#D72C0D]"
          }`}
        >
          <div className="flex items-center space-x-2">
            {feedback.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-current opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Discounts & Promotions</h1>
          <p className="text-xs text-[#6D7175]">
            Manage promotional coupon codes, percentage discounts, usage limits, and campaign rules.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-1.5 bg-[#008060] hover:bg-[#006e52] text-white text-xs font-semibold rounded-md shadow-2xs transition-colors flex items-center space-x-1.5 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create Discount</span>
        </button>
      </div>

      {/* Discounts Table Card */}
      <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E1E3E5] bg-[#FAFBFB] text-[#6D7175] font-medium">
                <th className="py-2.5 px-4">Coupon Code</th>
                <th className="py-2.5 px-4">Type / Value</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Usage Count</th>
                <th className="py-2.5 px-4">Max Uses</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E3E5]">
              {coupons.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#6D7175]">
                    No promotional coupons created yet. Click "Create Discount" to add a new draft code.
                  </td>
                </tr>
              ) : (
                coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-[#F6F6F7]/80 transition-colors">
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2">
                        <Tag className="w-3.5 h-3.5 text-[#008060]" />
                        <span className="font-mono font-bold text-[#202223]">{c.code}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-[#202223]">
                      {c.discount_percent ? `${c.discount_percent}% OFF` : `₹${c.discount_amount} OFF`}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider ${
                          c.is_active ? "bg-[#E3F1DF] text-[#008060]" : "bg-[#F1F2F3] text-[#6D7175]"
                        }`}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-[#6D7175]">{c.times_used} uses</td>
                    <td className="py-3 px-4 font-mono text-[#6D7175]">{c.max_uses || "Unlimited"}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleToggleStatus(c)}
                        className="text-xs text-[#008060] hover:underline font-medium"
                      >
                        {c.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-3 border-t border-[#E1E3E5] bg-[#FAFBFB] flex items-center justify-between text-xs text-[#6D7175]">
          <span>{coupons.length} promotional code(s) registered</span>
          <span className="text-[11px] font-mono text-[#008060]">Persisted to Database</span>
        </div>
      </div>

      {/* Create Coupon Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg border border-[#E1E3E5] shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#E1E3E5]">
              <div className="flex items-center space-x-2">
                <Tag className="w-4 h-4 text-[#008060]" />
                <h3 className="text-sm font-bold text-[#202223]">Create Discount Code</h3>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-[#6D7175] hover:text-[#202223]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-[#202223] mb-1">Coupon Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. FOUNDER15"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""),
                    }))
                  }
                  className="w-full bg-white border border-[#BABFC3] rounded px-3 py-1.5 font-mono uppercase text-[#202223] focus:border-[#008060] focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-[#202223] mb-1">Discount Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, discountType: "percent" }))}
                    className={`py-2 px-3 rounded border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
                      formData.discountType === "percent"
                        ? "bg-[#E3F1DF] border-[#008060] text-[#008060]"
                        : "bg-white border-[#BABFC3] text-[#6D7175]"
                    }`}
                  >
                    <Percent className="w-3.5 h-3.5" />
                    <span>Percentage</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, discountType: "fixed" }))}
                    className={`py-2 px-3 rounded border text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors ${
                      formData.discountType === "fixed"
                        ? "bg-[#E3F1DF] border-[#008060] text-[#008060]"
                        : "bg-white border-[#BABFC3] text-[#6D7175]"
                    }`}
                  >
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span>Fixed Amount</span>
                  </button>
                </div>
              </div>

              {formData.discountType === "percent" ? (
                <div>
                  <label className="block font-semibold text-[#202223] mb-1">Discount Percentage (%) *</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formData.discount_percent}
                    onChange={(e) => setFormData((prev) => ({ ...prev, discount_percent: e.target.value }))}
                    className="w-full bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] font-mono focus:border-[#008060] focus:outline-hidden"
                  />
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-[#202223] mb-1">Discount Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.discount_amount}
                    onChange={(e) => setFormData((prev) => ({ ...prev, discount_amount: e.target.value }))}
                    className="w-full bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] font-mono focus:border-[#008060] focus:outline-hidden"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-[#202223] mb-1">Maximum Uses</label>
                <input
                  type="number"
                  min="1"
                  placeholder="100"
                  value={formData.max_uses}
                  onChange={(e) => setFormData((prev) => ({ ...prev, max_uses: e.target.value }))}
                  className="w-full bg-white border border-[#BABFC3] rounded px-3 py-1.5 text-[#202223] font-mono focus:border-[#008060] focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#E1E3E5]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 border border-[#BABFC3] rounded bg-white text-[#202223] font-semibold hover:bg-[#F6F6F7]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 bg-[#008060] hover:bg-[#006e52] text-white font-semibold rounded shadow-2xs disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Save Coupon"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
