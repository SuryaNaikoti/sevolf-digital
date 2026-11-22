import AdminDeferredModulePage from "@/components/admin/ui/AdminDeferredModulePage";
import { CalendarClock } from "lucide-react";

export default function SubscriptionsPage() {
  return (
    <AdminDeferredModulePage
      title="Recurring Subscriptions"
      description="Monthly digital template clubs, educational workbooks, and recurring resource passes."
      prerequisite="Deferred until recurring payment integration (Razorpay Subscriptions or Stripe Billing) is certified and tested."
      icon={CalendarClock}
    />
  );
}
