import { Layers, Boxes, CalendarClock, Star, Clock, ArrowLeft } from "lucide-react";
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
    <div className="space-y-4">
      <AdminPageHeader
        title={title}
        subtitle="This module is planned and architected but deferred from primary navigation in staging review."
        actions={
          <AdminButton variant="secondary" icon={ArrowLeft}>
            <Link href="/admin" className="flex items-center space-x-1.5">
              <span>Return to Overview</span>
            </Link>
          </AdminButton>
        }
      />

      <AdminCard>
        <AdminEmptyState
          icon={Icon}
          title={`${title} Module Deferred`}
          description={description}
          action={
            <div className="text-xs text-[#6D7175] bg-[#FAFBFB] p-3 rounded border border-[#E1E3E5] max-w-md mx-auto">
              <strong className="text-[#202223] block mb-1">Prerequisite for Activation:</strong>
              {prerequisite}
            </div>
          }
        />
      </AdminCard>
    </div>
  );
}
