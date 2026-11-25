"use client";

import { useState } from "react";
import { Tag, Plus, CheckCircle2, AlertCircle, X, Percent, IndianRupee } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui/AdminComponents";

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
      if (!res.ok) throw new Error("Failed to update status");
      setCoupons((prev) =>
        prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !coupon.is_active } : c))
      );
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message });
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Discounts & Coupons"
        subtitle="Manage promotional discount codes, percentage vouchers, and customer redemption limits."
        badge={{ text: `${coupons.length} Active Codes`, variant: "neutral" }}
        actions={
          <AdminButton variant="primary" icon={Plus} onClick={() => setIsModalOpen(true)}>
            Create Coupon
          </AdminButton>
        }
      />

      {feedback && (
        <div
          className={`p-4 rounded-lg text-xs flex items-center space-x-2.5 border ${
            feedback.type === "success"
              ? "bg-[#F2F5F0] border-[#D4DCCF] text-[#55694B]"
              : "bg-[#FDF4F3] border-[#F0D0CD] text-[#9A423B]"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Coupons Table Card */}
      <AdminCard padding={false}>
        {coupons.length === 0 ? (
          <AdminEmptyState
            icon={Tag}
            title="No Coupons Configured"
            description="Create promotional discount vouchers to offer percentage or fixed discounts during checkout."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DD] bg-[#FAF8F5] text-[#85847D] font-mono uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-5">Coupon Code</th>
                  <th className="py-3 px-5">Discount Value</th>
                  <th className="py-3 px-5">Redemptions</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DD]">
                {coupons.map((c) => (
                  <tr key={c.id} className="hover:bg-[#FAF8F5] transition-colors">
                    <td className="py-3.5 px-5 font-mono font-medium text-[#22231F]">
                      {c.code}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[#22231F]">
                      {c.discount_percent ? `${c.discount_percent}% off` : `₹${c.discount_amount} off`}
                    </td>
                    <td className="py-3.5 px-5 font-mono text-[11px] text-[#85847D]">
                      {c.times_used} / {c.max_uses ? `${c.max_uses} max` : "unlimited"}
                    </td>
                    <td className="py-3.5 px-5">
                      <AdminStatusBadge variant={c.is_active ? "success" : "neutral"}>
                        {c.is_active ? "Active" : "Disabled"}
                      </AdminStatusBadge>
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <button
                        onClick={() => handleToggleStatus(c)}
                        className="text-xs font-mono uppercase tracking-wider text-[#85866A] hover:text-[#22231F] hover:underline"
                      >
                        {c.is_active ? "Deactivate" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#161715]/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8E5DD] rounded-xl max-w-md w-full overflow-hidden shadow-xl animate-in fade-in zoom-in-95">
            <div className="px-6 py-4 border-b border-[#E8E5DD] flex items-center justify-between bg-[#FDFCFA]">
              <h2 className="text-base font-serif font-normal text-[#22231F]">
                Create Discount Coupon
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-md text-[#85847D] hover:text-[#22231F]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCoupon} className="p-6 space-y-4 text-xs font-sans">
              <div>
                <label className="block text-[#22231F] font-medium mb-1">Coupon Code</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. STUDIO15"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] font-mono focus:outline-hidden focus:border-[#85866A]"
                />
              </div>

              <div>
                <label className="block text-[#22231F] font-medium mb-1">Discount Type</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: "percent" })}
                    className={`py-2 px-3 border rounded text-center font-medium ${
                      formData.discountType === "percent"
                        ? "bg-[#20211F] text-white border-[#20211F]"
                        : "bg-white border-[#E8E5DD] text-[#85847D]"
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, discountType: "fixed" })}
                    className={`py-2 px-3 border rounded text-center font-medium ${
                      formData.discountType === "fixed"
                        ? "bg-[#20211F] text-white border-[#20211F]"
                        : "bg-white border-[#E8E5DD] text-[#85847D]"
                    }`}
                  >
                    Fixed Amount (₹)
                  </button>
                </div>
              </div>

              {formData.discountType === "percent" ? (
                <div>
                  <label className="block text-[#22231F] font-medium mb-1">Percentage Off (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    required
                    value={formData.discount_percent}
                    onChange={(e) => setFormData({ ...formData, discount_percent: e.target.value })}
                    className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] font-mono focus:outline-hidden focus:border-[#85866A]"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[#22231F] font-medium mb-1">Amount Off (₹)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.discount_amount}
                    onChange={(e) => setFormData({ ...formData, discount_amount: e.target.value })}
                    className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] font-mono focus:outline-hidden focus:border-[#85866A]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[#22231F] font-medium mb-1">Max Redemptions</label>
                <input
                  type="number"
                  min="1"
                  value={formData.max_uses}
                  onChange={(e) => setFormData({ ...formData, max_uses: e.target.value })}
                  className="w-full border border-[#E8E5DD] rounded-md px-3 py-2 text-[#22231F] font-mono focus:outline-hidden focus:border-[#85866A]"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-[#E8E5DD]">
                <AdminButton
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </AdminButton>
                <AdminButton type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? "Creating..." : "Save Coupon"}
                </AdminButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
