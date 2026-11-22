import React from "react";
import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-24 text-center">
      <div className="max-w-md mx-auto space-y-6">
        <div className="w-16 h-16 bg-[#EAE5DA] rounded-full flex items-center justify-center mx-auto text-[#657052]">
          <Compass className="w-8 h-8" />
        </div>

        <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block">
          404 — EDITION NOT FOUND
        </span>

        <h1 className="font-serif text-3xl sm:text-4xl font-normal text-[#292B27]">
          This digital work could not be located.
        </h1>

        <p className="text-sm text-[#77766E] leading-relaxed font-sans">
          The publication or edition you are searching for may have been archived, renamed, or is temporarily unavailable.
        </p>

        <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/shop"
            className="w-full sm:w-auto bg-[#292B27] hover:bg-[#657052] text-white px-8 py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors rounded-sm inline-flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Catalogue</span>
          </Link>
          <Link
            href="/"
            className="w-full sm:w-auto bg-white hover:bg-[#F5F2EB] text-[#292B27] border border-[#DDD8CD] px-8 py-3.5 text-xs uppercase tracking-widest font-semibold transition-colors rounded-sm"
          >
            Homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
