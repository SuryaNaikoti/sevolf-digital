import React from "react";

export const metadata = {
  title: "Licensing Information — SEVOLF Digital",
  description: "Guidelines on Personal Household Licences, Commercial Single-Business Licences, and Institutional terms.",
};

export default function LicensingPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            INTELLECTUAL RIGHTS
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Licensing Architecture
          </h1>
          <p className="text-sm text-[#77766E] font-sans">
            How you are legally entitled to use, print, and implement SEVOLF Digital editions.
          </p>
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-white border border-[#DDD8CD] rounded-sm space-y-3">
            <h2 className="font-serif text-2xl font-medium text-[#292B27]">1. Personal Household Licence</h2>
            <p className="text-xs text-[#657052] font-semibold uppercase tracking-wider">Default for SEVOLF Little & Lifestyle Guides</p>
            <p className="text-sm text-[#77766E] leading-relaxed">
              Grants a single individual or family household the right to download, display, and print the digital product for private non-commercial use. You may reprint worksheets as often as required for family members residing in your home.
            </p>
            <div className="text-xs text-[#77766E] pt-2 border-t border-[#DDD8CD]/50">
              ✗ Resale, public file-sharing, distribution, or uploading to shared folders is prohibited.
            </div>
          </div>

          <div className="p-6 bg-white border border-[#DDD8CD] rounded-sm space-y-3">
            <h2 className="font-serif text-2xl font-medium text-[#292B27]">2. Commercial Single-Entity Licence</h2>
            <p className="text-xs text-[#657052] font-semibold uppercase tracking-wider">Default for Business & Founder Operating Kits</p>
            <p className="text-sm text-[#77766E] leading-relaxed">
              Grants one business organization the right to adapt, fill, customize, and execute the contracts and pitch documents for their internal operations and capital raising.
            </p>
            <div className="text-xs text-[#77766E] pt-2 border-t border-[#DDD8CD]/50">
              ✗ White-labeling or selling the base template as a competing digital product is strictly prohibited.
            </div>
          </div>

          <div className="p-6 bg-[#EAE5DA] border border-[#DDD8CD] rounded-sm space-y-3">
            <h2 className="font-serif text-2xl font-medium text-[#292B27]">3. Institutional & Classroom Licences</h2>
            <p className="text-sm text-[#77766E] leading-relaxed">
              Schools, learning centers, and corporate teams wishing to distribute physical or digital copies across multiple educators or classrooms can request multi-seat extensions by writing to support@sevolf.shop.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
