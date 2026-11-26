"use client";

import { useState } from "react";
import { Search, Bell, HelpCircle, Menu, ChevronRight, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AdminHeaderProps {
  onOpenMobile?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function AdminHeader({ onOpenMobile }: AdminHeaderProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Generate clean breadcrumbs
  const segments = pathname?.split("/").filter(Boolean) || ["admin"];

  const formatBreadcrumb = (seg: string) => {
    if (seg === "admin") return "Studio";
    return seg
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  return (
    <header className="h-16 border-b border-[#E8E5DD] bg-[#FFFFFF] px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 transition-all">
      {/* Left: Mobile trigger & Studio Breadcrumbs */}
      <div className="flex items-center space-x-3.5 min-w-0">
        {onOpenMobile && (
          <button
            onClick={onOpenMobile}
            className="lg:hidden p-1.5 -ml-1 rounded text-[#85847D] hover:text-[#22231F] hover:bg-[#F7F5F0] transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Minimal Breadcrumb Path */}
        <nav aria-label="Breadcrumb" className="hidden sm:flex items-center space-x-1.5 text-xs font-sans text-[#85847D]">
          {segments.map((seg, idx) => {
            const href = "/" + segments.slice(0, idx + 1).join("/");
            const isLast = idx === segments.length - 1;

            return (
              <div key={href} className="flex items-center space-x-1.5">
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#DCD9D0] shrink-0" />}
                {isLast ? (
                  <span className="font-medium text-[#22231F] font-serif text-sm">
                    {formatBreadcrumb(seg)}
                  </span>
                ) : (
                  <Link
                    href={href}
                    className="hover:text-[#22231F] transition-colors"
                  >
                    {formatBreadcrumb(seg)}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Center Search Input */}
      <div className="flex-1 max-w-md mx-4 hidden md:block">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-[#85847D] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search catalog, orders, patrons... (Ctrl + K)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-sans bg-[#F7F5F0] border border-[#E8E5DD] rounded-md pl-8 pr-8 py-1.5 text-[#22231F] placeholder-[#85847D] focus:outline-hidden focus:bg-white focus:border-[#85866A] focus:ring-1 focus:ring-[#85866A] transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#85847D] hover:text-[#22231F]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Right Studio Controls */}
      <div className="flex items-center space-x-2.5 sm:space-x-3 shrink-0">
        {/* Verification Status Pill */}
        <Link
          href="/admin/readiness"
          className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#FBF7F0] border border-[#EADFCB] text-[10px] font-mono text-[#8C6D34] hover:bg-[#F6EFE2] transition-colors"
          title="Operational Checklist Gate"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#A37E3E] animate-pulse" />
          <span className="font-medium uppercase tracking-wider">PRE-LAUNCH GATE</span>
        </Link>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-md text-[#85847D] hover:text-[#22231F] hover:bg-[#F7F5F0] transition-colors relative"
            title="Operational Alerts"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#85866A]" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-[#E8E5DD] rounded-lg shadow-lg py-2 z-50 animate-in fade-in slide-in-from-top-1">
              <div className="px-4 py-2 border-b border-[#E8E5DD] flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-wider text-[#22231F] font-semibold">
                  System Alerts
                </span>
                <span className="text-[10px] text-[#85847D]">Real-Time</span>
              </div>
              <div className="px-4 py-3 text-xs space-y-2">
                <div className="p-2.5 rounded bg-[#FAF8F5] border border-[#E8E5DD] space-y-1">
                  <p className="font-medium text-[#22231F]">Pre-Launch Gate Enforced</p>
                  <p className="text-[11px] text-[#85847D] leading-relaxed">
                    Live payments held in disconnected mode pending live credential authorization.
                  </p>
                </div>
              </div>
              <div className="px-4 pt-1 pb-2 border-t border-[#E8E5DD] text-right">
                <Link
                  href="/admin/readiness"
                  onClick={() => setNotificationsOpen(false)}
                  className="text-[11px] text-[#85866A] hover:underline font-medium"
                >
                  View Readiness Matrix →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Help / Verification */}
        <Link
          href="/admin/readiness"
          className="p-2 rounded-md text-[#85847D] hover:text-[#22231F] hover:bg-[#F7F5F0] transition-colors"
          title="Studio Verification Matrix"
        >
          <HelpCircle className="w-4 h-4" />
        </Link>

        {/* Subtle separator */}
        <div className="h-5 w-[1px] bg-[#E8E5DD]" />

        {/* Studio Admin Indicator */}
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-full bg-[#20211F] text-[#F7F5F0] flex items-center justify-center text-[10px] font-serif font-medium tracking-wider">
            S
          </div>
        </div>
      </div>
    </header>
  );
}
