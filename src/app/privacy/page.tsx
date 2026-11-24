import React from "react";
import Link from "next/link";
import { ShieldCheck, Database, CreditCard, Lock, Mail, UserCheck } from "lucide-react";

export const metadata = {
  title: "Privacy Policy — SEVOLF Digital",
  description: "How SEVOLF Digital collects, protects, processes, and respects customer information and payment data.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            DATA PRIVACY & PROTECTION
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Privacy Policy
          </h1>
          <p className="text-sm text-[#77766E] font-sans">
            Effective Date: January 1, 2026 • SEVOLF Digital Storefront
          </p>
        </div>

        <div className="prose text-sm text-[#77766E] leading-relaxed space-y-6 font-sans">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-[#657052]" />
              1. Information We Collect
            </h2>
            <p>
              SEVOLF Digital is committed to minimal, responsible data collection. We gather only the information strictly required to process your digital purchase, deliver your electronic files, and maintain your persistent digital product library:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li><strong className="text-[#292B27]">Customer Identification:</strong> Full name and email address provided during checkout or account registration.</li>
              <li><strong className="text-[#292B27]">Order Records:</strong> Items purchased, transaction identifiers, payment timestamps, and download entitlement history.</li>
              <li><strong className="text-[#292B27]">Technical Log Data:</strong> IP address, device browser type, and download audit timestamps recorded strictly for delivery verification and fraud prevention.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#657052]" />
              2. Payment Data & Processing Security
            </h2>
            <p>
              SEVOLF does not collect, process, or store payment card numbers, bank account details, CVVs, or UPI PINs on our servers.
            </p>
            <p>
              All payment transactions are handled through certified, PCI-DSS Level 1 compliant payment gateway partners (such as Razorpay). When submitting payment at checkout, your financial credentials are securely encrypted directly between your browser and the payment gateway.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#657052]" />
              3. How We Use Your Data
            </h2>
            <p>We use your information exclusively for the following legitimate purposes:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Generating and sending automated email receipts containing your secure digital download links.</li>
              <li>Managing download quotas and granting access to your purchased products via the customer library.</li>
              <li>Providing responsive customer support and responding to technical delivery inquiries.</li>
              <li>Complying with statutory accounting and tax reporting obligations.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#657052]" />
              4. No Sale or Monetization of Personal Data
            </h2>
            <p>
              We firmly respect your privacy. SEVOLF will never sell, lease, rent, trade, or monetize your personal data to third-party advertisers, data aggregators, or marketing networks under any circumstances.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#657052]" />
              5. Data Security & Encryption
            </h2>
            <p>
              We enforce industry-standard security safeguards to protect your personal details:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>End-to-end HTTPS/TLS 256-bit encryption for all web communications and data transmissions.</li>
              <li>Cryptographic bearer tokens (AES-256-GCM) protecting private digital download URLs.</li>
              <li>Strict database Row Level Security (RLS) policies isolating customer order records.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#657052]" />
              6. Privacy Rights & Contact
            </h2>
            <p>
              You have the right to request access to the personal records associated with your email, request corrections, or request account closure. For any privacy-related requests or questions:
            </p>
            <p className="bg-[#FAF8F5] border border-[#DDD8CD] p-4 rounded-xs text-xs text-[#292B27]">
              <strong>Email:</strong> support@sevolf.shop<br />
              <strong>Contact Page:</strong> <Link href="/contact" className="underline hover:text-[#657052]">https://sevolf-digital.vercel.app/contact</Link><br />
              <strong>Response Time:</strong> Within 48 business hours
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
