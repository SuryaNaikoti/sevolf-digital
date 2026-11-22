import React from "react";
import { getProducts, getCollections } from "@/services/products";
import { ShopClient } from "@/components/shop/ShopClient";

interface ShopPageProps {
  searchParams: Promise<{
    category?: string;
    sort?: "newest" | "price-asc" | "price-desc" | "featured";
    search?: string;
    format?: string;
  }>;
}

export const metadata = {
  title: "Shop All Digital Works",
  description: "Browse the complete collection of SEVOLF digital guides, interactive planners, educational workbooks, and toolkits.",
};

export default async function ShopPage({ searchParams }: ShopPageProps) {
  const params = await searchParams;
  const products = await getProducts({
    category: params.category,
    sortBy: params.sort || "featured",
    searchQuery: params.search,
    format: params.format,
  });

  const collections = await getCollections();

  return (
    <ShopClient
      products={products}
      collections={collections}
      initialCategory={params.category}
      initialFormat={params.format}
      initialSort={params.sort || "featured"}
      searchQuery={params.search}
    />
  );
}
