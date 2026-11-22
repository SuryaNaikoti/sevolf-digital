import React from "react";
import { getBundles } from "@/services/products";
import { ProductCard } from "@/components/products/ProductCard";

export const metadata = {
  title: "Curated Bundles & Suites",
  description: "Complete suites of digital systems and guides combined for holistic everyday life management.",
};

export default async function BundlesPage() {
  const products = await getBundles();

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-16">
      <div className="max-w-2xl mb-12">
        <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
          COMPREHENSIVE SYSTEMS
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
          Product Bundles
        </h1>
        <p className="text-sm md:text-base text-[#77766E] leading-relaxed font-sans">
          Curated multi-part digital collections combining our flagship frameworks, planners, and templates at exceptional value.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
