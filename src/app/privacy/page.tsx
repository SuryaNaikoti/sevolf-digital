import React from "react";

export const metadata = {
  title: "Privacy Policy — SEVOLF Digital",
  description: "How SEVOLF protects, processes, and respects customer information.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            DATA GOVERNANCE
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#77766E] font-sans">
            Effective Date: January 1, 2026
          </p>
        </div>

        <div className="prose text-sm text-[#77766E] leading-relaxed space-y-6 font-sans">
          <section className="space-y-2">
            <h2 className="font-serif text-xl font-medium text-[#292B27]">1. Information We Collect</h2>
            <p>
              We collect information strictly necessary to fulfill your digital orders and maintain your persistent Digital Library: customer full name, email address, country of residence, and transaction histories.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-xl font-medium text-[#292B27]">2. Payment Processing Security</h2>
            <p>
              We do not store payment card numbers, UPI PINs, or banking passwords on SEVOLF servers. All sensitive financial transactions are securely tokenized and handled directly by PCI-DSS certified partners (Razorpay and Stripe).
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="font-serif text-xl font-medium text-[#292B27]">3. No Sale of Personal Data</h2>
            <p>
              SEVOLF will never sell, lease, or monetize your personal information to third-party ad networks or brokers.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
