"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { Plus, Eye, Check } from "lucide-react";
import { Product } from "@/types/commerce";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { formatPrice } from "@/lib/currency";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart, items } = useCart();
  const { currency } = useCurrency();
  const [justAdded, setJustAdded] = React.useState(false);

  const isInCart = items.some(i => i.product.id === product.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <div className="group flex flex-col bg-white border border-[#DDD8CD] rounded-sm overflow-hidden transition-all duration-300 hover:border-[#657052] hover:shadow-[0_8px_24px_rgba(41,43,39,0.06)]">
      {/* Product Image / Mockup Presentation: Clickable Link to Product Detail */}
      <Link
        href={`/products/${product.slug}`}
        className="relative aspect-[4/5] bg-[#EAE5DA] overflow-hidden block focus:outline-none focus:ring-2 focus:ring-[#657052]"
        aria-label={`View details for ${product.name}`}
      >
        <Image
          src={product.coverImage}
          alt={product.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
        />

        {/* Subtle Gradient Shadow at Bottom for Contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10 pointer-events-none">
          {product.isNewArrival && (
            <span className="bg-[#292B27] text-white text-[11px] uppercase font-semibold tracking-widest px-2.5 py-1 rounded-xs shadow-xs">
              New
            </span>
          )}
          {product.isBundle && (
            <span className="bg-[#657052] text-white text-[11px] uppercase font-semibold tracking-widest px-2.5 py-1 rounded-xs shadow-xs">
              Bundle
            </span>
          )}
          {product.isBestseller && !product.isNewArrival && (
            <span className="bg-[#A5AC91] text-[#292B27] text-[11px] uppercase font-bold tracking-widest px-2.5 py-1 rounded-xs shadow-xs">
              Essential
            </span>
          )}
        </div>

        {/* Format Indicator Badge */}
        <div className="absolute bottom-3 left-3 z-10 pointer-events-none">
          <span className="bg-[#F5F2EB]/95 backdrop-blur-md text-[#292B27] text-[11px] font-medium tracking-wide px-2.5 py-1 border border-[#DDD8CD] rounded-xs shadow-xs">
            {product.formatLabel.split("+")[0].trim()}
          </span>
        </div>

        {/* Quick View Visual Button on Hover (Clicking triggers parent link) */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 pointer-events-none">
          <span className="bg-[#F5F2EB] group-hover:bg-[#292B27] text-[#292B27] group-hover:text-white text-xs font-semibold uppercase tracking-wider py-2.5 px-4 rounded-xs shadow-md border border-[#DDD8CD] transition-all flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0">
            <Eye className="w-3.5 h-3.5" />
            <span>View Details</span>
          </span>
        </div>
      </Link>

      {/* Product Content Details */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
        <div>
          <span className="text-[11px] uppercase tracking-[0.2em] text-[#657052] font-semibold block mb-1.5">
            {product.categoryLabel}
          </span>
          <Link
            href={`/products/${product.slug}`}
            className="block focus:outline-none focus:underline"
          >
            <h3 className="font-serif text-lg sm:text-xl font-normal text-[#292B27] group-hover:text-[#657052] transition-colors line-clamp-1 leading-snug mb-1.5">
              {product.name}
            </h3>
          </Link>
          <p className="text-[13px] text-[#77766E] line-clamp-2 leading-relaxed font-sans">
            {product.shortDescription}
          </p>
        </div>

        {/* Price & Add to Cart Container */}
        <div className="pt-3 border-t border-[#DDD8CD]/70 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-lg sm:text-xl font-bold text-[#292B27]">
              {formatPrice(product.price, currency)}
            </span>
            {product.compareAtPrice && (
              <span className="text-xs text-[#77766E] line-through font-sans">
                {formatPrice(product.compareAtPrice, currency)}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={handleAdd}
            className={`inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold py-1.5 px-3 rounded-xs border transition-all cursor-pointer ${
              justAdded
                ? "bg-[#657052] text-white border-[#657052]"
                : isInCart
                ? "bg-white text-[#292B27] border-[#DDD8CD] hover:border-[#657052]"
                : "bg-[#292B27] text-white border-[#292B27] hover:bg-[#657052] hover:border-[#657052]"
            }`}
            aria-label={`Add ${product.name} to bag`}
          >
            {justAdded ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Added</span>
              </>
            ) : (
              <>
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
