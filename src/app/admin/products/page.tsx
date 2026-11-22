import { getAdminProducts } from "@/services/admin/products";
import AdminProductsClient from "@/components/admin/products/AdminProductsClient";

export default async function AdminProductsPage() {
  const products = await getAdminProducts();
  return <AdminProductsClient initialProducts={products} />;
}
