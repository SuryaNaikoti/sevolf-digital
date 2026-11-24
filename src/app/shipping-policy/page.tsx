import React from "react";
import Link from "next/link";
import { DownloadCloud, Mail, Clock, RefreshCw, HelpCircle, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Shipping & Digital Delivery Policy — SEVOLF Digital",
  description: "Information regarding electronic delivery, instant file access, download limits, and delivery assistance for digital products.",
};

export default function ShippingPolicyPage() {
  return (
    <div className="max-w-[1440px] mx-auto px-5 md:px-16 py-12 md:py-20">
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <span className="text-xs uppercase tracking-[0.25em] text-[#657052] font-semibold block mb-2">
            ELECTRONIC FULFILMENT & ACCESS
          </span>
          <h1 className="font-serif text-4xl sm:text-5xl font-normal text-[#292B27] leading-tight mb-4">
            Shipping & Digital Delivery Policy
          </h1>
          <p className="text-sm text-[#77766E] font-sans">
            Effective Date: January 1, 2026 • SEVOLF Digital Storefront
          </p>
        </div>

        {/* Highlight Callout */}
        <div className="bg-[#F5F2EB] border border-[#DDD8CD] rounded-sm p-6 sm:p-8 space-y-3">
          <div className="flex items-center gap-3 text-[#292B27]">
            <DownloadCloud className="w-5 h-5 text-[#657052] shrink-0" />
            <h2 className="font-serif text-lg font-medium">100% Digital Store — No Physical Shipping</h2>
          </div>
          <p className="text-sm text-[#77766E] leading-relaxed font-sans">
            SEVOLF Digital creates and publishes downloadable electronic publications, PDF toolkits, interactive planners, and digital templates. We do not dispatch tangible physical parcels. Consequently, there are zero shipping fees, zero postal transit delays, and zero physical handling charges.
          </p>
        </div>

        <div className="prose text-sm text-[#77766E] leading-relaxed space-y-6 font-sans">
          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#657052]" />
              1. Delivery Timeline & Methods
            </h2>
            <p>
              Digital products are delivered electronically and instantaneously immediately following authoritative payment confirmation. Customers receive access through two primary channels:
            </p>
            <ul className="list-disc list-inside space-y-2 pl-2">
              <li>
                <strong className="text-[#292B27]">Instant On-Screen Download:</strong> As soon as the transaction is verified, you are automatically redirected to our Order Confirmation page with direct, one-click download buttons for each purchased asset.
              </li>
              <li>
                <strong className="text-[#292B27]">Automated Confirmation Email:</strong> Within minutes of payment completion, an automated transactional receipt is delivered to the email address provided during checkout containing secure, personalized download links.
              </li>
              <li>
                <strong className="text-[#292B27]">Customer Account Library:</strong> If you created or logged into your SEVOLF account, all purchased digital products are automatically added to your permanent <Link href="/account/library" className="underline text-[#292B27] hover:text-[#657052]">Digital Library</Link> for future access.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#657052]" />
              2. Download Link Validity & Quota
            </h2>
            <p>
              To maintain system integrity and prevent unauthorized distribution, download entitlements are governed by the following standard access parameters:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2">
              <li>Standard download access links remain active for <strong className="text-[#292B27]">30 days</strong> from the date of purchase.</li>
              <li>Each purchase allows up to <strong className="text-[#292B27]">10 download attempts</strong> across your personal desktop, tablet, and mobile reading devices.</li>
              <li>We recommend saving a permanent copy of your purchased PDF/ZIP files to your local device or personal cloud storage immediately upon receipt.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#657052]" />
              3. Delivery Failures & Resolution
            </h2>
            <p>
              If you have completed payment but have not received your digital delivery within 10 minutes:
            </p>
            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>Check your email spam, promotions, or junk folders for an email from <code className="text-xs bg-[#EAE5DA] px-1.5 py-0.5 rounded text-[#292B27]">support@sevolf.shop</code>.</li>
              <li>Verify that the email address entered during checkout was spelled correctly without typographical errors.</li>
              <li>If you placed an order as a registered customer, log into your <Link href="/account/orders" className="underline text-[#292B27] hover:text-[#657052]">Order History</Link> where active download links are rendered.</li>
              <li>If technical network interruptions or mailbox restrictions prevent email delivery, our automated server queue retries dispatch with backoff intervals.</li>
            </ol>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-[#657052]" />
              4. Reissuing Expired or Lost Links
            </h2>
            <p>
              If your 30-day download link expires or you inadvertently misplace your files, please contact us at <a href="mailto:support@sevolf.shop" className="underline text-[#292B27] hover:text-[#657052]">support@sevolf.shop</a> or through our <Link href="/contact" className="underline text-[#292B27] hover:text-[#657052]">Contact Form</Link> with your order reference number and checkout email. We will gladly regenerate your secure access link free of charge after verifying your purchase record.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="font-serif text-xl font-medium text-[#292B27] flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#657052]" />
              5. Customer Support & Assistance
            </h2>
            <p>
              Our customer care desk is dedicated to ensuring you can open, read, and utilize your purchased tools without friction. For technical replacement requests, file format queries, or assistance with e-readers and tablet applications:
            </p>
            <p className="bg-[#FAF8F5] border border-[#DDD8CD] p-4 rounded-xs text-xs text-[#292B27]">
              <strong>Support Email:</strong> support@sevolf.shop<br />
              <strong>Response Time:</strong> Within 24 business hours<br />
              <strong>Contact Page:</strong> <Link href="/contact" className="underline hover:text-[#657052]">https://sevolf-digital.vercel.app/contact</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
