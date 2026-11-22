import React from "react";
import { getNewArrivals } from "@/services/products";
import { ProductCard } from "@/components/products/ProductCard";

export const metadata = {
  title: "New Arrivals",
  description: "Recent digital releases and latest editions from SEVOLF Digital.",
};

export default async function NewArrivalsPage() {
  const products = await getNewArrivals(12);

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-16">
      <div className="max-w-2xl mb-12">
        <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
          FRESH RELEASES
        </span>
        <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
          New Arrivals
        </h1>
        <p className="text-sm md:text-base text-[#77766E] leading-relaxed font-sans">
          The newest thoughtful digital workbooks, planning tools, and lifestyle resources to arrive at SEVOLF Digital.
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
