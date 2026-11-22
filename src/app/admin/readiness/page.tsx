import { LAUNCH_READINESS_CHECKLIST, LaunchReadinessItem } from "@/services/admin/readiness";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  ShieldAlert,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";

export default function LaunchReadinessPage() {
  const readyCount = LAUNCH_READINESS_CHECKLIST.filter((i) => i.status === "ready").length;
  const totalCount = LAUNCH_READINESS_CHECKLIST.length;
  const isReady = readyCount === totalCount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-[#202223] tracking-tight">Launch Readiness Center</h1>
        <p className="text-xs text-[#6D7175]">
          Operational verification gate enforcing fail-closed compliance across security, payment, and fulfillment.
        </p>
      </div>

      {/* Main Status Banner */}
      <div
        className={`rounded-lg border p-5 shadow-2xs ${
          isReady
            ? "bg-emerald-50 border-emerald-200 text-emerald-950"
            : "bg-amber-50 border-amber-200 text-amber-950"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                isReady ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[#202223]">
                {isReady ? "All Pre-Launch Gates Clear" : "Production Launch Blocked (Safe Gate Enforced)"}
              </h2>
              <p className="text-xs text-[#6D7175] mt-0.5 max-w-2xl leading-normal">
                {isReady
                  ? "Every operational, financial, and digital delivery requirement has passed independent verification."
                  : "Live customer transactions and production pricing remain blocked until disconnected external providers (Razorpay, Resend) are securely configured."}
              </p>
            </div>
          </div>

          <div className="flex items-baseline space-x-1.5 bg-white px-3 py-1.5 rounded-md border border-[#BABFC3] shrink-0 shadow-2xs">
            <span className="text-lg font-bold text-[#202223] font-mono">
              {readyCount}
            </span>
            <span className="text-xs text-[#6D7175] font-mono">/ {totalCount} Ready</span>
          </div>
        </div>
      </div>

      {/* Checklist Table Card */}
      <div className="bg-white border border-[#E1E3E5] rounded-lg overflow-hidden shadow-2xs">
        <div className="px-4 py-3 border-b border-[#E1E3E5] flex items-center justify-between bg-[#FAFBFB]">
          <h3 className="text-xs font-semibold text-[#202223] uppercase tracking-wider font-mono">
            Operational Verification Gates
          </h3>
          <span className="text-xs text-[#6D7175] font-mono">
            Fail-Closed Enforced
          </span>
        </div>

        <div className="divide-y divide-[#E1E3E5]">
          {LAUNCH_READINESS_CHECKLIST.map((item) => (
            <div
              key={item.id}
              className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 hover:bg-[#F6F6F7]/60 transition-colors"
            >
              <div className="space-y-0.5 max-w-2xl text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono uppercase font-semibold px-1.5 py-0.2 rounded bg-[#F6F6F7] text-[#6D7175] border border-[#E1E3E5]">
                    {item.category}
                  </span>
                  <h4 className="font-semibold text-[#202223]">{item.title}</h4>
                </div>
                <p className="text-[#6D7175]">{item.description}</p>
                <p className="text-[#202223] font-mono text-[11px] mt-0.5">{item.details}</p>
              </div>

              <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
                <StatusBadge status={item.status} />
                {item.actionUrl && (
                  <Link
                    href={item.actionUrl}
                    className="p-1.5 rounded border border-[#BABFC3] bg-white hover:bg-[#F6F6F7] text-[#5C5F62] hover:text-[#202223] transition-colors"
                    title="Configure gate"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LaunchReadinessItem["status"] }) {
  switch (status) {
    case "ready":
      return (
        <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
          <span>READY</span>
        </span>
      );
    case "not_connected":
      return (
        <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-amber-50 text-amber-800 border border-amber-200">
          <AlertCircle className="w-3 h-3 text-amber-600" />
          <span>DISCONNECTED</span>
        </span>
      );
    case "incomplete":
      return (
        <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-stone-100 text-stone-700 border border-stone-200">
          <HelpCircle className="w-3 h-3" />
          <span>INCOMPLETE</span>
        </span>
      );
    case "blocked":
      return (
        <span className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-red-50 text-red-800 border border-red-200">
          <XCircle className="w-3 h-3 text-red-600" />
          <span>BLOCKED</span>
        </span>
      );
    default:
      return null;
  }
}
