import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Collection } from "@/types/commerce";

interface CollectionCardProps {
  collection: Collection;
}

export function CollectionCard({ collection }: CollectionCardProps) {
  return (
    <Link
      href={`/collections/${collection.slug}`}
      className="group relative flex flex-col bg-white border border-[#DDD8CD] rounded-xs sm:rounded-sm overflow-hidden transition-all duration-300 hover:border-[#657052] hover:shadow-[0_8px_24px_rgba(41,43,39,0.06)]"
    >
      {/* Refined aspect ratio: aspect-[16/11] on mobile, aspect-[4/3.5] on desktop to prevent excessive vertical height */}
      <div className="relative aspect-[16/11] sm:aspect-[4/3.5] bg-[#EAE5DA] overflow-hidden">
        <Image
          src={collection.image}
          alt={collection.name}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          className="object-cover object-center transition-transform duration-700 ease-out group-hover:scale-105"
        />
        {/* Editorial Vignette & Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
        
        {/* Text Details Positioned Over Visual */}
        <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 text-white z-10 space-y-0.5 sm:space-y-1">
          <span className="text-[9px] sm:text-[10px] uppercase tracking-[0.25em] text-[#A5AC91] font-bold block">
            Collection
          </span>
          <h3 className="font-serif text-lg sm:text-xl md:text-2xl font-normal leading-tight text-white group-hover:text-[#F5F2EB] transition-colors">
            {collection.name}
          </h3>
          <p className="text-[11px] sm:text-xs text-white/85 line-clamp-1 font-sans leading-relaxed pt-0.5">
            {collection.tagline}
          </p>
        </div>
      </div>

      {/* Card Action Bar */}
      <div className="p-2.5 sm:p-3.5 bg-white flex items-center justify-between border-t border-[#DDD8CD]">
        <span className="text-[11px] sm:text-xs text-[#77766E] font-medium">
          {collection.featuredProductCount} Editions
        </span>
        <span className="text-[10px] sm:text-xs uppercase tracking-widest font-semibold text-[#292B27] group-hover:text-[#657052] flex items-center gap-1 transition-colors">
          Explore <ArrowRight className="w-3 h-3 sm:w-3.5 sm:h-3.5 group-hover:translate-x-1 transition-transform" />
        </span>
      </div>
    </Link>
  );
}
