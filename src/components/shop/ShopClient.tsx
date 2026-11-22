"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SlidersHorizontal, ArrowUpDown, X, Check } from "lucide-react";
import { ProductCard } from "@/components/products/ProductCard";
import { Product, Collection } from "@/types/commerce";

interface ShopClientProps {
  products: Product[];
  collections: Collection[];
  initialCategory?: string;
  initialFormat?: string;
  initialSort?: string;
  searchQuery?: string;
}

export function ShopClient({
  products,
  collections,
  initialCategory = "",
  initialFormat = "",
  initialSort = "featured",
  searchQuery = "",
}: ShopClientProps) {
  const router = useRouter();

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedFormat, setSelectedFormat] = useState(initialFormat);
  const [selectedSort, setSelectedSort] = useState(initialSort);

  const categories = [
    { label: "All Items", value: "" },
    { label: "Home & Living", value: "home-living" },
    { label: "SEVOLF Little", value: "kids-education" },
    { label: "Productivity", value: "productivity" },
    { label: "Business", value: "business" },
  ];

  const formats = [
    { label: "All Formats", value: "" },
    { label: "PDF Workbook", value: "pdf" },
    { label: "Interactive Planner", value: "template" },
    { label: "ZIP Archive", value: "zip" },
    { label: "Curated Bundle", value: "bundle" },
  ];

  const sortOptions = [
    { label: "Featured", value: "featured" },
    { label: "Newest Releases", value: "newest" },
    { label: "Price: Low to High", value: "price-asc" },
    { label: "Price: High to Low", value: "price-desc" },
  ];

  const updateFilters = (cat: string, fmt: string, srt: string) => {
    const params = new URLSearchParams();
    if (cat) params.set("category", cat);
    if (fmt) params.set("format", fmt);
    if (srt && srt !== "featured") params.set("sort", srt);
    if (searchQuery) params.set("search", searchQuery);

    const query = params.toString();
    router.push(`/shop${query ? `?${query}` : ""}`);
  };

  const handleCategorySelect = (catValue: string) => {
    setSelectedCategory(catValue);
    updateFilters(catValue, selectedFormat, selectedSort);
  };

  const applyBottomSheetFilters = () => {
    updateFilters(selectedCategory, selectedFormat, selectedSort);
    setFilterSheetOpen(false);
  };

  const applySortOption = (sortVal: string) => {
    setSelectedSort(sortVal);
    updateFilters(selectedCategory, selectedFormat, sortVal);
    setSortSheetOpen(false);
  };

  const clearAllFilters = () => {
    setSelectedCategory("");
    setSelectedFormat("");
    setSelectedSort("featured");
    updateFilters("", "", "featured");
    setFilterSheetOpen(false);
  };

  const currentSortLabel = sortOptions.find(o => o.value === selectedSort)?.label || "Featured";

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 py-6 md:py-16">
      {/* 6.A Compact Catalogue Header */}
      <div className="max-w-2xl mb-6 md:mb-12">
        <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1 md:mb-2">
          THE CATALOGUE
        </span>
        <h1 className="font-serif text-3xl sm:text-4xl md:text-5xl font-normal text-[#292B27] leading-tight mb-2 md:mb-4">
          All Digital Works
        </h1>
        <p className="text-xs sm:text-sm md:text-base text-[#77766E] leading-relaxed font-sans">
          Explore thoughtfully designed digital publications, tools and learning resources. Instant delivery with lifetime library access.
        </p>
      </div>

      {/* 6.B Horizontally Scrollable Category Chips (Mobile-First) */}
      <div className="mb-4 md:mb-8 overflow-x-auto no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-2 whitespace-nowrap py-1">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => handleCategorySelect(cat.value)}
                className={`text-xs px-3.5 py-2 rounded-xs transition-all font-medium flex-shrink-0 cursor-pointer ${
                  isSelected
                    ? "bg-[#292B27] text-white shadow-xs"
                    : "bg-white text-[#292B27] border border-[#DDD8CD] hover:border-[#657052]"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* 6.C Mobile Filter & Sort Bar (Under 768px) */}
      <div className="md:hidden flex items-center justify-between gap-3 mb-6 bg-[#EAE5DA] p-3 rounded-xs border border-[#DDD8CD]">
        <button
          onClick={() => setFilterSheetOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-[#292B27] py-2 px-3 text-xs font-semibold uppercase tracking-wider rounded-xs border border-[#DDD8CD]"
        >
          <SlidersHorizontal className="w-3.5 h-3.5 text-[#657052]" />
          <span>Filters {(selectedFormat || selectedCategory) ? "• Active" : ""}</span>
        </button>
        <button
          onClick={() => setSortSheetOpen(true)}
          className="flex-1 flex items-center justify-center gap-2 bg-white text-[#292B27] py-2 px-3 text-xs font-semibold uppercase tracking-wider rounded-xs border border-[#DDD8CD]"
        >
          <ArrowUpDown className="w-3.5 h-3.5 text-[#657052]" />
          <span className="truncate">{currentSortLabel}</span>
        </button>
      </div>

      {/* Desktop Filter / Sort Control Bar (Above 768px) */}
      <div className="hidden md:flex bg-[#EAE5DA] p-4 lg:p-5 border border-[#DDD8CD] rounded-sm mb-10 flex-wrap items-center justify-between gap-3 lg:gap-4">
        {/* Format Selector */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <span className="text-[#77766E] font-medium">Format:</span>
          <div className="flex gap-1.5 flex-wrap">
            {formats.map((fmt) => {
              const isSelected = selectedFormat === fmt.value;
              return (
                <button
                  key={fmt.value}
                  onClick={() => {
                    setSelectedFormat(fmt.value);
                    updateFilters(selectedCategory, fmt.value, selectedSort);
                  }}
                  className={`text-xs px-2.5 lg:px-3 py-1 lg:py-1.5 rounded-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#657052] text-white font-medium"
                      : "bg-white/80 text-[#292B27] border border-[#DDD8CD] hover:bg-white"
                  }`}
                >
                  {fmt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort Selector */}
        <div className="flex items-center gap-2 text-xs ml-auto flex-wrap">
          <span className="text-[#77766E] font-medium">Sort:</span>
          <div className="flex gap-1 flex-wrap">
            {sortOptions.map((s) => {
              const isSelected = selectedSort === s.value;
              return (
                <button
                  key={s.value}
                  onClick={() => {
                    setSelectedSort(s.value);
                    updateFilters(selectedCategory, selectedFormat, s.value);
                  }}
                  className={`text-xs px-2 lg:px-2.5 py-1 rounded-xs transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#292B27] text-white font-medium"
                      : "bg-white/60 text-[#77766E] hover:text-[#292B27]"
                  }`}
                >
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 6.D Product Count Feedback */}
      <div className="flex items-center justify-between mb-4 text-xs text-[#77766E]">
        <span>Showing {products.length} digital {products.length === 1 ? "work" : "works"}</span>
        {(selectedCategory || selectedFormat) && (
          <button
            onClick={clearAllFilters}
            className="text-[#657052] font-semibold underline underline-offset-4"
          >
            Clear active filters
          </button>
        )}
      </div>

      {/* 6.E Product Results Grid */}
      {products.length === 0 ? (
        <div className="py-16 md:py-20 text-center border border-[#DDD8CD] bg-white rounded-xs md:rounded-sm p-6">
          <p className="font-serif text-2xl text-[#292B27] mb-2">No matching products found</p>
          <p className="text-xs sm:text-sm text-[#77766E] max-w-sm mx-auto mb-6">
            Try adjusting your search criteria or explore our featured collections.
          </p>
          <button
            onClick={clearAllFilters}
            className="bg-[#292B27] text-white text-xs uppercase tracking-wider font-semibold px-6 py-3 hover:bg-[#657052] transition-colors rounded-xs"
          >
            Clear All Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}

      {/* Filter Bottom Sheet (Mobile) */}
      {filterSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 overflow-hidden flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setFilterSheetOpen(false)}
          />
          <div className="relative bg-[#F5F2EB] rounded-t-xl border-t border-[#DDD8CD] p-6 max-h-[85vh] overflow-y-auto space-y-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-2xl animate-in slide-in-from-bottom duration-250">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD8CD]">
              <h3 className="font-serif text-xl font-medium text-[#292B27]">Filter Editions</h3>
              <button
                onClick={() => setFilterSheetOpen(false)}
                className="p-1 text-[#77766E] hover:text-[#292B27]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#657052] block">
                Collection Category
              </span>
              <div className="grid grid-cols-1 gap-2">
                {categories.map((cat) => (
                  <button
                    key={cat.value}
                    onClick={() => setSelectedCategory(cat.value)}
                    className={`flex items-center justify-between p-3 rounded-xs border text-xs text-left transition-all ${
                      selectedCategory === cat.value
                        ? "bg-white border-[#657052] font-semibold text-[#292B27]"
                        : "bg-white/60 border-[#DDD8CD] text-[#77766E]"
                    }`}
                  >
                    <span>{cat.label}</span>
                    {selectedCategory === cat.value && <Check className="w-4 h-4 text-[#657052]" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Format Filter */}
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#657052] block">
                Product Format
              </span>
              <div className="grid grid-cols-1 gap-2">
                {formats.map((fmt) => (
                  <button
                    key={fmt.value}
                    onClick={() => setSelectedFormat(fmt.value)}
                    className={`flex items-center justify-between p-3 rounded-xs border text-xs text-left transition-all ${
                      selectedFormat === fmt.value
                        ? "bg-white border-[#657052] font-semibold text-[#292B27]"
                        : "bg-white/60 border-[#DDD8CD] text-[#77766E]"
                    }`}
                  >
                    <span>{fmt.label}</span>
                    {selectedFormat === fmt.value && <Check className="w-4 h-4 text-[#657052]" />}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4 flex items-center gap-3">
              <button
                onClick={clearAllFilters}
                className="flex-1 py-3 text-xs uppercase tracking-wider font-medium text-[#77766E] bg-white border border-[#DDD8CD] rounded-xs"
              >
                Clear All
              </button>
              <button
                onClick={applyBottomSheetFilters}
                className="flex-1 py-3 text-xs uppercase tracking-wider font-semibold text-white bg-[#292B27] rounded-xs"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sort Bottom Sheet (Mobile) */}
      {sortSheetOpen && (
        <div className="md:hidden fixed inset-0 z-50 overflow-hidden flex flex-col justify-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setSortSheetOpen(false)}
          />
          <div className="relative bg-[#F5F2EB] rounded-t-xl border-t border-[#DDD8CD] p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] space-y-4 shadow-2xl animate-in slide-in-from-bottom duration-250">
            <div className="flex items-center justify-between pb-3 border-b border-[#DDD8CD]">
              <h3 className="font-serif text-xl font-medium text-[#292B27]">Sort Catalog By</h3>
              <button
                onClick={() => setSortSheetOpen(false)}
                className="p-1 text-[#77766E] hover:text-[#292B27]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2">
              {sortOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => applySortOption(opt.value)}
                  className={`w-full flex items-center justify-between p-3.5 rounded-xs border text-xs text-left transition-all ${
                    selectedSort === opt.value
                      ? "bg-white border-[#657052] font-semibold text-[#292B27]"
                      : "bg-white/60 border-[#DDD8CD] text-[#77766E]"
                  }`}
                >
                  <span>{opt.label}</span>
                  {selectedSort === opt.value && <Check className="w-4 h-4 text-[#657052]" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
