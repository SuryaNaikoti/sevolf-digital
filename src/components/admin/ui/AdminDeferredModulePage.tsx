import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import {
  AdminPageHeader,
  AdminCard,
  AdminButton,
  AdminEmptyState,
} from "@/components/admin/ui/AdminComponents";

export default function AdminDeferredModulePage({
  title,
  description,
  prerequisite,
  icon: Icon,
}: {
  title: string;
  description: string;
  prerequisite: string;
  icon: any;
}) {
  return (
    <div className="space-y-6 max-w-5xl">
      <AdminPageHeader
        title={title}
        subtitle="This studio module is architected and reserved for post-launch activation."
        actions={
          <Link href="/admin">
            <AdminButton variant="secondary" icon={ArrowLeft}>
              Return to Overview
            </AdminButton>
          </Link>
        }
      />

      <AdminCard>
        <AdminEmptyState
          icon={Icon}
          title={`${title} Module Reserved`}
          description={description}
          action={
            <div className="text-xs text-[#85847D] bg-[#FAF8F5] p-4 rounded-lg border border-[#E8E5DD] max-w-md mx-auto text-left space-y-1">
              <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-[#22231F] block">
                Prerequisite for Live Activation:
              </span>
              <p className="font-sans leading-relaxed text-[#22231F]">{prerequisite}</p>
            </div>
          }
        />
      </AdminCard>
    </div>
  );
}
