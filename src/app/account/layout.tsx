"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Download, 
  ShoppingBag, 
  Heart, 
  User, 
  Layers, 
  LogOut,
  ShieldCheck,
  ChevronRight
} from "lucide-react";

interface AccountLayoutProps {
  children: React.ReactNode;
}

export default function AccountLayout({ children }: AccountLayoutProps) {
  const pathname = usePathname();

  const navItems = [
    { label: "Digital Library", href: "/account/library", icon: Download, badge: "Downloads" },
    { label: "Order History", href: "/account/orders", icon: ShoppingBag },
    { label: "Wishlist", href: "/account/wishlist", icon: Heart },
    { label: "Subscriptions", href: "/account/subscriptions", icon: Layers },
    { label: "Profile & Security", href: "/account/profile", icon: User },
  ];

  return (
    <div className="max-w-[1440px] mx-auto px-4 sm:px-6 md:px-16 py-6 md:py-16">
      <div className="mb-6 md:mb-10 pb-4 md:pb-6 border-b border-[#DDD8CD] flex flex-col sm:flex-row sm:items-end justify-between gap-2 sm:gap-4">
        <div>
          <span className="text-[10px] md:text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-1">
            CLIENT PORTAL
          </span>
          <h1 className="font-serif text-2xl sm:text-3xl md:text-4xl font-normal text-[#292B27]">
            My Account & Library
          </h1>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#77766E]">
          <ShieldCheck className="w-4 h-4 text-[#657052]" />
          <span>Verified Client Entitlements</span>
        </div>
      </div>

      {/* Horizontal Nav Bar on Mobile, Vertical Sidebar on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Mobile Horizontal Pill Scroll */}
        <div className="lg:hidden overflow-x-auto no-scrollbar -mx-4 px-4 pb-2">
          <div className="flex items-center gap-2 whitespace-nowrap">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href === "/account/library" && pathname === "/account");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xs text-xs uppercase tracking-wider font-medium transition-colors ${
                    isActive
                      ? "bg-[#292B27] text-white shadow-xs"
                      : "bg-white text-[#77766E] border border-[#DDD8CD] hover:text-[#292B27]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Desktop Vertical Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 bg-white border border-[#DDD8CD] rounded-sm p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === "/account/library" && pathname === "/account");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-3 rounded-xs text-xs uppercase tracking-wider font-medium transition-colors ${
                  isActive
                    ? "bg-[#292B27] text-white"
                    : "text-[#77766E] hover:text-[#292B27] hover:bg-[#F5F2EB]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </div>
                <ChevronRight className={`w-3.5 h-3.5 ${isActive ? "opacity-100" : "opacity-40"}`} />
              </Link>
            );
          })}

          <div className="pt-4 mt-4 border-t border-[#DDD8CD]">
            <Link
              href="/login"
              className="flex items-center gap-3 px-3.5 py-2.5 rounded-xs text-xs text-[#77766E] hover:text-red-600 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </Link>
          </div>
        </aside>

        {/* Main Account Content Surface */}
        <main className="lg:col-span-9 bg-white border border-[#DDD8CD] rounded-xs sm:rounded-sm p-4 sm:p-6 md:p-8 min-h-[420px] shadow-2xs">
          {children}
        </main>
      </div>
    </div>
  );
}
