import { createAdminClient } from "@/lib/supabase/admin";
import AdminCollectionsClient from "@/components/admin/collections/AdminCollectionsClient";

export default async function AdminCollectionsPage() {
  let collections: any[] = [];
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("product_collections")
      .select("*")
      .order("display_order", { ascending: true });
    if (data) collections = data;
  } catch (err) {
    console.error("Failed to load collections:", err);
  }

  return <AdminCollectionsClient initialCollections={collections} />;
}
