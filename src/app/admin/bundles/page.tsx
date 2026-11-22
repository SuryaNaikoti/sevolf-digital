import AdminDeferredModulePage from "@/components/admin/ui/AdminDeferredModulePage";
import { Boxes } from "lucide-react";

export default function BundlesPage() {
  return (
    <AdminDeferredModulePage
      title="Product Bundles"
      description="Package multiple complementary digital workbooks into single-purchase bundles with combined entitlement issuance."
      prerequisite="Requires schema validation for product_bundles in staging database."
      icon={Boxes}
    />
  );
}
