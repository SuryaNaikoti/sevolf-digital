import { redirect } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";
import { getLaunchReadinessChecklist } from "@/services/admin/readiness";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SEVOLF Control Center | Administration",
  description: "Enterprise administration suite for SEVOLF Digital Product Studio.",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await requireAdminSession();

  if (!auth.success) {
    // Inspect failure status code to route appropriately
    // 401 Unauthorized -> redirect to login with redirect param
    // 403 Forbidden (customer account or non-admin) -> redirect safely to /account
    const status = auth.response.status;
    if (status === 401) {
      redirect("/login?redirect=/admin");
    } else {
      redirect("/account");
    }
  }

  const checklist = await getLaunchReadinessChecklist();
  const isLaunchReady = checklist.every((i) => i.status === "ready");

  return <AdminLayoutClient isLaunchReady={isLaunchReady}>{children}</AdminLayoutClient>;
}
