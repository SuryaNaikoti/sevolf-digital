import AdminDeferredModulePage from "@/components/admin/ui/AdminDeferredModulePage";
import { Boxes } from "lucide-react";

export default function InventoryPage() {
  return (
    <AdminDeferredModulePage
      title="Inventory Management"
      description="Digital products do not deplete physical inventory units. Multi-license seat quotas and SKU availability controls will be introduced here in Phase 3."
      prerequisite="Requires multi-license seat tier configuration in product catalogue."
      icon={Boxes}
    />
  );
}
