import AdminDeferredModulePage from "@/components/admin/ui/AdminDeferredModulePage";
import { FileSpreadsheet } from "lucide-react";

export default function DraftOrdersPage() {
  return (
    <AdminDeferredModulePage
      title="Draft Orders"
      description="Create orders on behalf of VIP clients, custom corporate licenses, and institutional purchasers with manual invoice generation."
      prerequisite="Requires corporate invoice generation and manual B2B payment capture support."
      icon={FileSpreadsheet}
    />
  );
}
