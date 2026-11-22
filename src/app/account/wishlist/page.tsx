import React from "react";
import Link from "next/link";
import { PRODUCTS } from "@/services/products/mockData";
import { ProductCard } from "@/components/products/ProductCard";

export const metadata = {
  title: "My Wishlist — SEVOLF Digital",
  description: "Saved digital workbooks and systems for future study.",
};

export default function WishlistPage() {
  const wishlistItems = [PRODUCTS[1], PRODUCTS[3]]; // Mitthu's Book & Founder's Operating Suite

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-serif text-2xl font-normal text-[#292B27]">
          Saved To Wishlist ({wishlistItems.length})
        </h2>
        <p className="text-xs text-[#77766E] mt-1">
          Editions you've earmarked for your learning, home routines, or venture planning.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
        {wishlistItems.map((prod) => (
          <ProductCard key={prod.id} product={prod} />
        ))}
      </div>
    </div>
  );
}
