import AdminDeferredModulePage from "@/components/admin/ui/AdminDeferredModulePage";
import { Megaphone } from "lucide-react";

export default function CampaignsPage() {
  return (
    <AdminDeferredModulePage
      title="Marketing Campaigns"
      description="Orchestrate promotional launch emails, seasonal discounts, and automated abandoned-cart recovery sequences."
      prerequisite="Requires production Resend API transactional and marketing email connection."
      icon={Megaphone}
    />
  );
}
