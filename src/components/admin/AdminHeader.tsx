"use client";

import { Search, Bell, HelpCircle, Menu, ChevronRight } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminHeaderProps {
  title?: string;
  subtitle?: string;
  onOpenMobile?: () => void;
}

export function AdminHeader({ onOpenMobile }: AdminHeaderProps) {
  const pathname = usePathname();
  const segments = pathname?.split("/").filter(Boolean) || ["admin"];

  return (
    <header className="h-14 border-b border-[#E1E3E5] bg-white px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
      {/* Left: Mobile Button & Global Search Box */}
      <div className="flex items-center space-x-3 flex-1 max-w-lg">
        {onOpenMobile && (
          <button
            onClick={onOpenMobile}
            className="lg:hidden p-1.5 -ml-1 rounded text-[#5C5F62] hover:text-[#202223] hover:bg-[#F6F6F7]"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="relative w-full max-w-sm">
          <Search className="w-3.5 h-3.5 text-[#8C9196] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search products, orders, customers (Ctrl + K)"
            className="w-full text-xs bg-[#F6F6F7] border border-[#D2D5D8] rounded-md pl-8 pr-3 py-1.5 text-[#202223] placeholder-[#8C9196] focus:outline-hidden focus:bg-white focus:border-[#202223] focus:ring-1 focus:ring-[#202223]"
          />
        </div>
      </div>

      {/* Right Controls: Environment, Alerts, Help & Avatar */}
      <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
        {/* Environment Staging Pill */}
        <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-[10px] font-mono text-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-semibold uppercase tracking-wider">STAGING GATE</span>
        </div>

        {/* Notifications */}
        <button
          className="p-1.5 rounded-md text-[#5C5F62] hover:text-[#202223] hover:bg-[#F6F6F7] transition-colors relative"
          title="Notifications"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500" />
        </button>

        {/* Documentation / Help */}
        <Link
          href="/admin/readiness"
          className="p-1.5 rounded-md text-[#5C5F62] hover:text-[#202223] hover:bg-[#F6F6F7] transition-colors"
          title="Operational Checklist"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>

        {/* Admin Avatar */}
        <div className="flex items-center space-x-2 pl-2 border-l border-[#E1E3E5]">
          <div className="w-7 h-7 rounded-full bg-[#1A1A1A] text-white flex items-center justify-center text-[10px] font-bold">
            AD
          </div>
        </div>
      </div>
    </header>
  );
}
