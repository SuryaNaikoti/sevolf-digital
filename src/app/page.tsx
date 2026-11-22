import React from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { ProductCard } from "@/components/products/ProductCard";
import { CollectionCard } from "@/components/collections/CollectionCard";
import { 
  getFeaturedProducts, 
  getCollections, 
  getNewArrivals, 
  getProductBySlug 
} from "@/services/products";

export default async function HomePage() {
  const [featuredProducts, collections, newArrivals, spotlightProduct] = await Promise.all([
    getFeaturedProducts(4),
    getCollections(),
    getNewArrivals(4),
    getProductBySlug("14-day-home-reset-kit"),
  ]);

  return (
    <div className="flex flex-col gap-14 sm:gap-20 md:gap-32 overflow-hidden pb-8 sm:pb-12">
      {/* 5. Mobile & Desktop Hero Section */}
      <section className="relative pt-4 sm:pt-6 md:pt-14">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16">
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-14 items-center">
            {/* Hero Copy Container */}
            <div className="w-full lg:col-span-5 flex flex-col justify-center space-y-4 sm:space-y-6">
              <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] sm:tracking-[0.3em] text-[#657052] font-semibold">
                THE SEVOLF COLLECTION
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl lg:text-[68px] font-normal text-[#292B27] leading-[1.12] sm:leading-[1.08] tracking-tight">
                Make room for better things.
              </h1>
              <p className="text-sm sm:text-base md:text-lg text-[#77766E] leading-relaxed max-w-lg font-sans">
                Discover thoughtfully designed digital resources, tools and experiences for everyday life.
              </p>
              
              <div className="pt-1 sm:pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <Link
                  href="/shop"
                  className="w-full sm:w-auto bg-[#292B27] hover:bg-[#657052] text-white px-7 py-3.5 sm:px-8 sm:py-4 text-xs uppercase tracking-widest font-semibold transition-all duration-300 rounded-xs sm:rounded-sm text-center shadow-xs"
                >
                  Explore the collection
                </Link>
                <Link
                  href="/new-arrivals"
                  className="w-full sm:w-auto bg-transparent hover:bg-[#EAE5DA] text-[#292B27] border border-[#DDD8CD] px-7 py-3 sm:px-8 sm:py-4 text-xs uppercase tracking-widest font-semibold transition-all duration-300 rounded-xs sm:rounded-sm text-center"
                >
                  Discover what's new
                </Link>
              </div>

              {/* Quiet assurances */}
              <div className="pt-3 sm:pt-6 border-t border-[#DDD8CD]/70 flex items-center gap-4 sm:gap-6 text-xs text-[#77766E]">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#657052]" />
                  <span>Instant digital delivery</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#657052]" />
                  <span>Original SEVOLF designs</span>
                </div>
              </div>
            </div>

            {/* Hero Image Container */}
            <div className="w-full lg:col-span-7 h-[280px] sm:h-[400px] md:h-[500px] lg:h-[660px] relative rounded-xs sm:rounded-sm overflow-hidden border border-[#DDD8CD] bg-[#EAE5DA] shadow-[0_8px_24px_rgba(41,43,39,0.05)]">
              <Image
                src="/images/hero/hero-lifestyle.jpg"
                alt="Thoughtfully styled workspace with notebook, tablet, and morning daylight"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 56vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 bg-[#F5F2EB]/95 backdrop-blur-md px-3 py-1.5 sm:px-4 sm:py-2.5 border border-[#DDD8CD] text-[10px] sm:text-xs text-[#292B27] rounded-xs shadow-xs">
                <span className="font-medium tracking-wide">SEVOLF Editions • Global Release</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Collections */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 md:mb-12">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1.5">
              DISCIPLINES
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-[40px] font-normal text-[#292B27] leading-tight">
              Find what fits your world.
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#77766E] mt-1 sm:mt-2 font-sans max-w-xl leading-relaxed">
              Thoughtful resources designed around the things that matter.
            </p>
          </div>
          <Link
            href="/collections"
            className="mt-3 sm:mt-0 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#292B27] hover:text-[#657052] transition-colors"
          >
            All collections <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {collections.map((col) => (
            <CollectionCard key={col.id} collection={col} />
          ))}
        </div>
      </section>

      {/* Featured Products (Thoughtful finds) */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 md:mb-12">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1.5">
              CURATED EDITIONS
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-[40px] font-normal text-[#292B27] leading-tight">
              Thoughtful finds.
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#77766E] mt-1 sm:mt-2 font-sans max-w-xl leading-relaxed">
              Carefully crafted workbooks, toolkits, and digital systems.
            </p>
          </div>
          <Link
            href="/shop"
            className="mt-3 sm:mt-0 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#292B27] hover:text-[#657052] transition-colors"
          >
            Explore all products <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {featuredProducts.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      </section>

      {/* Brand Philosophy */}
      <section className="bg-[#EAE5DA] py-14 sm:py-20 md:py-28 border-y border-[#DDD8CD] w-full">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-16 text-center">
          <span className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-[#657052] font-semibold block mb-3 sm:mb-4">
            OUR PHILOSOPHY
          </span>
          <h2 className="font-serif text-2xl sm:text-3xl md:text-5xl font-normal text-[#292B27] leading-snug mb-4 sm:mb-6">
            "Good design should make everyday life feel simpler."
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-[#77766E] leading-relaxed max-w-2xl mx-auto font-sans mb-6 sm:mb-10">
            At SEVOLF, we create thoughtful digital products that help people learn, organise, create and make more of their everyday lives.
          </p>
          <div className="inline-flex flex-wrap justify-center items-center gap-3 sm:gap-6 text-[10px] sm:text-xs uppercase tracking-widest text-[#292B27] font-semibold">
            <span>Crafted with intention</span>
            <span>•</span>
            <span>Clarity over noise</span>
            <span>•</span>
            <span>Lifetime ownership</span>
          </div>
        </div>
      </section>

      {/* Featured Product Spotlight */}
      {spotlightProduct && (
        <section className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 w-full">
          <div className="bg-white border border-[#DDD8CD] rounded-xs sm:rounded-sm p-5 sm:p-8 lg:p-14 flex flex-col lg:grid lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-14 items-center shadow-xs">
            <div className="w-full lg:col-span-6 relative aspect-[4/3] rounded-xs sm:rounded-sm overflow-hidden bg-[#EAE5DA] border border-[#DDD8CD]">
              <Image
                src="/images/products/home-reset-kit/spotlight-mockup.jpg"
                alt="14-Day Home Reset Kit presentation on tablet and interior living space"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover object-center"
              />
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 bg-[#292B27] text-white text-[10px] sm:text-[11px] uppercase font-semibold tracking-widest px-2.5 py-1 shadow-xs">
                Spotlight Edition
              </div>
            </div>

            <div className="w-full lg:col-span-6 flex flex-col justify-center space-y-4 sm:space-y-5">
              <span className="text-[11px] sm:text-xs uppercase tracking-widest text-[#657052] font-semibold">
                {spotlightProduct.categoryLabel} • {spotlightProduct.formatLabel}
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl sm:text-4xl font-normal text-[#292B27] leading-snug">
                {spotlightProduct.name}
              </h3>
              <p className="text-xs sm:text-sm md:text-base text-[#77766E] leading-relaxed font-sans">
                {spotlightProduct.shortDescription}
              </p>

              {spotlightProduct.keyBenefits && (
                <ul className="space-y-2 sm:space-y-3 pt-1">
                  {spotlightProduct.keyBenefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2.5 sm:gap-3 text-xs sm:text-sm text-[#292B27]">
                      <CheckCircle2 className="w-4 h-4 text-[#657052] flex-shrink-0 mt-0.5" />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                <div>
                  <span className="text-[11px] sm:text-xs text-[#77766E] block font-sans">Instant Access Price</span>
                  <span className="font-serif text-2xl sm:text-3xl font-bold text-[#292B27]">
                    ₹{spotlightProduct.price.toLocaleString("en-IN")}
                  </span>
                </div>
                <Link
                  href={`/products/${spotlightProduct.slug}`}
                  className="bg-[#292B27] hover:bg-[#657052] text-white px-7 py-3.5 sm:px-8 sm:py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors rounded-xs sm:rounded-sm inline-flex items-center justify-center gap-2 shadow-xs"
                >
                  <span>View Details & Sample</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* New Releases */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-6 sm:mb-8 md:mb-12">
          <div>
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1.5">
              FRESH WORKS
            </span>
            <h2 className="font-serif text-2xl sm:text-3xl md:text-[40px] font-normal text-[#292B27] leading-tight">
              New releases.
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-[#77766E] mt-1 sm:mt-2 font-sans max-w-xl leading-relaxed">
              Freshly designed editions for your home, mind, and craft.
            </p>
          </div>
          <Link
            href="/new-arrivals"
            className="mt-3 sm:mt-0 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest font-semibold text-[#292B27] hover:text-[#657052] transition-colors"
          >
            All new releases <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {newArrivals.map((prod) => (
            <ProductCard key={prod.id} product={prod} />
          ))}
        </div>
      </section>

      {/* Brand Values */}
      <section className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 py-10 sm:py-14 border-t border-b border-[#DDD8CD]">
          <div className="space-y-1.5 sm:space-y-2.5">
            <span className="font-serif text-lg sm:text-xl font-normal text-[#292B27] block">
              Direct Publishing
            </span>
            <p className="text-xs sm:text-sm text-[#77766E] leading-relaxed font-sans">
              Every digital workbook, template, and system is designed, audited, and published directly by SEVOLF.
            </p>
          </div>
          <div className="space-y-1.5 sm:space-y-2.5">
            <span className="font-serif text-lg sm:text-xl font-normal text-[#292B27] block">
              Permanent Digital Library
            </span>
            <p className="text-xs sm:text-sm text-[#77766E] leading-relaxed font-sans">
              Purchases are tied to your personal account library with instant, secured download links whenever you need them.
            </p>
          </div>
          <div className="space-y-1.5 sm:space-y-2.5">
            <span className="font-serif text-lg sm:text-xl font-normal text-[#292B27] block">
              Device Versatility
            </span>
            <p className="text-xs sm:text-sm text-[#77766E] leading-relaxed font-sans">
              Engineered with vector precision for iPad GoodNotes, physical home printers, desktop Notion, and smartphones.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
