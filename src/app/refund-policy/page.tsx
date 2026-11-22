import React from "react";

export const metadata = {
  title: "Digital Refund Policy — SEVOLF Digital",
  description: "Information regarding refunds, technical replacements, and consumer rights for digital downloads.",
};

export default function RefundPolicyPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            LEGAL & COMMERCE
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Digital Products Refund Policy
          </h1>
          <p className="text-sm text-[#77766E] font-sans">
            Effective Date: January 1, 2026 • SEVOLF Digital Storefront
          </p>
        </div>

        <div className="prose text-sm text-[#77766E] leading-relaxed space-y-6 font-sans">
          <section className="space-y-2">
            <h2 className="font-serif text-xl font-medium text-[#292B27]">1. Nature of Digital Goods</h2>
            <p>
              SEVOLF Digital offers downloadable digital publications, interactive planners, and electronic templates. Given the intangible nature of digital data and immediate electronic delivery upon purchase, transactions are generally non-refundable once the download link or file asset has been accessed.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-xl font-medium text-[#292B27]">2. Eligibility for Replacement or Credit</h2>
            <p>
              We stand behind the craftsmanship of every digital asset. We will happily issue a full replacement file, store credit, or resolution under the following documented circumstances:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Defective or unreadable file corruption that our technical support team cannot resolve within 48 hours.</li>
              <li>Duplicate accidental purchases of the exact same product made within 24 hours on the same user account.</li>
              <li>A verifiable payment gateway error resulting in incorrect currency billing.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-xl font-medium text-[#292B27]">3. Contacting Support</h2>
            <p>
              If you experience technical difficulty opening, annotating, or printing any file, please contact us at support@sevolf.store with your order reference number and device specifications.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
