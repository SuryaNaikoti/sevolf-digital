"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Compass, Heart, Download, User } from "lucide-react";

export function MobileBottomNavigation() {
  const pathname = usePathname();

  const tabs = [
    { label: "Home", href: "/", icon: Home },
    { label: "Explore", href: "/shop", icon: Compass },
    { label: "Wishlist", href: "/account/wishlist", icon: Heart },
    { label: "Library", href: "/account/library", icon: Download },
    { label: "Account", href: "/account", icon: User },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#FFFFFF] border-t border-[#DDD8CD] shadow-[0_-4px_16px_rgba(41,43,39,0.04)] pb-[env(safe-area-inset-bottom)]"
      aria-label="Mobile Navigation"
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 flex flex-col items-center justify-center h-full transition-colors relative ${
                isActive ? "text-[#657052]" : "text-[#77766E] hover:text-[#292B27]"
              }`}
            >
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-[#657052] rounded-full" />
              )}
              <Icon className="w-4 h-4 mb-0.5" />
              <span className="text-[10px] font-medium tracking-tight">
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
