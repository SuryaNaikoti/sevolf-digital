"use client";

import React, { useEffect } from "react";
import Link from "next/link";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log error securely without exposing secret credentials
    console.error("[Storefront Runtime Error]:", error?.message || "An unexpected error occurred.");
  }, [error]);

  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-24 text-center">
      <div className="max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 bg-[#FDF3F2] rounded-full flex items-center justify-center mx-auto text-[#D9381E]">
          <AlertCircle className="w-8 h-8" />
        </div>

        <span className="text-xs uppercase tracking-[0.25em] text-[#77766E] font-semibold block">
          APPLICATION ERROR
        </span>

        <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#292B27]">
          Something went wrong.
        </h1>

        <p className="text-sm text-[#77766E] leading-relaxed font-sans">
          We encountered an unexpected condition while loading this page. Your order data and account remain secure.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            onClick={() => reset()}
            className="w-full sm:w-auto bg-[#292B27] hover:bg-black text-white px-8 py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors rounded-sm inline-flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="w-full sm:w-auto bg-white hover:bg-[#F5F2EB] text-[#292B27] border border-[#DDD8CD] px-8 py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors rounded-sm inline-flex items-center justify-center gap-2"
          >
            <Home className="w-4 h-4" />
            <span>Return Home</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
