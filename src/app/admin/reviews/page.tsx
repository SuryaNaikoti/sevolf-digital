import AdminDeferredModulePage from "@/components/admin/ui/AdminDeferredModulePage";
import { Star } from "lucide-react";

export default function ReviewsPage() {
  return (
    <AdminDeferredModulePage
      title="Customer Reviews Moderation"
      description="Approve and moderate verified purchaser feedback before publication on product detail pages."
      prerequisite="Requires product_reviews schema migration and verified purchaser checkout submissions."
      icon={Star}
    />
  );
}
