"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  ShieldCheck,
  Check,
  ShoppingBag,
  Sparkles,
  BookOpen,
  Printer,
  Heart,
  Maximize2,
  X,
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
  const router = useRouter();
  const { addToCart, isCartOpen } = useCart();
  const { currency } = useCurrency();
  const allImages = [
    product.coverImage,
    ...(product.mockupImages || []),
    ...(product.galleryImages || []),
  ].filter(Boolean);

  const [activeIdx, setActiveIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [hideStickyBar, setHideStickyBar] = useState(false);
  const lastSectionRef = useRef<HTMLDivElement | null>(null);

  const formattedPrice = formatPrice(product.price, currency);
  const activeImage = allImages[activeIdx] || product.coverImage;

  const handleBuyNow = () => {
    addToCart(product, 1);
    router.push("/checkout");
  };

  useEffect(() => {
    const el = lastSectionRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setHideStickyBar(entry.isIntersecting),
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-[#F7F5F0] text-[#22231F] pb-20 md:pb-0">
      {/* 1. HERO */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 pb-14 lg:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#F8E4A6]/80 border border-[#E6D18F] rounded-xs text-[11px] font-mono uppercase tracking-[0.15em] text-[#22231F]">
              <span>{product.productType || "Digital Edition"}</span>
              <span>·</span>
              <span>{product.formatLabel || "PDF"}</span>
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#22231F] leading-[1.1] tracking-tight">
              {product.name}
            </h1>
            <p className="text-base sm:text-lg text-[#55544E] leading-relaxed max-w-xl">
              {product.tagline || product.shortDescription}
            </p>

            {product.features && product.features.length > 0 && (
              <ul className="space-y-2 text-sm text-[#22231F]">
                {product.features.slice(0, 3).map((feat, i) => (
                  <li key={i} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#657052] shrink-0" />
                    <span>{feat}</span>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={handleBuyNow}
                className="bg-[#22231F] hover:bg-[#657052] text-white px-7 py-4 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Get My Copy — {formattedPrice}</span>
              </button>
              <a
                href="#product-overview"
                className="bg-white hover:bg-[#FAF8F5] border border-[#DDD8CD] text-[#22231F] px-7 py-4 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors text-center"
              >
                Explore Details
              </a>
            </div>

            <p className="text-[11px] font-mono uppercase tracking-wider text-[#77766E]">
              Digital Download · No physical item will be shipped
            </p>
          </div>

          <div className="lg:col-span-6 flex justify-center">
            <div className="relative w-full max-w-md py-4">
              {allImages[1] && (
                <div className="hidden sm:block absolute -right-4 top-8 w-44 aspect-[3/4] rounded-xs overflow-hidden border border-[#DDD8CD] shadow-md rotate-6 bg-white">
                  <img src={allImages[1]} alt={`${product.name} preview`} className="w-full h-full object-cover" />
                </div>
              )}
              {allImages[2] && (
                <div className="hidden sm:block absolute -left-4 top-12 w-44 aspect-[3/4] rounded-xs overflow-hidden border border-[#DDD8CD] shadow-md -rotate-6 bg-white">
                  <img src={allImages[2]} alt={`${product.name} interior`} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="relative z-10 mx-auto w-72 sm:w-80 aspect-[3/4] rounded-xs overflow-hidden border-2 border-[#DDD8CD] shadow-2xl bg-white">
                <img src={product.coverImage} alt={product.name} className="w-full h-full object-cover" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. QUICK TRUST STRIP */}
      <section className="border-y border-[#E8E5DD] bg-white">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium text-[#22231F]">
          <div className="flex items-center justify-center gap-2"><BookOpen className="w-4 h-4 text-[#657052]" /><span>{product.formatLabel || "Digital Edition"}</span></div>
          <div className="flex items-center justify-center gap-2"><Download className="w-4 h-4 text-[#657052]" /><span>Instant Digital Access</span></div>
          <div className="flex items-center justify-center gap-2"><Sparkles className="w-4 h-4 text-[#657052]" /><span>Curated by SEVOLF</span></div>
          <div className="flex items-center justify-center gap-2"><ShieldCheck className="w-4 h-4 text-[#657052]" /><span>Secure Checkout</span></div>
        </div>
      </section>

      {/* 3. EDITORIAL OVERVIEW & GALLERY */}
      <section id="product-overview" className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start bg-white border border-[#E8E5DD] rounded-sm p-8 sm:p-12">
          <div className="lg:col-span-6 space-y-4">
            <span className="text-[11px] font-mono uppercase tracking-widest text-[#657052]">About This Edition</span>
            <h2 className="font-serif text-3xl font-normal text-[#22231F] leading-tight">
              {product.shortDescription}
            </h2>
            <p className="text-sm sm:text-base text-[#55544E] leading-relaxed whitespace-pre-line">
              {product.fullDescription}
            </p>
          </div>
          <div className="lg:col-span-6 space-y-3">
            <div className="relative aspect-[4/3] bg-[#FAF8F5] border border-[#E8E5DD] rounded-xs overflow-hidden">
              <img src={activeImage} alt={product.name} className="w-full h-full object-contain" />
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="Enlarge preview"
                className="absolute top-3 right-3 p-2 bg-white/95 border border-[#DDD8CD] text-[#22231F] cursor-pointer"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
            {allImages.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {allImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={`aspect-[4/3] border overflow-hidden cursor-pointer ${
                      idx === activeIdx ? "border-[#22231F] ring-1 ring-[#22231F]" : "border-[#E8E5DD]"
                    }`}
                  >
                    <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. WHAT'S INCLUDED & SPECIFICATIONS */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-16 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 bg-white border border-[#E8E5DD] rounded-sm p-7 space-y-4">
          <h2 className="font-serif text-2xl font-normal text-[#22231F]">Included in Your Download</h2>
          <ul className="space-y-2.5 text-xs sm:text-sm text-[#55544E]">
            {(product.whatsIncluded || []).map((item, i) => (
              <li key={i} className="flex items-center gap-2.5">
                <Download className="w-4 h-4 text-[#657052] shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:col-span-6 bg-white border border-[#E8E5DD] rounded-sm p-7 space-y-4">
          <h2 className="font-serif text-2xl font-normal text-[#22231F]">Specifications & Licence</h2>
          <dl className="divide-y divide-[#E8E5DD] text-xs sm:text-sm">
            {product.specifications &&
              Object.entries(product.specifications).map(([k, v]) => (
                <div key={k} className="py-2.5 flex justify-between gap-4">
                  <dt className="text-[#77766E]">{k}</dt>
                  <dd className="text-[#22231F] font-medium text-right">{v}</dd>
                </div>
              ))}
            <div className="py-2.5 flex justify-between gap-4">
              <dt className="text-[#77766E]">Licence</dt>
              <dd className="text-[#22231F] font-medium text-right">{product.licenceDescription}</dd>
            </div>
          </dl>
        </div>
      </section>

      {/* 5. HOW IT WORKS */}
      <section className="bg-white border-y border-[#E8E5DD] py-14">
        <div className="max-w-5xl mx-auto px-5 sm:px-8 space-y-8">
          <h2 className="font-serif text-3xl font-normal text-[#22231F] text-center">How It Works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 text-xs">
            {[
              { step: "01", icon: ShoppingBag, title: "Purchase", desc: "Complete your one-time purchase securely." },
              { step: "02", icon: Download, title: "Download", desc: "Instant download link after payment verification." },
              { step: "03", icon: Printer, title: "Use or Print", desc: "Open on any device or print at home." },
              { step: "04", icon: Heart, title: "Enjoy", desc: "Access anytime in My Digital Library." },
            ].map((s) => (
              <div key={s.step} className="p-5 bg-[#FAF8F5] border border-[#E8E5DD] rounded-sm space-y-2">
                <span className="font-mono text-[11px] text-[#657052] font-semibold block">{s.step}</span>
                <s.icon className="w-5 h-5 text-[#22231F]" />
                <h3 className="font-serif text-base text-[#22231F]">{s.title}</h3>
                <p className="text-[#77766E]">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6. LAST SECTION BEFORE FOOTER (FINAL CTA + RELATED PRODUCTS) */}
      <div ref={lastSectionRef} className="max-w-6xl mx-auto px-5 sm:px-8 py-16 space-y-14">
        <div className="bg-white border border-[#DDD8CD] rounded-sm p-8 sm:p-12 grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-4 flex justify-center">
            <img src={product.coverImage} alt={product.name} className="w-48 aspect-[3/4] object-cover border border-[#DDD8CD] shadow-lg" />
          </div>
          <div className="md:col-span-8 space-y-4">
            <h2 className="font-serif text-3xl font-normal text-[#22231F]">{product.name}</h2>
            <p className="text-sm text-[#55544E]">{product.formatLabel} · Instant Digital Download</p>
            <div className="text-3xl font-serif text-[#22231F]">{formattedPrice}</div>
            <button
              type="button"
              onClick={handleBuyNow}
              className="w-full sm:w-auto bg-[#22231F] hover:bg-[#657052] text-white px-8 py-4 text-xs uppercase tracking-wider font-semibold rounded-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Get My Copy — {formattedPrice}</span>
            </button>
          </div>
        </div>

        {relatedProducts.length > 0 && (
          <div className="border-t border-[#DDD8CD] pt-10">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-serif text-2xl font-normal text-[#22231F]">Complements this collection</h2>
              <Link href="/shop" className="text-xs uppercase tracking-widest font-semibold text-[#22231F] hover:text-[#657052]">
                View All
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {relatedProducts.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* MOBILE STICKY PURCHASE BAR (hides when last section is in view) */}
      {!isCartOpen && (
        <div
          className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xs border-t border-[#E8E5DD] px-4 py-3 flex items-center justify-between gap-3 shadow-lg transition-all duration-300 ${
            hideStickyBar ? "translate-y-full opacity-0 pointer-events-none" : "translate-y-0 opacity-100"
          }`}
        >
          <div className="min-w-0">
            <p className="text-xs font-medium text-[#22231F] truncate">{product.name}</p>
            <p className="text-xs font-mono font-semibold text-[#657052]">{formattedPrice}</p>
          </div>
          <button
            type="button"
            onClick={handleBuyNow}
            className="bg-[#22231F] text-white px-5 py-2.5 text-xs uppercase tracking-wider font-semibold rounded-xs shrink-0"
          >
            Get My Copy
          </button>
        </div>
      )}

      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxOpen(false)}>
          <div className="relative max-w-2xl w-full bg-white rounded-sm p-3" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              aria-label="Close preview"
              onClick={() => setLightboxOpen(false)}
              className="absolute top-3 right-3 p-1.5 bg-white border border-[#DDD8CD] text-[#22231F] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <img src={activeImage} alt={product.name} className="w-full max-h-[82vh] object-contain mx-auto" />
          </div>
        </div>
      )}
    </div>
  );
}
