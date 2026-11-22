import { getAdminProductBySlug } from "@/services/admin/products";
import { notFound } from "next/navigation";
import ProductEditorClient from "@/components/admin/products/ProductEditorClient";

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

export default async function AdminProductDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const product = await getAdminProductBySlug(slug);

  if (!product) {
    notFound();
  }

  return <ProductEditorClient product={product} />;
}
