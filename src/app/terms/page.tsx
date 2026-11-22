import React from "react";

export const metadata = {
  title: "Terms and Conditions — SEVOLF Digital",
  description: "Terms governing use of the SEVOLF Digital platform, products, and services.",
};

export default function TermsPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            LEGAL AGREEMENT
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Terms & Conditions
          </h1>
          <p className="text-sm text-[#77766E] font-sans">
            Effective Date: January 1, 2026
          </p>
        </div>

        <div className="prose text-sm text-[#77766E] leading-relaxed space-y-6 font-sans">
          <section className="space-y-2">
            <h2 className="font-serif text-xl font-medium text-[#292B27]">1. Platform Ownership</h2>
            <p>
              SEVOLF Digital is an independent storefront owned and operated by SEVOLF. All design assets, editorial copies, graphic elements, illustrations, and proprietary templates are the exclusive intellectual property of SEVOLF.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-xl font-medium text-[#292B27]">2. Customer Responsibilities</h2>
            <p>
              You agree not to bypass digital rights protections, generate unauthorized redistributions, or use scraping automatons across this commerce platform.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
