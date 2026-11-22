"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Search, 
  ShoppingBag, 
  User, 
  Heart, 
  X,
  ArrowRight
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { CURRENCIES, CurrencyCode } from "@/lib/currency";

export function Header() {
  const pathname = usePathname();
  const { totalCount, setIsCartOpen } = useCart();
  const { currency, setCurrency } = useCurrency();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const navLinks = [
    { label: "Shop", href: "/shop" },
    { label: "Collections", href: "/collections" },
    { label: "New Arrivals", href: "/new-arrivals" },
    { label: "Bundles", href: "/bundles" },
    { label: "About", href: "/about" },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/shop?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#F5F2EB]/95 backdrop-blur-md border-b border-[#DDD8CD] transition-all">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-8 lg:px-16 h-14 md:h-20 flex items-center justify-between">
        {/* Left: Brand Wordmark */}
        <div className="flex items-center gap-4 lg:gap-6">
          <Link href="/" className="group flex flex-col focus:outline-none">
            <span className="font-serif text-xl sm:text-2xl md:text-3xl font-bold tracking-[0.2em] text-[#292B27] group-hover:text-[#657052] transition-colors leading-none">
              SEVOLF
            </span>
            <span className="text-[8px] md:text-[9px] uppercase tracking-[0.3em] text-[#77766E] font-medium mt-0.5">
              Digital
            </span>
          </Link>
        </div>

        {/* Center: Desktop Navigation Only */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-8">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium tracking-wide transition-colors relative py-1 ${
                  isActive ? "text-[#292B27]" : "text-[#77766E] hover:text-[#292B27]"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-[1.5px] bg-[#657052]" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center gap-1 sm:gap-2 md:gap-3 lg:gap-5">
          {/* Currency Selector (Desktop) */}
          <div className="hidden lg:flex items-center text-xs">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="bg-transparent border border-[#DDD8CD] rounded px-2 py-1 text-xs text-[#292B27] focus:outline-none focus:border-[#657052] cursor-pointer"
            >
              {Object.keys(CURRENCIES).map((c) => (
                <option key={c} value={c} className="bg-[#FFFFFF] text-[#292B27]">
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Search Trigger */}
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            className="p-2 text-[#292B27] hover:text-[#657052] transition-colors focus:outline-none"
            aria-label="Search Catalog"
          >
            <Search className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>

          {/* Wishlist (Desktop) */}
          <Link
            href="/account/wishlist"
            className="p-2 text-[#292B27] hover:text-[#657052] transition-colors hidden md:inline-block"
            aria-label="Wishlist"
          >
            <Heart className="w-5 h-5" />
          </Link>

          {/* Account (Desktop) */}
          <Link
            href="/account"
            className="p-2 text-[#292B27] hover:text-[#657052] transition-colors hidden md:inline-block"
            aria-label="Customer Account"
          >
            <User className="w-5 h-5" />
          </Link>

          {/* Cart Bag (Always accessible at top-right on Mobile and Desktop) */}
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="relative p-2 text-[#292B27] hover:text-[#657052] transition-colors focus:outline-none"
            aria-label="View Shopping Bag"
          >
            <ShoppingBag className="w-5 h-5" />
            {totalCount > 0 && (
              <span className="absolute top-0.5 right-0.5 w-4 h-4 bg-[#657052] text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {totalCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Slide-down Search Bar */}
      {searchOpen && (
        <div className="border-t border-[#DDD8CD] bg-[#EAE5DA] px-4 md:px-16 py-3 md:py-4 animate-in fade-in slide-in-from-top-2 duration-200">
          <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto flex items-center gap-2 sm:gap-3">
            <Search className="w-4 h-4 sm:w-5 sm:h-5 text-[#77766E]" />
            <input
              type="text"
              placeholder="Search guides, planners, workbooks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
              className="w-full bg-transparent border-b border-[#292B27] py-1.5 md:py-2 text-[#292B27] placeholder:text-[#77766E] focus:outline-none text-sm md:text-base"
            />
            <button
              type="submit"
              className="text-[11px] md:text-xs uppercase tracking-wider font-semibold text-[#292B27] hover:text-[#657052] px-3 py-1.5 md:py-2 bg-white/70 rounded border border-[#DDD8CD]"
            >
              Search
            </button>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="text-[#77766E] hover:text-[#292B27] p-1"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </form>
        </div>
      )}
    </header>
  );
}
