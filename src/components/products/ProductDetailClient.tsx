"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { 
  ArrowLeft, 
  CheckCircle2, 
  Download, 
  ShieldCheck, 
  FileText, 
  Heart, 
  Plus, 
  Check,
  ShoppingBag
} from "lucide-react";
import { Product } from "@/types/commerce";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { formatPrice } from "@/lib/currency";
import { ProductCard } from "@/components/products/ProductCard";

interface ProductDetailClientProps {
  product: Product;
  relatedProducts: Product[];
}

export function ProductDetailClient({ product, relatedProducts }: ProductDetailClientProps) {
  const { addToCart, items, isCartOpen } = useCart();
  const { currency } = useCurrency();
  const [selectedImage, setSelectedImage] = useState(product.coverImage);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "included" | "specs" | "licence">("overview");
  const [hideStickyBar, setHideStickyBar] = useState(false);
  const lastSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = lastSectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setHideStickyBar(entry.isIntersecting);
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const allImages = [
    product.coverImage,
    ...(product.mockupImages || []),
    ...(product.galleryImages || []),
  ];

  const handleAddToCart = () => {
    addToCart(product, 1);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  };

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 py-6 md:py-16 pb-36 md:pb-16">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-[#77766E] mb-4 sm:mb-8 font-sans">
        <Link href="/shop" className="hover:text-[#292B27] transition-colors">
          Shop
        </Link>
        <span>/</span>
        <Link href={`/collections/${product.category}`} className="hover:text-[#292B27] transition-colors">
          {product.categoryLabel}
        </Link>
        <span>/</span>
        <span className="text-[#292B27] truncate font-medium">{product.name}</span>
      </div>

      {/* Main Top Section: Visuals (Left) + Commerce Info (Right) */}
      <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 sm:gap-10 lg:gap-16 mb-12 sm:mb-20 items-start">
        {/* Left: Visual Gallery */}
        <div className="w-full lg:col-span-7 flex flex-col gap-3 sm:gap-4">
          {/* Main Large Display Image */}
          <div className="relative aspect-[4/3] bg-[#EAE5DA] rounded-xs sm:rounded-sm overflow-hidden border border-[#DDD8CD] shadow-[0_4px_20px_rgba(41,43,39,0.04)]">
            <Image
              src={selectedImage}
              alt={product.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 58vw"
              className="object-cover object-center transition-all duration-300"
            />
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-[#F5F2EB]/95 backdrop-blur-md text-[#292B27] text-[10px] sm:text-xs font-semibold px-2.5 py-1 sm:px-3 sm:py-1.5 border border-[#DDD8CD] rounded-xs shadow-xs">
              {product.formatLabel}
            </div>
          </div>

          {/* Thumbnail Strip */}
          {allImages.length > 1 && (
            <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0">
              {allImages.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setSelectedImage(imgUrl)}
                  className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-xs overflow-hidden flex-shrink-0 border-2 transition-all cursor-pointer ${
                    selectedImage === imgUrl ? "border-[#657052] ring-2 ring-[#657052]/20" : "border-[#DDD8CD] opacity-75 hover:opacity-100"
                  }`}
                >
                  <Image src={imgUrl} alt={`${product.name} preview ${idx + 1}`} fill className="object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product Buy Box */}
        <div className="w-full lg:col-span-5 flex flex-col justify-start">
          <div className="pb-6 border-b border-[#DDD8CD]">
            <div className="flex items-center justify-between gap-4 mb-2">
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold">
                {product.categoryLabel}
              </span>
              <button
                type="button"
                onClick={() => setIsWishlisted(!isWishlisted)}
                className={`p-2 rounded-xs border border-[#DDD8CD] transition-colors ${
                  isWishlisted ? "text-red-600 bg-red-50 border-red-200" : "text-[#77766E] hover:text-[#292B27] bg-white"
                }`}
                aria-label="Add to wishlist"
              >
                <Heart className={`w-4 h-4 ${isWishlisted ? "fill-current" : ""}`} />
              </button>
            </div>

            <h1 className="font-serif text-2xl sm:text-3xl sm:text-4xl font-normal text-[#292B27] leading-tight mb-2 sm:mb-3">
              {product.name}
            </h1>

            <p className="font-serif text-base sm:text-lg text-[#292B27]/85 italic mb-3 sm:mb-4 leading-snug">
              "{product.tagline}"
            </p>

            {/* Price Row */}
            <div className="flex items-baseline gap-3 mb-4 sm:mb-6">
              <span className="font-serif text-2xl sm:text-3xl sm:text-4xl font-bold text-[#292B27]">
                {formatPrice(product.price, currency)}
              </span>
              {product.compareAtPrice && (
                <span className="text-sm sm:text-base text-[#77766E] line-through font-sans">
                  {formatPrice(product.compareAtPrice, currency)}
                </span>
              )}
              <span className="text-[11px] bg-[#EAE5DA] text-[#657052] px-2.5 py-0.5 sm:py-1 rounded-xs font-semibold">
                Instant Digital Delivery
              </span>
            </div>

            <p className="text-sm sm:text-base text-[#77766E] leading-relaxed font-sans mb-6">
              {product.shortDescription}
            </p>

            {/* In-page Desktop CTA (Hidden on small mobile since sticky bar handles it) */}
            <div className="hidden md:block space-y-3">
              <button
                type="button"
                onClick={handleAddToCart}
                className="w-full bg-[#292B27] hover:bg-[#657052] text-white py-4 px-6 text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-2 transition-all duration-300 rounded-sm shadow-sm cursor-pointer"
              >
                {justAdded ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Added to Bag</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add to Shopping Bag</span>
                  </>
                )}
              </button>
            </div>

            {/* Key Delivery Assurance Badges */}
            <div className="mt-6 sm:mt-8 pt-5 sm:pt-6 border-t border-[#DDD8CD]/60 space-y-2.5 sm:space-y-3.5 text-xs text-[#292B27] font-sans">
              <div className="flex items-center gap-3">
                <Download className="w-4 h-4 text-[#657052] flex-shrink-0" />
                <span>Direct download link delivered to your email instantly</span>
              </div>
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-4 h-4 text-[#657052] flex-shrink-0" />
                <span>Permanent access in your SEVOLF Digital Library</span>
              </div>
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-[#657052] flex-shrink-0" />
                <span>Licence: {product.licenceType.toUpperCase()} ({product.licenceDescription})</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Section */}
      <div className="border-t border-[#DDD8CD] pt-8 sm:pt-12 mb-14 sm:mb-20">
        <div className="flex border-b border-[#DDD8CD] gap-4 sm:gap-8 mb-6 sm:mb-8 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
          {[
            { id: "overview", label: "Overview & Benefits" },
            { id: "included", label: "What's Included" },
            { id: "specs", label: "Specifications" },
            { id: "licence", label: "Licence Terms" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`pb-3 sm:pb-4 text-xs sm:text-sm font-serif font-medium tracking-wide transition-colors relative whitespace-nowrap cursor-pointer ${
                activeTab === tab.id
                  ? "text-[#292B27] border-b-2 border-[#657052]"
                  : "text-[#77766E] hover:text-[#292B27]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl space-y-6 sm:space-y-8">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div className="prose text-sm sm:text-base text-[#292B27] leading-relaxed whitespace-pre-line font-sans">
                {product.fullDescription}
              </div>

              {product.educationalMeta && (
                <div className="mt-6 sm:mt-8 p-4 sm:p-6 bg-[#EAE5DA] border border-[#DDD8CD] rounded-xs sm:rounded-sm space-y-4">
                  <span className="text-[11px] sm:text-xs uppercase tracking-wider text-[#657052] font-semibold block">
                    SEVOLF Little • Early Learning Specifications
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <span className="text-[#77766E] block font-sans">Target Age:</span>
                      <span className="font-semibold text-[#292B27]">{product.educationalMeta.ageRange}</span>
                    </div>
                    <div>
                      <span className="text-[#77766E] block font-sans">Total Pages:</span>
                      <span className="font-semibold text-[#292B27]">{product.educationalMeta.pagesIncluded} pages</span>
                    </div>
                  </div>
                  {product.educationalMeta.learningObjectives && (
                    <div className="pt-1">
                      <span className="text-xs text-[#77766E] block mb-2 font-medium font-sans">Core Learning Objectives:</span>
                      <ul className="space-y-1.5 list-disc list-inside text-xs text-[#292B27] font-sans">
                        {product.educationalMeta.learningObjectives.map((obj, i) => (
                          <li key={i}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {product.keyBenefits && product.keyBenefits.length > 0 && (
                <div className="pt-4 sm:pt-6">
                  <h3 className="font-serif text-lg sm:text-xl font-normal text-[#292B27] mb-3 sm:mb-4">
                    Key Features & Design Intent
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {product.keyBenefits.map((b, i) => (
                      <div key={i} className="flex items-start gap-2.5 p-3.5 bg-white border border-[#DDD8CD] rounded-xs text-xs sm:text-sm font-sans">
                        <CheckCircle2 className="w-4 h-4 text-[#657052] flex-shrink-0 mt-0.5" />
                        <span>{b}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "included" && (
            <div className="space-y-3 sm:space-y-4">
              <h3 className="font-serif text-lg sm:text-xl font-normal text-[#292B27] mb-2 sm:mb-3">
                Included in Your Download
              </h3>
              <ul className="space-y-2.5 font-sans">
                {product.whatsIncluded.map((item, i) => (
                  <li key={i} className="flex items-center gap-2.5 p-3 sm:p-4 bg-white border border-[#DDD8CD] rounded-xs text-xs sm:text-sm">
                    <Download className="w-4 h-4 text-[#657052] flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {activeTab === "specs" && (
            <div className="space-y-4 sm:space-y-6">
              <h3 className="font-serif text-lg sm:text-xl font-normal text-[#292B27] mb-2 sm:mb-3">
                Specifications
              </h3>
              {product.specifications ? (
                <div className="bg-white border border-[#DDD8CD] rounded-xs divide-y divide-[#DDD8CD] text-xs sm:text-sm font-sans">
                  {Object.entries(product.specifications).map(([key, val]) => (
                    <div key={key} className="flex justify-between p-3.5">
                      <span className="text-[#77766E]">{key}</span>
                      <span className="font-medium text-[#292B27]">{val}</span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {activeTab === "licence" && (
            <div className="space-y-3 bg-white p-5 sm:p-8 border border-[#DDD8CD] rounded-xs text-xs sm:text-sm font-sans">
              <h3 className="font-serif text-xl sm:text-2xl font-normal text-[#292B27]">
                {product.licenceType === "personal" ? "Personal Household Licence" : "Commercial Single Entity Licence"}
              </h3>
              <p className="text-[#77766E] leading-relaxed">
                {product.licenceDescription}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sentinel for last section before footer */}
      <div ref={lastSectionRef}>
        {/* Related Products */}
        {relatedProducts.length > 0 && (
        <div className="border-t border-[#DDD8CD] pt-10 sm:pt-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-xl sm:text-2xl font-normal text-[#292B27]">
              Complements this collection
            </h2>
            <Link
              href="/shop"
              className="text-xs uppercase tracking-widest font-semibold text-[#292B27] hover:text-[#657052]"
            >
              View All
            </Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-6">
            {relatedProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      )}
      </div>

      {/* 3. Context-Aware Sticky Purchase Action for Mobile (Hidden if CartDrawer is active or scrolled to last section) */}
      {!isCartOpen && (
        <div
          className={`md:hidden fixed bottom-14 left-0 right-0 z-30 bg-[#F5F2EB]/95 backdrop-blur-md border-t border-[#DDD8CD] px-4 py-2.5 shadow-[0_-4px_16px_rgba(41,43,39,0.08)] flex items-center justify-between gap-4 transition-all duration-300 ${
            hideStickyBar ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
          }`}
        >
          <div>
            <span className="text-[10px] uppercase font-semibold text-[#77766E] block font-sans">Price</span>
            <span className="font-serif text-xl font-bold text-[#292B27]">
              {formatPrice(product.price, currency)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAddToCart}
            className="flex-1 bg-[#292B27] hover:bg-[#657052] text-white py-3 px-4 text-xs uppercase tracking-widest font-semibold rounded-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer active:scale-98"
          >
            {justAdded ? (
              <>
                <Check className="w-4 h-4" />
                <span>Added</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-4 h-4" />
                <span>Add to Bag</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
