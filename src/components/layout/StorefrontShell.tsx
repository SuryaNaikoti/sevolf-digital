"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { AnnouncementBar } from "@/components/layout/AnnouncementBar";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNavigation } from "@/components/layout/MobileBottomNavigation";
import { CartDrawer } from "@/components/cart/CartDrawer";
import { CartProvider } from "@/context/CartContext";
import { CurrencyProvider } from "@/context/CurrencyContext";

export function StorefrontShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname?.startsWith("/admin");

  if (isAdmin) {
    return <>{children}</>;
  }

  return (
    <CurrencyProvider>
      <CartProvider>
        <div className="min-h-screen flex flex-col bg-[#F5F2EB] text-[#292B27] font-sans antialiased selection:bg-[#A5AC91] selection:text-white pb-14 md:pb-0">
          <AnnouncementBar />
          <Suspense fallback={<div className="h-14 md:h-20 bg-[#F5F2EB] border-b border-[#DDD8CD]" />}>
            <Header />
          </Suspense>
          <main className="flex-1">
            <Suspense fallback={<div className="py-20 text-center text-xs text-[#77766E]">Loading SEVOLF...</div>}>
              {children}
            </Suspense>
          </main>
          <Footer />
          <CartDrawer />
          <MobileBottomNavigation />
        </div>
      </CartProvider>
    </CurrencyProvider>
  );
}
