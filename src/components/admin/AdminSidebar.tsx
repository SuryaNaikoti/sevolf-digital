"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rocket,
  Globe,
  FileText,
  Package,
  Layers,
  FileArchive,
  ShoppingCart,
  Users,
  CreditCard,
  RotateCcw,
  Tag,
  BarChart3,
  Settings,
  ExternalLink,
  Store,
  KeyRound,
  ShieldCheck,
} from "lucide-react";

interface AdminSidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

// Strictly active V16 navigation modules (Deferred modules cleanly removed to eliminate 404s)
const NAV_SECTIONS: NavSection[] = [
  {
    title: "SEVOLF",
    items: [
      { name: "Overview", href: "/admin", icon: LayoutDashboard },
      { name: "Launch Readiness", href: "/admin/readiness", icon: Rocket, badge: "GATE" },
    ],
  },
  {
    title: "SALES CHANNELS",
    items: [
      { name: "Online Store", href: "/shop", icon: Globe },
      { name: "Content", href: "/admin/content", icon: FileText },
    ],
  },
  {
    title: "PRODUCTS",
    items: [
      { name: "Products", href: "/admin/products", icon: Package },
      { name: "Collections", href: "/admin/collections", icon: Layers },
      { name: "Digital Assets", href: "/admin/assets", icon: FileArchive },
    ],
  },
  {
    title: "SALES",
    items: [
      { name: "Orders", href: "/admin/orders", icon: ShoppingCart },
      { name: "Customers", href: "/admin/customers", icon: Users },
      { name: "Payments", href: "/admin/payments", icon: CreditCard },
      { name: "Refunds", href: "/admin/refunds", icon: RotateCcw },
    ],
  },
  {
    title: "MARKETING",
    items: [
      { name: "Discounts", href: "/admin/discounts", icon: Tag },
      { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "SETTINGS",
    items: [
      { name: "General & Store", href: "/admin/settings", icon: Settings },
      { name: "Payments Gateway", href: "/admin/settings#payments", icon: CreditCard },
      { name: "Integrations Registry", href: "/admin/settings#integrations", icon: KeyRound },
      { name: "Security & RBAC", href: "/admin/settings#security", icon: ShieldCheck },
    ],
  },
];

export function AdminSidebar({ mobileOpen, setMobileOpen }: AdminSidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: Shopify-inspired Charcoal Compact Sidebar (240px) */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-60 bg-[#1A1A1A] text-[#C9CCCF] border-r border-[#2C2C2C] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Store Selector Header */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-[#2C2C2C] bg-[#141414]">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-7 h-7 rounded-md bg-[#2C2C2C] border border-[#3D3D3D] flex items-center justify-center text-white shrink-0">
              <Store className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="leading-tight truncate">
              <p className="text-xs font-semibold text-white truncate">SEVOLF Studio</p>
              <p className="text-[10px] text-[#8C9196] font-mono truncate">sevolf-digital.myshop</p>
            </div>
          </div>
          <Link
            href="/"
            target="_blank"
            className="p-1.5 text-[#8C9196] hover:text-white rounded hover:bg-[#2C2C2C] transition-colors"
            title="View online store"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Scrollable Navigation */}
        <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4 text-xs font-medium">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-0.5">
              <div className="px-2 py-1 text-[10px] font-mono tracking-wider text-[#6D7175] uppercase font-bold">
                {section.title}
              </div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isExternal = item.href.startsWith("/shop") || item.href === "/";
                const isActive =
                  !isExternal &&
                  (item.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(item.href.split("#")[0]));

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    target={isExternal ? "_blank" : undefined}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded text-xs transition-colors ${
                      isActive
                        ? "bg-[#2C2C2C] text-white font-semibold"
                        : "text-[#B5B5B5] hover:bg-[#242424] hover:text-white"
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-white" : "text-[#8C9196]"
                        }`}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>

                    {item.badge && (
                      <span className="text-[9px] font-mono font-semibold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/80">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Admin User Profile Footer */}
        <div className="h-13 px-3 border-t border-[#2C2C2C] bg-[#141414] flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[10px] font-bold shrink-0">
              SD
            </div>
            <div className="leading-tight truncate">
              <p className="text-xs font-medium text-white truncate">Administrator</p>
              <p className="text-[10px] text-[#8C9196] font-mono truncate">founder@sevolf.com</p>
            </div>
          </div>
          <Link
            href="/admin/settings"
            className="p-1.5 text-[#8C9196] hover:text-white rounded hover:bg-[#2C2C2C] transition-colors"
            title="Admin settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </Link>
        </div>
      </aside>
    </>
  );
}
