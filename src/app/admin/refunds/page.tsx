import { RotateCcw, ShieldCheck, Lock, Search } from "lucide-react";

export default function AdminRefundsPage() {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#202223] tracking-tight">Refunds</h1>
          <p className="text-xs text-[#6D7175]">
            Product-level refund processing with atomic balance enforcement and entitlement revocation.
          </p>
        </div>

        <div className="flex items-center space-x-2 shrink-0">
          <span className="text-[11px] font-mono text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
            V13 Idempotency Engine Active
          </span>
        </div>
      </div>

      {/* V13 Procedure Architecture Banner */}
      <div className="bg-[#FAFBFB] border border-[#E1E3E5] rounded-lg p-4 space-y-1 text-xs">
        <div className="flex items-center space-x-2 text-[#202223]">
          <ShieldCheck className="w-4 h-4 text-emerald-700" />
          <h2 className="font-semibold font-mono uppercase tracking-wide text-[11px]">
            Database Integrity Guarantees
          </h2>
        </div>
        <p className="text-[#6D7175] leading-relaxed">
          Stored procedure <code className="bg-white px-1.5 py-0.5 rounded border border-[#E1E3E5] font-mono text-[11px] text-[#202223]">process_order_refund</code> guarantees:
          (1) Gateway replay idempotency checked first,
          (2) Per-product cumulative limit checked against line items,
          (3) Standardized lock order (<code className="font-mono text-[#202223]">download_entitlements</code> then <code className="font-mono text-[#202223]">download_claims</code>).
        </p>
      </div>

      {/* Refunds Queue Card */}
      <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
        <div className="p-3 bg-[#FAFBFB] border-b border-[#E1E3E5] flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-3.5 h-3.5 text-[#8C9196] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Filter refunds by order or gateway ID..."
              className="w-full text-xs bg-white border border-[#BABFC3] rounded pl-8 pr-3 py-1 text-[#202223] placeholder-[#8C9196] focus:outline-hidden focus:border-[#202223]"
            />
          </div>
          <span className="text-xs text-[#6D7175] font-mono">0 refund disputes</span>
        </div>

        {/* Empty State */}
        <div className="p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#F6F6F7] border border-[#E1E3E5] mx-auto flex items-center justify-center text-[#6D7175]">
            <RotateCcw className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-[#202223]">No refunds processed</h3>
            <p className="text-xs text-[#6D7175] max-w-sm mx-auto">
              Customer refund requests and audit trails will appear here once live customer returns occur.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
