"use client";

import { useState } from "react";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { AdminHeader } from "@/components/admin/AdminHeader";

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#F7F5F0] text-[#22231F] flex flex-col font-sans antialiased selection:bg-[#85866A] selection:text-white">
      {/* 256px Fixed Charcoal Studio Sidebar */}
      <AdminSidebar mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      {/* Main Content Pane */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0 transition-all duration-300">
        <AdminHeader onOpenMobile={() => setMobileOpen(true)} />
        <main className="flex-1 p-5 sm:p-8 lg:p-10 max-w-[1440px] w-full mx-auto space-y-8">
          {children}
        </main>
      </div>
    </div>
  );
}
