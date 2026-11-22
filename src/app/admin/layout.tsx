import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";

export const metadata = {
  title: "SEVOLF Control Center | Administration",
  description: "Enterprise administration suite for SEVOLF Digital Product Studio.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
