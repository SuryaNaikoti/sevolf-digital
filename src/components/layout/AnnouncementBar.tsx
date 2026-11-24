"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, X } from "lucide-react";

export function AnnouncementBar() {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="bg-[#EAE5DA] text-[#292B27] border-b border-[#DDD8CD] px-3 md:px-4 py-1.5 md:py-2 text-[11px] md:text-sm font-medium tracking-wide">
      <div className="max-w-[1440px] mx-auto flex items-center justify-between">
        <span className="hidden md:inline-block text-[#77766E] uppercase tracking-wider text-[11px]">
          Global Digital Storefront
        </span>
        <div className="mx-auto md:mx-0 flex items-center gap-1.5 md:gap-2 text-center truncate">
          <span className="truncate">Thoughtfully made digital products for everyday life.</span>
          <Link
            href="/shop"
            className="hidden sm:inline-flex items-center gap-1 font-semibold underline underline-offset-4 hover:text-[#657052] transition-colors whitespace-nowrap"
          >
            Explore <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-4 text-xs text-[#77766E]">
            <span>Instant Download</span>
            <span>•</span>
            <span>Permanent Library Access</span>
          </div>
          <button
            onClick={() => setDismissed(true)}
            className="md:hidden text-[#77766E] hover:text-[#292B27] p-1 -mr-1"
            aria-label="Dismiss announcement"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
