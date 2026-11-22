import React from "react";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/services/products";
import { ProductDetailClient } from "@/components/products/ProductDetailClient";

interface ProductSlugPageProps {
  params: Promise<{
    slug: string;
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

export default async function ProductDetailPage({ params }: ProductSlugPageProps) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    notFound();
  }

  const relatedProducts = await getRelatedProducts(product.id, 3);

  return <ProductDetailClient product={product} relatedProducts={relatedProducts} />;
}
