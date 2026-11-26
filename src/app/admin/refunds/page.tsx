import { RotateCcw, ShieldCheck, Lock, Search } from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminEmptyState,
} from "@/components/admin/ui/AdminComponents";

export default function AdminRefundsPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Refunds & Revocations"
        subtitle="Product-level refund processing with atomic balance enforcement and entitlement revocation."
        badge={{ text: "V13 Idempotency Engine Active", variant: "success" }}
      />

      {/* V13 Procedure Architecture Banner */}
      <div className="bg-[#FAF8F5] border border-[#E8E5DD] rounded-lg p-5 space-y-1.5 text-xs shadow-xs">
        <div className="flex items-center space-x-2 text-[#22231F]">
          <ShieldCheck className="w-4 h-4 text-[#55694B]" />
          <h2 className="font-mono uppercase tracking-wider text-[11px] font-semibold text-[#22231F]">
            Database Integrity Guarantees
          </h2>
        </div>
        <p className="text-[#85847D] leading-relaxed font-sans">
          Stored procedure <code className="bg-white px-2 py-0.5 rounded border border-[#E8E5DD] font-mono text-[11px] text-[#22231F]">process_order_refund</code> guarantees:
          (1) Gateway replay idempotency checked first,
          (2) Per-product cumulative limit checked against line items,
          (3) Standardized lock order (<code className="font-mono text-[#22231F]">download_entitlements</code> then <code className="font-mono text-[#22231F]">download_claims</code>).
        </p>
      </div>

      {/* Refunds Queue Card */}
      <AdminCard padding={false}>
        <div className="p-4 sm:p-5 border-b border-[#E8E5DD] flex items-center justify-between bg-[#FDFCFA]">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#85847D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter refunds by order or gateway ID..."
              className="w-full text-xs font-sans bg-white border border-[#E8E5DD] rounded-md pl-8 pr-3 py-1.5 text-[#22231F] placeholder-[#85847D] focus:outline-hidden focus:border-[#85866A]"
            />
          </div>
          <span className="text-[11px] font-mono text-[#85847D] uppercase tracking-wider hidden sm:inline">
            0 Disputes Active
          </span>
        </div>

        {/* Empty State */}
        <AdminEmptyState
          icon={RotateCcw}
          title="No Refunds Processed"
          description="Customer refund requests and audit trails will appear here once live customer returns occur."
        />
      </AdminCard>
    </div>
  );
}
