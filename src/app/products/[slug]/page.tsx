import React from "react";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/services/products";
import { getAdminProductBySlug } from "@/services/admin/products";
import { requireAdminSession } from "@/lib/auth/adminGate";
import { ProductDetailClient } from "@/components/products/ProductDetailClient";

interface ProductSlugPageProps {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    preview?: string;
  }>;
}

export async function generateMetadata({ params }: ProductSlugPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };

  return {
    title: product.seoTitle || product.name,
    description: product.seoDescription || product.shortDescription,
    openGraph: {
      title: product.name,
      description: product.shortDescription,
      images: [{ url: product.coverImage }],
    },
  };
}

export default async function ProductDetailPage({ params, searchParams }: ProductSlugPageProps) {
  const { slug } = await params;
  const sp = searchParams ? await searchParams : {};
  let isAdminPreview = false;
  let product = await getProductBySlug(slug);

  if (!product && sp.preview === "1") {
    const auth = await requireAdminSession();
    if (auth.success) {
      product = await getAdminProductBySlug(slug);
      isAdminPreview = Boolean(product);
    }
  }

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product.id, 3);

  return (
    <>
      {isAdminPreview && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs font-mono text-amber-900">
          Admin Preview Mode — This product is currently <strong>{product.status.toUpperCase()}</strong> and hidden from public shoppers.
        </div>
      )}
      <ProductDetailClient product={product} relatedProducts={relatedProducts} />
    </>
  );
}
