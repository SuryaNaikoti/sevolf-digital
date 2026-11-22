import { createAdminClient } from "@/lib/supabase/admin";
import AdminAssetsClient from "@/components/admin/assets/AdminAssetsClient";

export default async function AdminAssetsPage() {
  let assets: any[] = [];
  let products: any[] = [];

  try {
    const supabase = createAdminClient();
    const [assetsRes, prodsRes] = await Promise.all([
      supabase
        .from("digital_assets")
        .select(`
          *,
          products (id, name, slug, status)
        `)
        .order("created_at", { ascending: false }),
      supabase
        .from("products")
        .select("id, name, slug")
        .order("name", { ascending: true }),
    ]);

    if (assetsRes.data) assets = assetsRes.data;
    if (prodsRes.data) products = prodsRes.data;
  } catch (err) {
    console.error("Failed to load digital assets:", err);
  }

  return <AdminAssetsClient initialAssets={assets} availableProducts={products} />;
}
