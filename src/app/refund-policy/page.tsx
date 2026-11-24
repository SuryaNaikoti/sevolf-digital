import React from "react";
import Link from "next/link";
import { RefreshCw, CheckCircle2, AlertOctagon, HelpCircle, Mail, Clock } from "lucide-react";

export const metadata = {
  title: "Cancellation and Refund Policy — SEVOLF Digital",
  description: "Information regarding cancellation, refund eligibility, duplicate order resolutions, and technical replacements for digital products.",
};

export default function RefundPolicyPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            LEGAL & COMMERCE POLICIES
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Cancellation & Refund Policy
          </h1>
          <p className="text-sm text-[#77766E] font-sans">
            Effective Date: January 1, 2026 • SEVOLF Digital Storefront
          </p>
        </div>

        {/* Highlight Callout */}
        <div className="bg-[#F5F2EB] border border-[#DDD8CD] rounded-sm p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-3 text-[#292B27]">
            <AlertOctagon className="w-5 h-5 text-[#657052] shrink-0" />
            <h2 className="font-serif text-lg font-medium">Digital Product Policy Summary</h2>
          </div>
          <p className="text-sm text-[#77766E] leading-relaxed font-sans">
            Because SEVOLF Digital provides immediate, irrevocable electronic access to downloadable PDF guides, templates, and workbooks upon checkout, digital purchases are generally non-cancellable and non-refundable once the download link or file has been delivered or accessed. However, we guarantee full support, technical replacements, and fair refund consideration for genuine errors and technical defects as outlined below.
          </p>
        </div>

        <div className="prose text-sm text-[#77766E] leading-relaxed space-y-6 font-sans">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#657052]" />
              1. Order Cancellation Policy
            </h2>
            <p>
              Due to our automated, immediate fulfillment pipeline:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Orders that have successfully completed payment and generated download entitlements cannot be cancelled.</li>
              <li>If you realize an error immediately after placing an order and have <strong className="text-[#292B27]">not downloaded or opened the file</strong>, please reach out to customer support within 2 hours of transaction completion for cancellation review.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#657052]" />
              2. Refund & Resolution Eligibility
            </h2>
            <p>
              We stand firmly behind the design and technical quality of our publications. A full refund or corrective replacement will be issued under the following validated conditions:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                <strong className="text-[#292B27]">Corrupted or Inaccessible File Assets:</strong> If the downloaded PDF/ZIP asset is corrupted, unreadable, or missing pages, and our support desk is unable to provide a working replacement file within 48 hours of notification.
              </li>
              <li>
                <strong className="text-[#292B27]">Duplicate Accidental Purchases:</strong> If a technical glitch or user error results in duplicate charges for the exact same digital product on the same email account within a 24-hour window, the duplicate payment will be refunded in full.
              </li>
              <li>
                <strong className="text-[#292B27]">Payment Processing Inconsistencies:</strong> If you are incorrectly billed due to an authorized payment gateway currency or transaction discrepancy.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <AlertOctagon className="w-4 h-4 text-[#657052]" />
              3. Non-Refundable Circumstances
            </h2>
            <p>Refunds cannot be issued under the following scenarios:</p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Change of mind after successful file download or consumption.</li>
              <li>Failure to read product descriptions or technical device specifications (e.g., purchasing a PDF planner without a compatible tablet/PDF app).</li>
              <li>Exceeding the 30-day download window (in which case we will happily reissue fresh download links upon request, but cannot offer a cash refund).</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#657052]" />
              4. Refund Processing Timeline
            </h2>
            <p>
              Once a refund request is reviewed and approved by our support team:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>The refund is initiated immediately through the original payment method (via Razorpay).</li>
              <li>Refunded amounts typically reflect in your original bank account, credit card, or UPI source within <strong className="text-[#292B27]">5 to 7 business days</strong>, depending on your financial institution&apos;s processing policies.</li>
              <li>Upon refund issuance, the corresponding digital download entitlement will be revoked.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#657052]" />
              5. How to Request Assistance or a Refund
            </h2>
            <p>
              To submit a cancellation or refund inquiry, please provide your order reference number, checkout email address, and a brief description of the issue:
            </p>
            <p className="bg-[#FAF8F5] border border-[#DDD8CD] p-4 rounded-xs text-xs text-[#292B27]">
              <strong>Support Email:</strong> support@sevolf.shop<br />
              <strong>Contact Page:</strong> <Link href="/contact" className="underline hover:text-[#657052]">https://sevolf-digital.vercel.app/contact</Link><br />
              <strong>Support Operating Window:</strong> Monday – Friday, 9:00 AM – 6:00 PM IST
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
