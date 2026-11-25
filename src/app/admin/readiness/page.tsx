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
import {
  AdminPageHeader,
  AdminCard,
  AdminStatusBadge,
  AdminButton,
} from "@/components/admin/ui/AdminComponents";

export default function LaunchReadinessPage() {
  const readyCount = LAUNCH_READINESS_CHECKLIST.filter((i) => i.status === "ready").length;
  const totalCount = LAUNCH_READINESS_CHECKLIST.length;
  const isReady = readyCount === totalCount;

  return (
    <div className="space-y-8">
      {/* Header */}
      <AdminPageHeader
        title="Launch Readiness Matrix"
        subtitle="Operational verification gate enforcing fail-closed compliance across security, payment, and digital delivery."
        badge={{
          text: `${readyCount} / ${totalCount} Cleared`,
          variant: isReady ? "success" : "warning",
        }}
        actions={
          <Link href="/admin/settings">
            <AdminButton variant="secondary">
              Configure Integrations
            </AdminButton>
          </Link>
        }
      />

      {/* Main Status Banner */}
      <div
        className={`rounded-lg border p-6 shadow-xs ${
          isReady
            ? "bg-[#F2F5F0] border-[#D4DCCF] text-[#22231F]"
            : "bg-[#FBF7F0] border-[#EADFCB] text-[#22231F]"
        }`}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center space-x-4">
            <div
              className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 ${
                isReady ? "bg-[#E2EBDD] text-[#55694B]" : "bg-[#F5EAD4] text-[#8C6D34]"
              }`}
            >
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-serif font-normal text-[#22231F]">
                {isReady ? "All Pre-Launch Gates Clear" : "Production Launch Blocked (Safe Gate Enforced)"}
              </h2>
              <p className="text-xs text-[#85847D] max-w-2xl leading-relaxed font-sans">
                {isReady
                  ? "Every operational, financial, and digital delivery requirement has passed independent verification."
                  : "Live customer transactions and production pricing remain locked until external providers (Razorpay, Resend) are securely activated."}
              </p>
            </div>
          </div>

          <div className="flex items-baseline space-x-2 bg-white px-4 py-2 rounded-md border border-[#E8E5DD] shrink-0 shadow-xs">
            <span className="text-xl font-serif text-[#22231F]">
              {readyCount}
            </span>
            <span className="text-xs text-[#85847D] font-mono">/ {totalCount} Cleared</span>
          </div>
        </div>
      </div>

      {/* Checklist Table Card */}
      <AdminCard
        title="Operational Verification Gates"
        subtitle="Cryptographically verified rules & prerequisites"
        action={
          <span className="text-[11px] font-mono text-[#85847D] uppercase tracking-wider">
            Fail-Closed Enforced
          </span>
        }
        padding={false}
      >
        <div className="divide-y divide-[#E8E5DD]">
          {LAUNCH_READINESS_CHECKLIST.map((item) => (
            <div
              key={item.id}
              className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-[#FAF8F5] transition-colors"
            >
              <div className="space-y-1 max-w-2xl text-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono uppercase font-medium px-2 py-0.5 rounded bg-[#F7F5F0] text-[#7A7870] border border-[#E8E5DD]">
                    {item.category}
                  </span>
                  <h4 className="font-medium text-[#22231F] font-sans">{item.title}</h4>
                </div>
                <p className="text-[#85847D] leading-relaxed">{item.description}</p>
                <p className="text-[#22231F] font-mono text-[11px] mt-1 text-opacity-80">{item.details}</p>
              </div>

              <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
                <StatusBadge status={item.status} />
                {item.actionUrl && (
                  <Link
                    href={item.actionUrl}
                    className="p-2 rounded-md border border-[#E8E5DD] bg-white hover:bg-[#F7F5F0] text-[#85847D] hover:text-[#22231F] transition-colors shadow-xs"
                    title="Configure gate"
                  >
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

function StatusBadge({ status }: { status: LaunchReadinessItem["status"] }) {
  if (status === "ready") {
    return (
      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-medium bg-[#F2F5F0] text-[#55694B] border border-[#D4DCCF]">
        <CheckCircle2 className="w-3 h-3 text-[#55694B]" />
        <span>Ready</span>
      </span>
    );
  }

  if (status === "blocked") {
    return (
      <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-medium bg-[#FDF4F3] text-[#9A423B] border border-[#F0D0CD]">
        <XCircle className="w-3 h-3 text-[#9A423B]" />
        <span>Blocked</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-medium bg-[#FBF7F0] text-[#8C6D34] border border-[#EADFCB]">
      <AlertCircle className="w-3 h-3 text-[#8C6D34]" />
      <span>Pending</span>
    </span>
  );
}
