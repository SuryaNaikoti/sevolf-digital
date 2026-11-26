"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

export function AdminLayoutClient({
  children,
  isLaunchReady = false,
}: {
  children: React.ReactNode;
  isLaunchReady?: boolean;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#22231F] flex flex-col font-sans antialiased selection:bg-[#85866A] selection:text-white">
      {/* Charcoal Studio Sidebar */}
      <AdminSidebar
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
      />

      {/* Main Content Pane */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-0" : "lg:pl-64"
        }`}
      >
        <AdminHeader
          onOpenMobile={() => setMobileOpen(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          isLaunchReady={isLaunchReady}
        />
        <main className="flex-1 p-4 sm:p-6 lg:p-10 max-w-[1440px] w-full mx-auto space-y-6 sm:space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
