import { createAdminClient } from "@/lib/supabase/admin";
import AdminDiscountsClient from "@/components/admin/discounts/AdminDiscountsClient";

export default async function AdminDiscountsPage() {
  let coupons: any[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("coupons")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) coupons = data;
  } catch (err) {
    console.error("Failed to load coupons:", err);
  }

  return <AdminDiscountsClient initialCoupons={coupons} />;
}
