import React from "react";
import { getBestsellers } from "@/services/products";
import { ProductCard } from "@/components/products/ProductCard";

export const metadata = {
  title: "Bestsellers",
  description: "Most appreciated and widely adopted digital publications from SEVOLF.",
};

export default async function BestsellersPage() {
  const products = await getBestsellers(12);

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-16">
      <div className="max-w-2xl mb-12">
        <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
          MOST APPRECIATED
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
          Bestsellers
        </h1>
        <p className="text-sm md:text-base text-[#77766E] leading-relaxed font-sans">
          Proven resources embraced by thousands of customers seeking clarity, calm, and intentional execution in their day-to-day lives.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  );
}
