"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  ShieldCheck,
  KeyRound,
  LogOut,
  ChevronRight,
  ExternalLink,
  Sparkles,
} from "lucide-react";

interface AdminSidebarProps {
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  collapsed?: boolean;
  setCollapsed?: (collapsed: boolean) => void;
}

interface NavItem {
  name: string;
  href: string;
  icon: any;
  badge?: string;
  badgeVariant?: "success" | "warning" | "accent";
  external?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "STUDIO",
    items: [
      { name: "Overview", href: "/admin", icon: LayoutDashboard },
      { name: "Launch Readiness", href: "/admin/readiness", icon: Rocket, badge: "GATE", badgeVariant: "warning" },
    ],
  },
  {
    title: "CATALOGUE & ASSETS",
    items: [
      { name: "Products", href: "/admin/products", icon: Package },
      { name: "Collections", href: "/admin/collections", icon: Layers },
      { name: "Digital Assets", href: "/admin/assets", icon: FileArchive },
    ],
  },
  {
    title: "COMMERCE & ORDERS",
    items: [
      { name: "Orders", href: "/admin/orders", icon: ShoppingCart },
      { name: "Customers", href: "/admin/customers", icon: Users },
      { name: "Payments", href: "/admin/payments", icon: CreditCard },
      { name: "Refunds", href: "/admin/refunds", icon: RotateCcw },
    ],
  },
  {
    title: "STORE & CONTENT",
    items: [
      { name: "Online Store", href: "/shop", icon: Globe, external: true },
      { name: "Content & CMS", href: "/admin/content", icon: FileText },
      { name: "Discounts", href: "/admin/discounts", icon: Tag },
      { name: "Analytics", href: "/admin/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "PREFERENCES & SYSTEM",
    items: [
      { name: "General Settings", href: "/admin/settings", icon: Settings },
      { name: "Gateway & Vault", href: "/admin/settings#payments", icon: CreditCard },
      { name: "Integrations Registry", href: "/admin/settings#integrations", icon: KeyRound },
      { name: "Security & RBAC", href: "/admin/settings#security", icon: ShieldCheck },
    ],
  },
];

export function AdminSidebar({
  mobileOpen,
  setMobileOpen,
  collapsed = false,
  setCollapsed,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const isActive = (href: string) => {
    if (href.includes("#")) {
      return pathname === href.split("#")[0];
    }
    if (href === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(href);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#161715]/70 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar shell: #20211F dark charcoal luxury studio look */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#20211F] text-[#D8D6CE] flex flex-col transition-all duration-300 ease-in-out border-r border-[#2C2D2A]
          ${collapsed ? "w-18" : "w-64"}
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Top Studio Brand Header */}
        <div className="h-16 px-5 border-b border-[#2C2D2A] flex items-center justify-between shrink-0">
          <Link
            href="/admin"
            className="flex items-center space-x-2.5 overflow-hidden group"
            onClick={() => setMobileOpen(false)}
          >
            <div className="w-8 h-8 rounded bg-[#85866A] text-[#20211F] flex items-center justify-center font-serif text-base font-medium shrink-0 shadow-xs group-hover:bg-[#97987C] transition-colors">
              S
            </div>
            {!collapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-serif tracking-tight text-sm font-normal text-white uppercase leading-none">
                  SEVOLF
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#85847D] mt-1">
                  Control Center
                </span>
              </div>
            )}
          </Link>
        </div>

        {/* Scrollable Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {NAV_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-1">
              {!collapsed && (
                <div className="px-3 py-1 text-[10px] font-mono uppercase tracking-[0.16em] text-[#696863] font-medium">
                  {section.title}
                </div>
              )}
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      target={item.external ? "_blank" : undefined}
                      rel={item.external ? "noopener noreferrer" : undefined}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed ? item.name : undefined}
                      className={`group flex items-center justify-between px-3 py-2 rounded-md text-xs font-sans transition-all duration-150 ${
                        active
                          ? "bg-[#2F302C] text-white font-medium shadow-xs"
                          : "text-[#A8A69E] hover:text-white hover:bg-[#282926]"
                      } ${collapsed ? "justify-center px-0" : ""}`}
                    >
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 transition-colors ${
                            active
                              ? "text-[#85866A]"
                              : "text-[#7A7973] group-hover:text-[#D8D6CE]"
                          }`}
                        />
                        {!collapsed && (
                          <span className="truncate">{item.name}</span>
                        )}
                      </div>

                      {!collapsed && (
                        <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                          {item.badge && (
                            <span
                              className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${
                                item.badgeVariant === "warning"
                                  ? "bg-[#332A1D] text-[#E0B266] border border-[#524128]"
                                  : "bg-[#2A2E26] text-[#A5C299] border border-[#3E4737]"
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {item.external && (
                            <ExternalLink className="w-3 h-3 text-[#696863] group-hover:text-[#A8A69E]" />
                          )}
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Compact Admin Profile & Logout Footer */}
        <div className="p-3 border-t border-[#2C2D2A] bg-[#1B1C1A] shrink-0">
          <div
            className={`flex items-center justify-between rounded-md p-2 bg-[#242522] border border-[#2F302C] ${
              collapsed ? "justify-center p-1.5" : ""
            }`}
          >
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-[#85866A]/20 border border-[#85866A]/40 text-[#85866A] flex items-center justify-center text-[10px] font-mono font-medium shrink-0">
                AD
              </div>
              {!collapsed && (
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-medium text-white truncate leading-none">
                    Administrator
                  </span>
                  <span className="text-[10px] font-mono text-[#85847D] truncate mt-0.5">
                    suryanaikoti@gmail.com
                  </span>
                </div>
              )}
            </div>

            {!collapsed && (
              <button
                onClick={handleLogout}
                title="Sign out of SEVOLF Control Center"
                className="p-1.5 rounded text-[#85847D] hover:text-[#A8534C] hover:bg-[#2C2D2A] transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
